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
			showFooter={false}
			avatarUrl={avatarUrl}
		>
			{/* Breadcrumb */}
			<nav class="detail-breadcrumb">
				<a href="/">← Feed</a>
				<span>•</span>
				<span>Detail View</span>
			</nav>

			{/* Main Card */}
			<article class="detail-card">
				<div class="detail-main-layout">
					{/* GIF Image */}
					<div class="detail-image-container">
						<img
							src={gifUrl}
							alt={gif.alt || gif.title || "GIF"}
							class="detail-image"
						/>
					</div>

					{/* Action Buttons (Right Sidebar) */}
					<div class="detail-actions-sidebar">
						<button
							type="button"
							class={`detail-action-btn ${gif.isLiked ? "liked" : ""}`}
							id="like-btn"
							data-gif-uri={gif.uri}
						>
							<HeartIcon filled={gif.isLiked} />
							<span>Favorite</span>
						</button>

						<button type="button" class="detail-action-btn" id="copy-link-btn">
							<LinkIcon />
							<span>Copy Link</span>
						</button>

						<button type="button" class="detail-action-btn" id="download-btn">
							<DownloadIcon />
							<span>Download</span>
						</button>
					</div>
				</div>

				{/* Content */}
				<div class="detail-content">
					{/* Title */}
					<h1 class="detail-title">{gif.title || "Untitled"}</h1>

					{/* Description */}
					{gif.alt && <p class="detail-description">{gif.alt}</p>}

					{/* Tags */}
					{gif.tags && gif.tags.length > 0 && (
						<div class="tags" style={{ marginBottom: "var(--spacing-md)" }}>
							{gif.tags.map((tag) => (
								<a
									key={tag}
									href={`/search?q=${encodeURIComponent(tag)}`}
									class="tag"
								>
									#{tag}
								</a>
							))}
						</div>
					)}

					{/* Author */}
					<div class="detail-author">
						{gif.authorAvatar ? (
							<img
								src={gif.authorAvatar}
								alt={gif.authorHandle || "User"}
								class="detail-author-avatar"
							/>
						) : (
							<div
								class="detail-author-avatar"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "var(--color-primary-pale)",
									color: "var(--color-primary)",
									fontSize: "14px",
								}}
							>
								👤
							</div>
						)}
						<div class="detail-author-info">
							<a href={profileUrl} class="detail-author-name">
								@{gif.authorHandle || "unknown"}
							</a>
						</div>
					</div>
				</div>
			</article>

			{/* Related GIFs */}
			{relatedGifs.length > 0 && (
				<section class="related-section">
					<div class="related-header">
						<h2 class="related-title">More Soft Vibes</h2>
						<a href="/" class="related-more">
							VIEW ALL
						</a>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(2, 1fr)",
							gap: "var(--spacing-md)",
						}}
					>
						{relatedGifs.slice(0, 4).map((relatedGif) => (
							<a
								key={relatedGif.rkey}
								href={`/gif/${relatedGif.rkey}`}
								class="card card-interactive"
								style={{ overflow: "hidden" }}
							>
								<img
									src={getGifUrl(relatedGif)}
									alt={
										relatedGif.alt ||
										relatedGif.title ||
										"GIF"
									}
									style={{
										width: "100%",
										aspectRatio: "1",
										objectFit: "cover",
									}}
									loading="lazy"
								/>
								<div style={{ padding: "var(--spacing-sm)" }}>
									<div
										style={{
											fontSize: "var(--font-size-sm)",
											fontWeight: 500,
											color: "var(--color-text)",
										}}
									>
										{relatedGif.title || "Untitled"}
									</div>
									<div
										style={{
											fontSize: "var(--font-size-xs)",
											color: "var(--color-text-muted)",
										}}
									>
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
const HeartIcon: FC<{ filled?: boolean }> = ({ filled }) => (
	<svg
		viewBox="0 0 24 24"
		fill={filled ? "currentColor" : "none"}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</svg>
);

const LinkIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
	</svg>
);

const DownloadIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="7 10 12 15 17 10" />
		<line x1="12" x2="12" y1="15" y2="3" />
	</svg>
);

export default DetailPage;
