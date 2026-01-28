import type { FC } from "hono/jsx";
import { LikeButton } from "./LikeButton";

interface GifCardProps {
	rkey: string;
	title?: string;
	alt?: string;
	tags?: string[];
	gifUrl: string;
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	likeCount?: number;
	isLiked?: boolean;
	isTrending?: boolean;
	createdAt?: string;
	showAuthor?: boolean;
	showActions?: boolean;
}

export const GifCard: FC<GifCardProps> = ({
	rkey,
	title,
	alt,
	tags = [],
	gifUrl,
	authorDid,
	authorHandle,
	authorAvatar,
	likeCount = 0,
	isLiked = false,
	isTrending = false,
	createdAt,
	showAuthor = true,
	showActions = true,
}) => {
	const detailUrl = `/gif/${rkey}`;
	const profileUrl = authorDid ? `/profile/${authorDid}` : "#";
	
	// Copy functionality script (needs to be handled globally or inline since this is SSR)
	// We'll add a specific class for the global handler to pick up, or use a tiny inline onclick if allowed.
	// For now, I'll add a data attribute `data-copy-text` with the full URL.
	// Assuming the app has a base URL, but we'll use relative or constructing it if possible.
	// Since we don't have the base URL here, we'll try to use a relative path resolved by client or just copy the path.
	// A better UX is copying the full link. I'll leave the data attribute for a handler to use `window.location.origin + ...`
	
	return (
		<article class="gif-card">
			<a href={detailUrl} class="gif-card-link">
				<img
					src={gifUrl}
					alt={alt || title || "GIF"}
					class="gif-card-image"
					loading="lazy"
				/>
			</a>

			{isTrending && (
				<div class="gif-card-badge">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						style={{ width: "12px", height: "12px" }}
					>
						<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
						<polyline points="16 7 22 7 22 13" />
					</svg>
					<span>Trending</span>
				</div>
			)}

			<div class="gif-card-overlay">
				<div class="gif-card-overlay-content">
					{showAuthor && (
						<div class="gif-card-uploader">
							<a href={profileUrl} class="uploader-link">
								{authorAvatar ? (
									<img
										src={authorAvatar}
										alt={authorHandle || "User"}
										class="uploader-avatar"
									/>
								) : (
									<div class="uploader-avatar-placeholder">👤</div>
								)}
								<span class="uploader-name">{authorHandle || "Unknown"}</span>
							</a>
						</div>
					)}
					
					<div class="gif-card-interactions">
						{showActions && (
							<>
								<LikeButton
									count={likeCount}
									isLiked={isLiked}
									size="sm"
									gifUri={`at://${authorDid}/com.jjalcloud.feed.gif/${rkey}`}
									showCount={true} 
								/>
								<button 
									type="button" 
									class="action-btn copy-btn"
									data-link={gifUrl}
									aria-label="링크 복사"
									onclick={`
										window.copyToClipboard('${gifUrl}', 'JJal link copied to clipboard!');
										event.stopPropagation();
										event.preventDefault();
									`}
								>
									<CopyIcon />
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</article>
	);
};

const CopyIcon = () => (
	<svg 
		viewBox="0 0 24 24" 
		fill="none" 
		stroke="currentColor" 
		stroke-width="2" 
		stroke-linecap="round" 
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
		<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
	</svg>
);
