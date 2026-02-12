/** @jsxImportSource hono/jsx/dom */
import { useEffect, useRef, useState } from "hono/jsx";
import { LOAD_MORE_COUNT } from "../constants";
import { getGifUrl } from "../utils";
import { pickPastelColor } from "../utils/helpers";
import { observeImage } from "../utils/lazyImages";

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
	width?: number;
	height?: number;
}

interface InfiniteScrollProps {
	initialCount: number;
	searchQuery?: string;
}

function createGifCardElement(gif: GifData): HTMLElement {
	const gifUrl = getGifUrl(gif);
	const profileUrl = gif.authorDid ? `/profile/${gif.authorDid}` : "#";
	const aspectStyle =
		gif.width && gif.height
			? `aspect-ratio: ${gif.width} / ${gif.height};`
			: "";
	const placeholderColor = pickPastelColor(gif.rkey);

	const wrapper = document.createElement("div");
	wrapper.className = "mb-4";
	wrapper.setAttribute("data-timestamp", gif.createdAt);

	wrapper.innerHTML = `
		<article class="group relative bg-bg-surface rounded-lg overflow-hidden shadow-card transition-all duration-300 md:hover:shadow-lg">
			<a href="/gif/${gif.rkey}" class="block w-full relative z-1">
				<img
					data-src="${gifUrl}"
					alt="${gif.alt || gif.title || "GIF"}"
					class="w-full block h-auto object-cover text-transparent"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
					style="background-color: ${placeholderColor}; ${aspectStyle || "aspect-ratio: 4 / 3;"}"
				/>
			</a>
			<div class="absolute inset-0 z-5 bg-gradient-to-t from-brand-primary-dark/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 hidden md:flex flex-col justify-end pointer-events-none md:group-hover:opacity-100 backdrop-blur-[2px]">
				<div class="flex items-center justify-between w-full gap-2">
					<div class="pointer-events-auto">
						<a href="${profileUrl}" class="flex items-center gap-2 text-text-inverse no-underline font-medium text-sm transition-opacity duration-150 hover:opacity-80 drop-shadow-md">
							${
								gif.authorAvatar
									? `<img src="${gif.authorAvatar}" alt="${gif.authorHandle || "User"}" class="w-6 h-6 rounded-full object-cover border border-white/70" />`
									: `<div class="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs text-white">&#128100;</div>`
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

// Breakpoints match UnoCSS: columns-2 (default), sm:columns-3 (640px), lg:columns-4 (1024px)
function getColumnCount(): number {
	const width = window.innerWidth;
	if (width >= 1024) return 4;
	if (width >= 640) return 3;
	return 2;
}

// Distribute items to columns based on shortest column height
function distributeItemsToColumns(
	grid: HTMLElement,
	items: HTMLElement[],
	columnCount: number,
): HTMLElement[] {
	grid.innerHTML = "";
	// Reset to flex layout for masonry
	grid.className = "flex gap-2 md:gap-4 items-start"; // Added items-start to prevent stretching
	grid.removeAttribute("data-masonry");
	grid.setAttribute("data-masonry-flex", "true");

	const columns: HTMLElement[] = [];
	for (let i = 0; i < columnCount; i++) {
		const col = document.createElement("div");
		col.className = "flex-1 min-w-0 flex flex-col";
		col.setAttribute("data-masonry-column", String(i));
		columns.push(col);
		grid.appendChild(col);
	}

	// Check if any column has a non-zero height (unlikely extensively initially, but possible on re-layout)
	// Actually, we check the *items* height as we append them? No, we append to the shortest column.
	// But if the container is hidden or items haven't rendered, offsetHeight is 0.

	// Robust strategy:
	// Maintain an array of current heights for each column.
	// If the item has a known aspect ratio style, we can estimate height better, but offsetHeight is simplest if valid.
	const colHeights = new Array(columnCount).fill(0);

	items.forEach((item, index) => {
		item.classList.remove("break-inside-avoid");
		// Ensure item displays block/flex to have height
		item.style.marginBottom = ""; // Let the column gap handle spacing or keep common class

		// Find shortest column
		let shortestIndex = 0;
		let minH = colHeights[0];

		for (let i = 1; i < columnCount; i++) {
			if (colHeights[i] < minH) {
				minH = colHeights[i];
				shortestIndex = i;
			}
		}

		// Append
		columns[shortestIndex].appendChild(item);

		// Update height
		// If the browser hasn't engaged layout yet, offsetHeight might still be 0.
		// In that case, we might need a backup strategy (e.g. index % columnCount) to avoid stacking everything in col 0.
		// However, reading offsetHeight triggers a reflow.
		const itemHeight = item.offsetHeight;

		if (itemHeight === 0) {
			// If height is 0, it means we can't determine the "shortest" column reliably by height.
			// Fallback: Round-robin distribution for safety.
			// This happens if the tab is backgrounded or display:none.
			// We can override the decision and just push to (index % columnCount).
			// But if *some* items have height and others don't, it gets tricky.
			// Let's assume if the first item has 0 height, they all likely do.
			if (index === 0) {
				// Detect "zero-height mode"
				// Force round robin for this batch
			}
		}

		// Update the tracked height
		// If itemHeight is 0, we increment by a small amount to keep distribution even-ish if everything is 0
		colHeights[shortestIndex] += itemHeight || 1;
	});

	return columns;
}

// Initial conversion from CSS columns or helper to rebuild
function convertToFlexMasonry(grid: HTMLElement): HTMLElement[] {
	const columnCount = getColumnCount();

	// If already flex masonry, gather items via rebuild strategy
	if (grid.getAttribute("data-masonry-flex")) {
		return rebuildColumns(grid);
	}

	const items = Array.from(grid.children) as HTMLElement[];
	return distributeItemsToColumns(grid, items, columnCount);
}

function getShortestColumn(columns: HTMLElement[]): HTMLElement {
	let shortest = columns[0];
	let minHeight = shortest.offsetHeight;

	for (let i = 1; i < columns.length; i++) {
		const height = columns[i].offsetHeight;
		if (height < minHeight) {
			minHeight = height;
			shortest = columns[i];
		}
	}

	return shortest;
}

function rebuildColumns(grid: HTMLElement): HTMLElement[] {
	const columnCount = getColumnCount();
	const existingColumns = Array.from(
		grid.querySelectorAll("[data-masonry-column]"),
	);

	const columnItems: HTMLElement[][] = [];
	for (const col of existingColumns) {
		columnItems.push(Array.from(col.children) as HTMLElement[]);
	}

	// Interleave columns to restore original visual order before redistributing
	const allItems: HTMLElement[] = [];
	const maxLen = Math.max(...columnItems.map((c) => c.length));
	for (let row = 0; row < maxLen; row++) {
		for (const col of columnItems) {
			if (row < col.length) {
				allItems.push(col[row]);
			}
		}
	}

	return distributeItemsToColumns(grid, allItems, columnCount);
}

const LoadingSpinner = () => (
	<svg
		class="animate-spin w-5 h-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
		<path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.75" />
	</svg>
);

export const InfiniteScroll = ({
	initialCount,
	searchQuery,
}: InfiniteScrollProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [isReady, setIsReady] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const lastTimestampRef = useRef<string | null>(null);
	const columnsRef = useRef<HTMLElement[]>([]);

	const updateLastTimestamp = () => {
		const grid = document.getElementById("gif-grid");
		if (!grid) return;

		const items = grid.querySelectorAll("[data-timestamp]");
		if (items.length === 0) return;

		// After masonry layout, DOM order != chronological order.
		// Find the oldest (min) timestamp among all items as the cursor.
		let oldest: string | null = null;
		const itemsArray = Array.from(items);
		for (const item of itemsArray) {
			const ts = item.getAttribute("data-timestamp");
			if (ts && (!oldest || ts < oldest)) {
				oldest = ts;
			}
		}
		if (oldest) {
			lastTimestampRef.current = oldest;
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
			const queryText = (searchQuery || "").trim();
			const basePath = queryText ? "/api/search" : "/api/feed";
			const querySuffix = queryText
				? `&q=${encodeURIComponent(queryText)}`
				: "";
			const url = cursor
				? `${basePath}?cursor=${encodeURIComponent(cursor)}&limit=${LOAD_MORE_COUNT}${querySuffix}`
				: `${basePath}?limit=${LOAD_MORE_COUNT}${querySuffix}`;

			const res = await fetch(url);
			const data = (await res.json()) as {
				gifs?: GifData[];
				cursor?: string;
			};

			if (data.gifs && data.gifs.length > 0) {
				if (
					!columnsRef.current ||
					columnsRef.current.length === 0 ||
					!grid.contains(columnsRef.current[0])
				) {
					if (grid.getAttribute("data-masonry-flex")) {
						columnsRef.current = Array.from(grid.children) as HTMLElement[];
					} else {
						columnsRef.current = convertToFlexMasonry(grid);
					}
				}

				for (const gif of data.gifs) {
					const card = createGifCardElement(gif);
					const columns = columnsRef.current;

					if (columns && columns.length > 0) {
						const shortest = getShortestColumn(columns);
						shortest.appendChild(card);
					} else {
						grid.appendChild(card);
					}

					const img = card.querySelector<HTMLImageElement>("img[data-src]");
					if (img) observeImage(img);
				}

				if (data.cursor) {
					lastTimestampRef.current = data.cursor;
				} else {
					updateLastTimestamp();
				}

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

	useEffect(() => {
		const grid = document.getElementById("gif-grid");
		if (!grid || initialCount === 0) {
			setIsReady(true);
			return;
		}

		// Convert to Masonry immediately
		// We do NOT wait for images, as aspect-ratio handles space reservation
		columnsRef.current = convertToFlexMasonry(grid);
		updateLastTimestamp();
		setIsReady(true);

		// Short timeout to re-check specific layout issues if any
		const timeout = setTimeout(() => {
			const g = document.getElementById("gif-grid");
			// If layout looks wrong (e.g. data-masonry still there but not flex), try again
			if (g && !g.hasAttribute("data-masonry-flex")) {
				columnsRef.current = convertToFlexMasonry(g);
				updateLastTimestamp();
			}
		}, 100);

		return () => clearTimeout(timeout);
	}, [initialCount]);

	useEffect(() => {
		if (!isReady) return;

		let currentColumnCount = getColumnCount();

		const handleResize = () => {
			const newColumnCount = getColumnCount();
			if (newColumnCount !== currentColumnCount) {
				currentColumnCount = newColumnCount;
				const grid = document.getElementById("gif-grid");
				if (grid) {
					columnsRef.current = rebuildColumns(grid);
				}
			}
		};

		let resizeTimeout: ReturnType<typeof setTimeout>;
		const debouncedResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(handleResize, 150);
		};

		window.addEventListener("resize", debouncedResize);

		return () => {
			window.removeEventListener("resize", debouncedResize);
			clearTimeout(resizeTimeout);
		};
	}, [isReady]);

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
					<p>You've seen all the jjals!</p>
				</div>
			)}
		</>
	);
};
