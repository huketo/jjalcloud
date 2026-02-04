import type { FC } from "hono/jsx";
import { Layout } from "../components";
import type { GifView } from "../types/gif";

interface DetailPageProps {
	isLoggedIn: boolean;
	isOwner?: boolean;
	gif: GifViewWithAuthor;
	relatedGifs?: GifViewWithAuthor[];
	avatarUrl?: string;
}

interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	authorDisplayName?: string;
	commentCount?: number;
}

export const DetailPage: FC<DetailPageProps> = ({
	isLoggedIn,
	isOwner = false,
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
			<div class="max-w-5xl mx-auto px-4 py-8 md:py-12">
				{/* Main Layout: Uploader | GIF | Actions */}
				<div class="flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-12">
					{/* 1. Left: Uploader Info (Desktop: Left, Mobile: Top/Order 2) */}
					<div class="hidden md:flex flex-col items-center gap-3 w-40 flex-shrink-0 sticky top-24">
						<a
							href={profileUrl}
							class="group flex flex-col items-center gap-3 text-center"
						>
							{gif.authorAvatar ? (
								<img
									src={gif.authorAvatar}
									alt={gif.authorHandle || "User"}
									class="w-20 h-20 rounded-full object-cover shadow-sm transition-transform group-hover:scale-105"
								/>
							) : (
								<div class="w-20 h-20 rounded-full bg-brand-primary-pale flex items-center justify-center text-brand-primary font-bold text-2xl">
									{(gif.authorHandle || "U")[0].toUpperCase()}
								</div>
							)}
							<div class="flex flex-col">
								<span class="text-lg font-bold text-text group-hover:text-brand-primary transition-colors">
									@{gif.authorHandle || "unknown"}
								</span>
								{gif.authorDisplayName && (
									<span class="text-sm text-text-muted">
										{gif.authorDisplayName}
									</span>
								)}
							</div>
						</a>
					</div>

					{/* 2. Center: GIF Image & Info */}
					<div class="relative flex-1 flex flex-col w-full md:max-w-4xl order-first md:order-none pb-12">
						<div class="flex justify-center w-full mb-6">
							<img
								src={gifUrl}
								alt={gif.alt || gif.title || "GIF"}
								class="max-w-full max-h-[75vh] object-contain block rounded-lg shadow-sm"
							/>
						</div>

						{/* Tags (Left aligned, No underline) */}
						{gif.tags && gif.tags.length > 0 && (
							<div class="flex flex-wrap justify-start gap-2 mb-4">
								{gif.tags.map((tag) => (
									<a
										key={tag}
										href={`/search?q=${encodeURIComponent(tag)}`}
										class="px-4 py-1.5 bg-bg-surface-hover text-text font-medium rounded-full text-sm transition-all hover:bg-brand-primary hover:text-white decoration-none"
									>
										#{tag}
									</a>
								))}
							</div>
						)}

						{/* Title */}
						<h1 class="text-2xl md:text-3xl font-bold text-text mb-2 leading-tight text-left">
							{gif.title || "Untitled"}
						</h1>

						{/* Description */}
						{gif.alt && (
							<p class="text-base text-text-secondary leading-relaxed whitespace-pre-line max-w-2xl text-left">
								{gif.alt}
							</p>
						)}
					</div>

					{/* Mobile Uploader Info (Visible only on mobile) */}
					<div class="flex md:hidden items-center gap-3 w-full">
						<a href={profileUrl} class="flex items-center gap-3">
							{gif.authorAvatar ? (
								<img
									src={gif.authorAvatar}
									alt={gif.authorHandle || "User"}
									class="w-10 h-10 rounded-full object-cover"
								/>
							) : (
								<div class="w-10 h-10 rounded-full bg-brand-primary-pale flex items-center justify-center text-brand-primary font-bold">
									{(gif.authorHandle || "U")[0].toUpperCase()}
								</div>
							)}
							<div class="font-bold text-text">
								@{gif.authorHandle || "unknown"}
							</div>
						</a>
					</div>

					{/* 3. Right: Actions */}
					<div class="w-full md:w-40 flex-shrink-0 sticky top-24">
						<div
							id="detail-actions-root"
							data-props={JSON.stringify({
								gifUrl: gifUrl,
								gifUri: gif.uri,
								gifCid: gif.cid,
								gifTitle: gif.title || "Untitled",
								isLiked: gif.isLiked || false,
								isOwner: isOwner,
								rkey: gif.rkey,
							})}
						>
							<div class="flex flex-row md:flex-col gap-2 w-full md:w-auto">
								<button
									type="button"
									class="group flex items-center gap-3 py-2 text-text-secondary transition-colors md:justify-start"
								>
									<HeartIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
									<span class="font-medium">Favorite</span>
								</button>
								<button
									type="button"
									class="group flex items-center gap-3 py-2 text-text-secondary transition-colors md:justify-start"
								>
									<LinkIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
									<span class="font-medium">Copy Link</span>
								</button>
								<button
									type="button"
									class="group flex items-center gap-3 py-2 text-text-secondary transition-colors md:justify-start"
								>
									<DownloadIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
									<span class="font-medium">Download</span>
								</button>
								{/* Edit button handled by Island if owner */}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Related GIFs */}
			{relatedGifs.length > 0 && (
				<section class="mt-16 border-t border-border-light pt-12 px-4 md:px-8 max-w-7xl mx-auto">
					<div class="flex items-center justify-between mb-8">
						<h2 class="text-xl font-bold text-text">More Like This</h2>
						<a
							href="/"
							class="text-sm font-medium text-brand-primary hover:text-brand-primary-dark transition-colors"
						>
							VIEW ALL
						</a>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
						{relatedGifs.slice(0, 4).map((relatedGif) => (
							<a
								key={relatedGif.rkey}
								href={`/gif/${relatedGif.rkey}`}
								class="group relative bg-bg-surface rounded-2xl overflow-hidden shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 block"
							>
								<div class="aspect-square w-full overflow-hidden bg-bg-surface-hover">
									<img
										src={getGifUrl(relatedGif)}
										alt={relatedGif.title || "GIF"}
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
										loading="lazy"
									/>
								</div>
								<div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
									<div class="text-white font-medium truncate">
										{relatedGif.title || "Untitled"}
									</div>
									<div class="text-white/80 text-xs truncate">
										@{relatedGif.authorHandle || "unknown"}
									</div>
								</div>
							</a>
						))}
					</div>
				</section>
			)}
		</Layout>
	);
};

// Helper functions
function getGifUrl(gif: GifView): string {
	const did = gif.uri.split("/")[2];
	const ref = gif.file.ref as unknown as { $link?: string; link?: string };
	const cid = ref.$link || ref.link;
	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}

function _formatNumber(num: number): string {
	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return num.toString();
}

// Icons
const HeartIcon: FC<{ filled?: boolean; className?: string }> = ({
	filled,
	className,
}) => (
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

const _EditIcon: FC<{ className?: string }> = ({ className }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={className}
	>
		<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
		<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
	</svg>
);

export default DetailPage;
