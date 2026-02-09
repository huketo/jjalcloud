import type { FC } from "hono/jsx";
import { pickPastelColor } from "../../utils/helpers";
import { LikeButton } from "./LikeButton";

interface GifCardProps {
	rkey: string;
	cid: string;
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
	width?: number;
	height?: number;
	index?: number;
}

export const GifCard: FC<GifCardProps> = ({
	rkey,
	cid,
	title,
	alt,
	tags: _tags = [],
	gifUrl,
	authorDid,
	authorHandle,
	authorAvatar,
	likeCount = 0,
	isLiked = false,
	isTrending = false,
	createdAt: _createdAt,
	showAuthor = true,
	showActions = true,
	width,
	height,
	index,
}) => {
	const detailUrl = `/gif/${rkey}`;
	const profileUrl = authorDid ? `/profile/${authorDid}` : "#";
	const placeholderColor = pickPastelColor(rkey);

	return (
		<article class="group relative bg-bg-surface rounded-lg overflow-hidden shadow-card transition-all duration-300 md:hover:shadow-lg">
			<a href={detailUrl} class="block w-full relative z-1">
				<img
					src={gifUrl}
					alt={alt || title || "GIF"}
					class="w-full block h-auto object-cover text-transparent"
					loading="lazy"
					decoding="async"
					fetchpriority={index !== undefined && index < 4 ? "high" : "low"}
					style={{
						aspectRatio: width && height ? `${width} / ${height}` : "4 / 3",
						backgroundColor: placeholderColor,
					}}
				/>
			</a>

			{isTrending && (
				<div class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2 py-0.5 text-xs font-medium text-brand-primary shadow-sm z-10">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="w-3 h-3"
					>
						<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
						<polyline points="16 7 22 7 22 13" />
					</svg>
					<span>Trending</span>
				</div>
			)}

			<div class="absolute inset-0 z-5 bg-gradient-to-t from-brand-primary-dark/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 hidden md:flex flex-col justify-end pointer-events-none md:group-hover:opacity-100 backdrop-blur-[2px]">
				<div class="flex items-center justify-between w-full gap-2">
					{showAuthor && (
						<div class="pointer-events-auto">
							<a
								href={profileUrl}
								class="flex items-center gap-2 text-text-inverse no-underline font-medium text-sm transition-opacity duration-150 hover:opacity-80 drop-shadow-md"
							>
								{authorAvatar ? (
									<img
										src={authorAvatar}
										alt={authorHandle || "User"}
										class="w-6 h-6 rounded-full object-cover border border-white/70"
									/>
								) : (
									<div class="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs text-white">
										👤
									</div>
								)}
								<span class="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap pt-[2px]">
									{authorHandle || "Unknown"}
								</span>
							</a>
						</div>
					)}

					<div class="flex items-center gap-1 pointer-events-auto">
						{showActions && (
							<>
								<LikeButton
									count={likeCount}
									isLiked={isLiked}
									size="sm"
									gifUri={`at://${authorDid}/com.jjalcloud.feed.gif/${rkey}`}
									gifCid={cid}
									showCount={false}
									variant="glass"
								/>
								<button
									type="button"
									class="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 backdrop-blur-md border border-white/20 bg-black/30 hover:scale-105 active:scale-95 text-white copy-btn"
									data-copy-text={gifUrl}
									data-copy-message="✅ Link copied to clipboard!"
									aria-label="Copy Link"
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
		class="w-4.5 h-4.5"
	>
		<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
		<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
	</svg>
);
