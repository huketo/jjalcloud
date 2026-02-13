import type { FC } from "hono/jsx";
import { GifCard, GifGrid, GifGridItem, Layout } from "../components";
import type { GifView } from "../types/gif";
import { getGifUrl } from "../utils";

interface HomePageProps {
	isLoggedIn: boolean;
	gifs: GifViewWithAuthor[];
	error?: string;
	avatarUrl?: string;
	activeTab?: string;
	searchQuery?: string;
}

interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
}

export const HomePage: FC<HomePageProps> = ({
	isLoggedIn,
	gifs,
	error,
	avatarUrl,
	searchQuery,
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
					{gifs.map((gif, index) => (
						<GifGridItem
							key={gif.rkey}
							passedProps={{ "data-timestamp": gif.createdAt }}
						>
							<GifCard
								rkey={gif.rkey}
								cid={gif.cid}
								title={gif.title}
								alt={gif.alt}
								tags={gif.tags}
								gifUrl={getGifUrl(gif)}
								authorDid={gif.authorDid}
								authorHandle={gif.authorHandle}
								authorAvatar={gif.authorAvatar}
								likeCount={gif.likeCount ?? 0}
								isLiked={gif.isLiked}
								index={index}
								width={gif.width}
								height={gif.height}
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
							class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 no-underline"
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

			{/* Infinite Scroll Island */}
			{gifs.length > 0 && (
				<div
					id="infinite-scroll-root"
					data-props={JSON.stringify({
						initialCount: gifs.length,
						searchQuery,
					})}
				/>
			)}
		</Layout>
	);
};

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
		aria-hidden="true"
	>
		<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
	</svg>
);
