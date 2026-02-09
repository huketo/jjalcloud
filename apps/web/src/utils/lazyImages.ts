/**
 * Viewport-aware lazy image loader.
 * Observes images with `data-src` and swaps to `src` when near viewport.
 * Uses a batched loading queue to limit concurrent network requests.
 * Works with both SSR-rendered and dynamically-added images.
 */

const BATCH_SIZE = 4;
const ROOT_MARGIN = "300px";
const TRANSPARENT_PIXEL =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let loadQueue: HTMLImageElement[] = [];
let activeLoads = 0;

function processQueue(): void {
	while (loadQueue.length > 0 && activeLoads < BATCH_SIZE) {
		const img = loadQueue.shift();
		if (!img) continue;

		const src = img.dataset.src;
		if (!src) continue;

		activeLoads++;
		const onDone = () => {
			activeLoads--;
			processQueue();
		};
		img.addEventListener("load", onDone, { once: true });
		img.addEventListener("error", onDone, { once: true });
		img.src = src;
		img.removeAttribute("data-src");
	}
}

function enqueueImage(img: HTMLImageElement): void {
	loadQueue.push(img);
	processQueue();
}

function setPlaceholderSrc(img: HTMLImageElement): void {
	if (!img.getAttribute("src")) {
		img.src = TRANSPARENT_PIXEL;
	}
}

let observer: IntersectionObserver | null = null;

export function initLazyImages(): void {
	if (observer) observer.disconnect();

	loadQueue = [];
	activeLoads = 0;

	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					observer?.unobserve(entry.target);
					enqueueImage(entry.target as HTMLImageElement);
				}
			}
		},
		{ rootMargin: ROOT_MARGIN, threshold: 0.01 },
	);

	document
		.querySelectorAll<HTMLImageElement>("img[data-src]")
		.forEach((img) => {
			setPlaceholderSrc(img);
			observer?.observe(img);
		});
}

export function observeImage(img: HTMLImageElement): void {
	if (observer && img.dataset.src) {
		setPlaceholderSrc(img);
		observer.observe(img);
	}
}
