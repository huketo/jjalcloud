---
status: accepted
---

# The grid serves a still frame, generated in our own process

The grid renders a still first frame at grid width; animation is opt-in per card. Stills are produced
by `sharp` in our own runtime at request time and cached by the CDN — not by a vendor transformation
service, and not stored durably.

## Both incumbents say don't put a GIF in a grid

Giphy's rendition guide is blunt: *"For standard GIFs (no transparency): Use MP4 wherever supported, or
WEBP as a fallback. **Do not use the GIF format.**"* and *"Use the smaller `fixed_height` or
`fixed_width` renditions on your preview grid… You may also choose to load the `fixed_height_still` or
`fixed_width_still` initially."* Tenor's `preview` rendition is *"High quality single frame GIF format…
intended for use as a thumbnail preview"*, and its published medians put `tinygif` at **101 KB**
against **956 KB** for the original — roughly 10×, measured against a median far below our 20 MB
ceiling.

## sharp's silent bug is our requirement

bsky calls `sharp()` with no options anywhere (`image/sharp.ts:22,32,55`). The defaults are `pages: 1`
and `animated: false`, so an animated GIF becomes a single-frame WebP — with no error, no warning, no
log line and no metric. There are zero occurrences of `animated|apng|pages:|frames` across
`packages/bsky/src` and `packages/pds/src`, and every fixture in the resizer's test suite is a `.jpg`,
so the flattening is untested in both senses.

That is a bug for them and exactly the behaviour we want. We take the default deliberately, and we
write down that we are relying on it.

bsky's own architecture concedes the general point: **video** is not transformed in-process at all but
delegated to an external pipeline producing HLS plus a still `.jpg` thumbnail (`index.ts:93-99`).
Animated GIF is the one moving-image format it routes through the still-image resizer.

## First frames are nearly free

Measured on a 20.32 MB / 500×500 / 62-frame GIF (i7-12700), decoding frame 0 with the zero-dependency
`omggif`:

| runtime | mode | decode | total | RSS |
|---|---|---|---|---|
| node 24.18 | first frame | 10.1 ms | 22.1 ms | 32.4 MB |
| bun 1.3.14 | first frame | **5.9 ms** | 20.5 ms | 31.6 MB |
| bun 1.3.14 | all 62 frames | 174.1 ms | 186.6 ms | 49.6 MB |

Six to ten milliseconds of CPU and about 32 MB of RSS, faster on Bun than on Node. Decoding every
frame is 17–30× that and scales with frame count.

## Why not the vendor's transformation service

Cloudflare Images transformations are genuinely available on the free plan — 5,000 unique
transformations per month, `9422` and no charge on overage — animation is preserved by default
(`anim=true`), GIF→animated WebP is documented, and because the source is on our own zone it needs no
Sources configuration and no Worker: *"Cloudflare will always allow source images from the same zone
where your transformations are served."*

Three things rule it out, and the first two fail worst on precisely our worst case:

1. **The 50 MP cliff is a silent no-op, not an error.** *"Any animations over 50 megapixels will be
   delivered without applying any transformations."* A `width=400` request returns the original 20 MB
   GIF with a 200. A 500×500 GIF needs only ~200 frames to cross it, and nothing in the record says
   which side it lands on. Optimisation disappears exactly as the file gets bigger.
2. **The meter is per (source × parameters) per calendar month**, so an immutable, content-addressed
   catalogue is re-billed every month for assets that never change. Past 5,000 items we would meet
   `9422` at the start of every month.
3. **There is no frame-decimation option.** `anim=false` is all-or-nothing. Giphy sells
   `fixed_width_downsampled` (six frames) because that middle ground is what grids actually want;
   Cloudflare has no equivalent.

Cloudflare's own limits and troubleshooting pages disagree on the animated cap (100 MP deliver / 50 MP
transform versus a flat 50 MP total). Polish is separately ruled out: Pro plan and above, explicitly
not to be combined with transformations, and it does not touch GIF.

This is a reversible exclusion. If our CPU becomes the constraint, the preset path can be rewritten to
a transformation URL without touching a single link — which is the next section's point.

## Presets live in the path

`/img/:did/:cid/:preset`, with presets as a closed set.

