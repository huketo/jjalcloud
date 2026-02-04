/** @jsxImportSource hono/jsx/dom */
import { useEffect, useRef, useState } from "hono/jsx";
import { LOAD_MORE_COUNT } from "../constants";

interface GifData {
	uri: string;
	cid: string;
	rkey: string;
	title?: string;
	alt?: string;
	tags?: string[];
	file: {
		ref?: { $link?: string; link?: string };
	};
	createdAt: string;
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	likeCount?: number;
	isLiked?: boolean;
}

interface InfiniteScrollProps {
	initialCount: number;
}

function getGifUrl(gif: GifData): string {
	const did = gif.uri.split("/")[2];
	const cid = gif.file?.ref?.$link || gif.file?.ref?.link || gif.cid;
	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}

// Create DOM element for a GIF card (to append to existing grid)
function createGifCardElement(gif: GifData): HTMLElement {
	const gifUrl = getGifUrl(gif);
	const profileUrl = gif.authorDid ? `/profile/${gif.authorDid}` : "#";

	const wrapper = document.createElement("div");
	wrapper.className = "break-inside-avoid mb-4";
	wrapper.setAttribute("data-timestamp", gif.createdAt);

	wrapper.innerHTML = `
		<article class="group relative bg-bg-surface rounded-lg overflow-hidden shadow-card transition-all duration-300 md:hover:shadow-lg">
			<a href="/gif/${gif.rkey}" class="block w-full relative z-1">
				<img
					src="${gifUrl}"
					alt="${gif.alt || gif.title || "GIF"}"
					class="w-full block h-auto object-cover bg-brand-primary-pale"
					loading="lazy"
				/>
			</a>
			<div class="absolute inset-0 z-5 bg-gradient-to-t from-brand-primary-dark/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 hidden md:flex flex-col justify-end pointer-events-none md:group-hover:opacity-100 backdrop-blur-[2px]">
				<div class="flex items-center justify-between w-full gap-2">
					<div class="pointer-events-auto">
						<a href="${profileUrl}" class="flex items-center gap-2 text-text-inverse no-underline font-medium text-sm transition-opacity duration-150 hover:opacity-80 drop-shadow-md">
							${
								gif.authorAvatar
									? `<img src="${gif.authorAvatar}" alt="${gif.authorHandle || "User"}" class="w-6 h-6 rounded-full object-cover border border-white/70" />`
									: `<div class="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs text-white">👤</div>`
							}
							<span class="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap pt-[2px]">${gif.authorHandle || "Unknown"}</span>
						</a>
					</div>
				</div>
			</div>
		</article>
	`;

	return wrapper;
}

// Wait for all images in an element to load (with timeout)
function waitForImagesToLoad(
	container: Element,
	timeout = 3000,
): Promise<void> {
	const images = container.querySelectorAll("img");
	if (images.length === 0) return Promise.resolve();

	const imagePromises = Array.from(images).map((img) => {
		if (img.complete) return Promise.resolve();
		return new Promise<void>((resolve) => {
			img.addEventListener("load", () => resolve(), { once: true });
			img.addEventListener("error", () => resolve(), { once: true });
		});
	});

	// Race between image loading and timeout
	const timeoutPromise = new Promise<void>((resolve) =>
		setTimeout(resolve, timeout),
	);

	return Promise.race([
		Promise.all(imagePromises).then(() => {}),
		timeoutPromise,
	]);
}

const LoadingSpinner = () => (
	<svg
		class="animate-spin w-5 h-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		<circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
		<path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.75" />
	</svg>
);

export const InfiniteScroll = ({ initialCount }: InfiniteScrollProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [isReady, setIsReady] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const lastTimestampRef = useRef<string | null>(null);

	// Get the last timestamp from the grid
	const updateLastTimestamp = () => {
		const grid = document.getElementById("gif-grid");
		if (!grid) return;

		const items = grid.querySelectorAll("[data-timestamp]");
		if (items.length > 0) {
			lastTimestampRef.current =
				items[items.length - 1].getAttribute("data-timestamp");
		}
	};

	const loadMore = async () => {
		if (isLoading || !hasMore) return;

		const grid = document.getElementById("gif-grid");
		if (!grid) return;

		setIsLoading(true);
		updateLastTimestamp();

		try {
			const cursor = lastTimestampRef.current;
			const url = cursor
				? `/api/feed?cursor=${encodeURIComponent(cursor)}&limit=${LOAD_MORE_COUNT}`
				: `/api/feed?limit=${LOAD_MORE_COUNT}`;

			const res = await fetch(url);
			const data = (await res.json()) as { gifs?: GifData[] };

			if (data.gifs && data.gifs.length > 0) {
				const newCards: HTMLElement[] = [];

				// Append new cards directly to the existing grid (preserves masonry)
				for (const gif of data.gifs) {
					const card = createGifCardElement(gif);
					grid.appendChild(card);
					newCards.push(card);
				}

				// Wait for new images to load before updating state
				await Promise.all(newCards.map((card) => waitForImagesToLoad(card)));

				// Update last timestamp after adding new items
				updateLastTimestamp();

				if (data.gifs.length < LOAD_MORE_COUNT) {
					setHasMore(false);
				}
			} else {
				setHasMore(false);
			}
		} catch (err) {
			console.error("[InfiniteScroll] Failed to load:", err);
		} finally {
			setIsLoading(false);
		}
	};

	// Wait for initial images to load before enabling infinite scroll
	useEffect(() => {
		const grid = document.getElementById("gif-grid");
		if (!grid || initialCount === 0) {
			setIsReady(true);
			return;
		}

		// Wait for all initial images to load
		waitForImagesToLoad(grid).then(() => {
			updateLastTimestamp();
			setIsReady(true);
		});

		// Fallback timeout in case some images fail to load
		const timeout = setTimeout(() => {
			updateLastTimestamp();
			setIsReady(true);
		}, 5000);

		return () => clearTimeout(timeout);
	}, [initialCount]);

	// Set up IntersectionObserver after ready
	useEffect(() => {
		if (!isReady || !sentinelRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isLoading && hasMore) {
					loadMore();
				}
			},
			{
				rootMargin: "400px",
				threshold: 0,
			},
		);

		observer.observe(sentinelRef.current);

		return () => observer.disconnect();
	}, [isReady, isLoading, hasMore]);

	// Don't render anything if no initial content
	if (initialCount === 0) {
		return null;
	}

	return (
		<>
			{/* Sentinel for IntersectionObserver */}
			<div ref={sentinelRef} class="h-1" />

			{/* Loading Indicator */}
			{isLoading && (
				<div class="text-center py-8">
					<div class="inline-flex items-center gap-2 text-text-muted">
						<LoadingSpinner />
						<span>Loading more jjals...</span>
					</div>
				</div>
			)}

			{/* End of Feed */}
			{!hasMore && !isLoading && (
				<div class="text-center py-8 text-text-muted">
					<p>🎉 You've seen all the jjals!</p>
				</div>
			)}
		</>
	);
};
