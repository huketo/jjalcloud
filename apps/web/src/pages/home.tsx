import type { FC } from "hono/jsx";
import { GifCard, GifGrid, GifGridItem, Layout } from "../components";
import type { GifView } from "../types/gif";

interface BlobRef {
	$link?: string;
	link?: string;
}

interface HomePageProps {
	isLoggedIn: boolean;
	gifs: GifViewWithAuthor[];
	error?: string;
	avatarUrl?: string;
}

interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	likeCount?: number;
	isLiked?: boolean;
}

export const HomePage: FC<HomePageProps> = ({
	isLoggedIn,
	gifs,
	error,
	avatarUrl,
}) => {
	return (
		<Layout isLoggedIn={isLoggedIn} avatarUrl={avatarUrl}>
			{/* Error Message */}
			{error && (
				<div class="mb-6 p-4 rounded-md text-sm bg-status-error/10 border border-status-error text-status-error">
					{error}
				</div>
			)}

			{/* GIF Grid */}
			{gifs.length > 0 ? (
				<GifGrid>
					{gifs.map((gif) => (
						<GifGridItem
							key={gif.rkey}
							passedProps={{ "data-timestamp": gif.createdAt }}
						>
							<GifCard
								rkey={gif.rkey}
								title={gif.title}
								alt={gif.alt}
								tags={gif.tags}
								gifUrl={getGifUrl(gif)}
								authorDid={gif.authorDid}
								authorHandle={gif.authorHandle}
								authorAvatar={gif.authorAvatar}
								likeCount={gif.likeCount || Math.floor(Math.random() * 1000)} // Mock data for UI
								isLiked={gif.isLiked}
							/>
						</GifGridItem>
					))}
				</GifGrid>
			) : (
				<div class="flex flex-col items-center justify-center p-12 text-center">
					<EmptyIcon />
					<h3 class="text-lg font-semibold text-text mb-1">No GIFs yet</h3>
					<p class="text-sm text-text-muted mb-6">
						{isLoggedIn
							? "Be the first to upload a GIF!"
							: "Sign in to start sharing GIFs."}
					</p>
					{isLoggedIn ? (
						<a
							href="/upload"
							class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90"
						>
							Upload GIF
						</a>
					) : (
						<a
							href="/login"
							class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 no-underline"
						>
							Sign In
						</a>
					)}
				</div>
			)}

			{/* Load More Button */}
			{gifs.length > 0 && (
				<div class="text-center mt-8">
					<button
						type="button"
						class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-bg-surface text-text border border-border hover:bg-bg-surface-hover hover:border-brand-primary-light"
						id="load-more-btn"
					>
						<RefreshIcon />
						Load more jjal
					</button>
				</div>
			)}
		</Layout>
	);
};

// Helper function to get GIF URL from blob ref
function getGifUrl(gif: GifView): string {
	const did = gif.uri.split("/")[2];
	const ref = gif.file.ref as BlobRef;
	const cid = ref.$link || ref.link;
	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}

// Icons
const EmptyIcon = () => (
	<svg
		class="w-16 h-16 text-text-muted mb-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
	</svg>
);

const RefreshIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
		<path d="M21 3v5h-5" />
		<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
		<path d="M8 16H3v5" />
	</svg>
);

const LoadMoreScript = () => (
	<script
		dangerouslySetInnerHTML={{
			__html: `
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('load-more-btn');
            const grid = document.querySelector('.grid'); // detailed-gif-grid
            if (!btn || !grid) return;

            btn.addEventListener('click', async () => {
                const lastItem = grid.lastElementChild;
                // Find last created date from item or assume we track cursor?
                // Easier: find the last data-created-at attribute if we add it.
                // Or standard: parse from DOM?
                
                // Better approach: Store cursor in a data attribute on the grid or button?
                // But simplified: extract from last GIF Card?
                // Let's add data-created-at to GifCard or GridItem.
                
                // For now, let's grab the last card's data if possible.
                // Or better: keep track in JS variable?
                // Simplest: Query selector for last item with data-timestamp
                
                const items = document.querySelectorAll('[data-timestamp]');
                if (items.length === 0) return;
                const lastTimestamp = items[items.length - 1].getAttribute('data-timestamp');
                
                btn.disabled = true;
                btn.innerHTML = 'Loading...';
                
                try {
                    const res = await fetch(\`/api/feed?cursor=\${lastTimestamp}\`);
                    const data = await res.json();
                    
                    if (data.gifs && data.gifs.length > 0) {
                        data.gifs.forEach(gif => {
                           // Construct HTML string (Simple but repetitive)
                           // Or better: use a template?
                           // Since we are using Hono JSX SSR, client side rendering needs logic.
                           // Minimalist: just construct HTML string resembling GifCard.
                           
                           const div = document.createElement('div');
                           div.className = "aspect-square"; // Grid Item class
                           // ... (Ideally re-use component logic but client-side)
                           
                           // Simplified HTML construction:
                           const did = gif.uri.split('/')[2];
                           // Assuming gif.file contains necessary link info.
                           const cid = gif.cid; 
                           const blobUrl = \`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=\${encodeURIComponent(did)}&cid=\${cid}\`;
                           
                           div.innerHTML = \`
                             <div class="group relative w-full h-full bg-bg-surface-hover rounded-lg overflow-hidden border border-border transition-all hover:shadow-md hover:border-brand-primary/50" data-timestamp="\${gif.createdAt}">
                                <a href="/gif/\${gif.rkey}" class="block w-full h-full">
                                    <img 
                                        src="\${blobUrl}" 
                                        alt="\${gif.alt || gif.title}" 
                                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                                        <h3 class="text-white font-medium text-sm line-clamp-1">\${gif.title || 'Untitled'}</h3>
                                        <div class="flex items-center gap-1.5 mt-1">
                                            \${gif.authorAvatar ? \`<img src="\${gif.authorAvatar}" class="w-4 h-4 rounded-full bg-white/10" />\` : ''}
                                            <span class="text-white/80 text-xs truncate">@\${gif.authorHandle}</span>
                                        </div>
                                    </div>
                                </a>
                             </div>
                           \`;
                           // Note: wrapping div needs to match GifGridItem or GifGrid structure.
                           // Grid is: <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                           // Items are direct children.
                           
                           grid.appendChild(div.firstElementChild.parentElement ? div : div.firstElementChild); 
                           // wait, div created above is the wrapper? 
                           // "aspect-square" is on GifGridItem? No, let's check GifGridItem.
                        });
                        
                        // Scroll watcher for infinite scroll?
                        // Request said: "scroll to load 12 more".
                        // So I should implement IntersectionObserver.
                    } else {
                        btn.textContent = 'No more GIFs';
                        btn.style.display = 'none';
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    if (btn.innerText !== 'No more GIFs') {
                        btn.disabled = false;
                        btn.innerHTML = '<svg ...>...</svg> Load more jjal'; // Restore icon... lazy
                        btn.textContent = 'Load more jjal';
                    }
                }
            });
            
            // Intersection Observer for Infinite Scroll
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !btn.disabled) {
                    btn.click();
                }
            }, { rootMargin: '200px' });
            
            observer.observe(btn);
        });
    `,
		}}
	/>
);

export default function (props: HomePageProps) {
	return (
		<>
			<HomePage {...props} />
			<LoadMoreScript />
		</>
	);
}