bsky uses `/{preset}/plain/{did}/{cid}`, but the decisive reason is elsewhere: **the preset vocabulary
is a contract with whoever serves the bytes, not an implementation detail of the resizer.** Setting
`BSKY_CDN_URL` silences bsky's middleware (`image/server.ts:32-35`) and simultaneously repoints every
generated URL (`index.ts:86-92`) — the URL grammar is identical either way. One env var moves the work
without moving the links.

It also makes a whole class of bug unrepresentable. bsky's disk cache key is `[did, cid, preset]` and
**omits the format** (`image/server.ts:52`), while the format is caller-selectable through an
`@jpeg`/`@webp` suffix (`image/uri.ts:57-71`) — so requesting `@webp` and then `@jpeg` returns the WebP
bytes labelled `image/jpeg`. When the preset is in the path, the URL *is* the cache key and the variant
cannot drift from its identity. A closed preset set keeps that finite; arbitrary dimensions would
reopen it and contradict the cache-hit-rate requirement from ADR-0007.

## Nothing derived is stored

Neither reference stores a derived image durably. bsky writes to an `os.tmpdir()` disk cache
(`image/server.ts:174-232`) and its three CDN integrations are purge-only, with the interface saying so:
*"this does not remove the blob from storage: just invalidates it from caches."* tangled uses
`caches.default` and **declares no bindings at all** in either `wrangler.jsonc` — there is nowhere for a
derived image to go. Every derived byte in both is regenerable from the origin.

ADR-0007 already made the CDN the cache layer. A still frame is a pure function of a blob, so this adds
no state to reconstruct.

## The browser cannot solve this

`loading="lazy"` is pure deferral: the spec's lazy load resumption steps *"cause the element to continue
loading"*, with no partial transfer, no range, no abort. Chromium's threshold is hardcoded at 1250 px on
4G and 2500 px on slower links — several grid rows of prefetch. **Every GIF the user scrolls past is
downloaded in full**, so lazy loading is a start-up optimisation, not a byte budget.

Offscreen GIFs also keep animating. Blink pauses animation only when `visibility != visible`, the
document is hidden, the view is not visible, or paint invalidation is delayed
(`image_resource_content.cc:613-629`, `layout_object.cc:4623-4652`) — being scrolled out of view is not
on that list. `content-visibility`'s spec guarantee covers CSS animations and says nothing about image
frame advancement. A grid of forty animating GIFs is a CPU and battery problem no HTML attribute fixes,
which is a second, independent reason the grid holds stills.

Consequences for the client:

- **Both render paths use the deferred-load queue.** The SSR card writes `src` directly
  (`components/gif/GifCard.tsx:54`) while the island writes `data-src`
  (`islands/InfiniteScroll.tsx:50`), and `utils/lazyImages.ts:68` only observes `img[data-src]` — so the
  first screen currently gets no concurrency limit at all. That limit exists because the PDS rate-limits
  by client IP (ADR-0007), so the first screen is the one that most needs it.
- **`width` and `height` attributes, not only a CSS aspect ratio.** MDN's normative advice is the
  attributes, and without them *"image dimensions default to 0×0 pixels… the browser decides to load
  everything."* Whether a CSS `aspect-ratio` satisfies that heuristic is undocumented; the values are
  already stored per record, so there is no reason to find out the hard way.
- **Animation is reverted when the card leaves.** Since offscreen GIFs keep animating, a card upgraded
  to the original must be put back to its still, or a long session accumulates animations.

## Labelled GIFs

A GIF carrying `porn`, `nudity` or `graphic-media` renders as a blurred still and is **not** upgraded to
animation until revealed. ADR-0014 chose to show these with a warning rather than hide them, so removing
them from the grid would contradict it. Because the grid holds stills, the blur covers a small still
image rather than a 20 MB animation — the two decisions compose.

## Not a model to copy

tangled's avatar Worker looks like a transform proxy and is not one: `format` defaults to — and coerces
to — webp, so `cfOptions` is `{}` for every full-size request, and the only real transform is a 32×32
variant. It then stamps `image/webp` on whatever bytes came back, animated GIF included. `?size=256` is
passed by three callers but `resizeToTiny = size === "tiny"`, so it resizes nothing and only fragments
the cache key. It checks the cache *before* verifying the signature, while camo in the same repository
does the opposite and wrote down why: *"if we do the other way then any random signature for the same url
will be let through after a single successful request."*
