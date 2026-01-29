import type { FC } from "hono/jsx";
import {
	Layout,
	LikeButton,
	GifCard,
	GifGrid,
	GifGridItem,
} from "../components";
import type { GifView } from "../types/gif";

interface DetailPageProps {
	isLoggedIn: boolean;
	gif: GifViewWithAuthor;
	relatedGifs?: GifViewWithAuthor[];
	avatarUrl?: string;
}

interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	authorDisplayName?: string;
	likeCount?: number;
	isLiked?: boolean;
}


export const DetailPage: FC<DetailPageProps> = ({
	isLoggedIn,
	gif,
	relatedGifs = [],
	avatarUrl,
}) => {
	const gifUrl = getGifUrl(gif);
	const profileUrl = gif.authorDid ? `/profile/${gif.authorDid}` : "#";

	return (
		<Layout
			isLoggedIn={isLoggedIn}
			showBack
			title="jjalcloud"
			avatarUrl={avatarUrl}
		>
			{/* Breadcrumb */}
			<nav class="flex items-center gap-2 text-sm text-text-muted mb-6">
				<a href="/" class="hover:text-brand-primary transition-colors">← Feed</a>
				<span>•</span>
				<span>Detail View</span>
			</nav>

			{/* Main Card */}
			<article class="bg-transparent shadow-none rounded-none overflow-visible">
				<div class="flex flex-col gap-6 md:grid md:grid-cols-[1fr_240px] md:gap-8 md:items-start">
					{/* GIF Image */}
					<div class="flex items-start justify-center w-full md:justify-center bg-transparent">
						<img
							src={gifUrl}
							alt={gif.alt || gif.title || "GIF"}
							class="max-w-full max-h-[70vh] object-contain block rounded-2xl shadow-lg"
						/>
					</div>

					{/* Action Buttons (Right Sidebar) */}
					<div class="flex flex-row items-center justify-start gap-4 py-4 bg-transparent border-b border-border-light md:flex-col md:w-full md:border-none md:p-0 md:sticky md:top-[calc(60px+1.5rem)]">
						<button
							type="button"
							class={`flex items-center gap-2 px-6 py-2 font-medium rounded-full transition-all shadow-sm hover:text-brand-primary md:w-full md:justify-start md:shadow-none md:rounded-xl md:p-4 md:hover:bg-bg-surface md:hover:shadow-sm md:hover:-translate-y-px ${
								gif.isLiked 
								? "text-status-like-active bg-bg-surface md:bg-transparent" 
								: "text-text-secondary bg-bg-surface hover:bg-bg-surface-hover md:bg-transparent"
							}`}
							id="like-btn"
							data-gif-uri={gif.uri}
						>
							<HeartIcon filled={gif.isLiked} className="w-5 h-5" />
							<span>Favorite</span>
						</button>

						<button 
							type="button" 
							class="flex items-center gap-2 px-6 py-2 text-text-secondary font-medium rounded-full transition-all bg-bg-surface shadow-sm hover:text-brand-primary hover:bg-bg-surface-hover md:w-full md:justify-start md:bg-transparent md:shadow-none md:rounded-xl md:p-4 md:hover:bg-bg-surface md:hover:shadow-sm md:hover:-translate-y-px" 
							id="copy-link-btn"
						>
							<LinkIcon className="w-5 h-5" />
							<span>Copy Link</span>
						</button>

						<button 
							type="button" 
							class="flex items-center gap-2 px-6 py-2 text-text-secondary font-medium rounded-full transition-all bg-bg-surface shadow-sm hover:text-brand-primary hover:bg-bg-surface-hover md:w-full md:justify-start md:bg-transparent md:shadow-none md:rounded-xl md:p-4 md:hover:bg-bg-surface md:hover:shadow-sm md:hover:-translate-y-px" 
							id="download-btn"
						>
							<DownloadIcon className="w-5 h-5" />
							<span>Download</span>
						</button>
					</div>
				</div>

				{/* Content */}
				<div class="p-6">
					{/* Title */}
					<h1 class="text-2xl font-bold text-text mb-2">{gif.title || "Untitled"}</h1>

					{/* Description */}
					{gif.alt && <p class="text-base text-text-secondary leading-relaxed mb-6">{gif.alt}</p>}

					{/* Tags */}
					{gif.tags && gif.tags.length > 0 && (
						<div class="flex flex-wrap gap-1 mb-4">
							{gif.tags.map((tag) => (
								<a
									key={tag}
									href={`/search?q=${encodeURIComponent(tag)}`}
									class="px-3 py-1 bg-brand-primary-pale text-brand-primary rounded-full text-xs font-medium transition-colors hover:bg-brand-primary-light hover:text-text-inverse"
								>
									#{tag}
								</a>
							))}
						</div>
					)}

					{/* Author */}
					<div class="flex items-center gap-2 mb-4">
						{gif.authorAvatar ? (
							<img
								src={gif.authorAvatar}
								alt={gif.authorHandle || "User"}
								class="w-8 h-8 rounded-full object-cover"
							/>
						) : (
							<div class="w-8 h-8 rounded-full bg-brand-primary-pale flex items-center justify-center text-brand-primary text-sm">
								👤
							</div>
						)}
						<div class="flex items-center gap-2">
							<a href={profileUrl} class="text-sm font-medium text-brand-primary hover:underline">
								@{gif.authorHandle || "unknown"}
							</a>
						</div>
					</div>
				</div>
			</article>

			{/* Related GIFs */}
			{relatedGifs.length > 0 && (
				<section class="mt-8">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-semibold text-text">More Soft Vibes</h2>
						<a href="/" class="text-sm font-medium text-brand-primary hover:text-brand-primary-dark">
							VIEW ALL
						</a>
					</div>

					<div class="grid grid-cols-2 gap-4">
						{relatedGifs.slice(0, 4).map((relatedGif) => (
							<a
								key={relatedGif.rkey}
								href={`/gif/${relatedGif.rkey}`}
								class="bg-bg-surface rounded-xl overflow-hidden shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
							>
								<img
									src={getGifUrl(relatedGif)}
									alt={
										relatedGif.alt ||
										relatedGif.title ||
										"GIF"
									}
									class="w-full aspect-square object-cover"
									loading="lazy"
								/>
								<div class="p-2">
									<div class="text-sm font-medium text-text truncate">
										{relatedGif.title || "Untitled"}
									</div>
									<div class="text-xs text-text-muted truncate">
										@{relatedGif.authorHandle || "unknown"}
									</div>
								</div>
							</a>
						))}
					</div>
				</section>
			)}

			{/* Client-side scripts */}
			<script
				dangerouslySetInnerHTML={{
					__html: `
						// Copy Link functionality
						document.getElementById('copy-link-btn')?.addEventListener('click', async () => {
							const img = document.querySelector('.detail-image');
							if (!img) return;
							
							const url = img.src;
							// Use global copyToClipboard if available, otherwise fallback
							if (window.copyToClipboard) {
								window.copyToClipboard(url, 'JJal link copied to clipboard!');
							} else {
								try {
									await navigator.clipboard.writeText(url);
									alert('JJal link copied to clipboard!');
								} catch (err) {
									console.error('Failed to copy link', err);
								}
							}
						});

						// Download functionality
						document.getElementById('download-btn')?.addEventListener('click', async () => {
							const img = document.querySelector('.detail-image');
							if (!img) return;
							
							const src = img.src;
							try {
								// Attempt to fetch and download as blob
								const response = await fetch(src);
								const blob = await response.blob();
								const url = window.URL.createObjectURL(blob);
								const a = document.createElement('a');
								a.href = url;
								a.download = 'jjalcloud_' + Date.now() + '.gif';
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								window.URL.revokeObjectURL(url);
							} catch (e) {
								// Fallback to opening in new tab
								window.open(src, '_blank');
							}
						});

						// Like button animation (UI only)
						document.getElementById('like-btn')?.addEventListener('click', function() {
							this.classList.toggle('liked');
							// No longer updating count text as it's just "Favorite" label now
						});
					`,
				}}
			/>
		</Layout>
	);
};

// Helper functions
function getGifUrl(gif: GifView): string {
	const did = gif.uri.split("/")[2];
	const cid = (gif.file.ref as any).$link || (gif.file.ref as any).link;
	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}

function formatNumber(num: number): string {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
	}
	return num.toString();
}



// Icons
const HeartIcon: FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
	<svg
		viewBox="0 0 24 24"
		fill={filled ? "currentColor" : "none"}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={className}
	>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</svg>
);

const LinkIcon: FC<{ className?: string }> = ({ className }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={className}
	>
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
	</svg>
);

const DownloadIcon: FC<{ className?: string }> = ({ className }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={className}
	>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="7 10 12 15 17 10" />
		<line x1="12" x2="12" y1="15" y2="3" />
	</svg>
);

export default DetailPage;
