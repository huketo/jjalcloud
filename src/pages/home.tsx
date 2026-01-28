import type { FC } from "hono/jsx";
import { Layout, GifCard, GifGrid, GifGridItem } from "../components";
import type { GifView } from "../types/gif";

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
			{error && <div class="alert alert-error mb-lg">{error}</div>}

			{/* GIF Grid */}
			{gifs.length > 0 ? (
				<GifGrid>
					{gifs.map((gif) => (
						<GifGridItem key={gif.rkey}>
							<GifCard
								rkey={gif.rkey}
								title={gif.title}
								alt={gif.alt}
								tags={gif.tags}
								gifUrl={getGifUrl(gif)}
								authorDid={gif.authorDid}
								authorHandle={gif.authorHandle}
								authorAvatar={gif.authorAvatar}
								likeCount={
									gif.likeCount ||
									Math.floor(Math.random() * 1000)
								} // Mock data for UI
								isLiked={gif.isLiked}
							/>
						</GifGridItem>
					))}
				</GifGrid>
			) : (
				<div class="empty-state">
					<EmptyIcon />
					<h3 class="empty-state-title">No GIFs yet</h3>
					<p class="empty-state-text">
						{isLoggedIn
							? "Be the first to upload a GIF!"
							: "Sign in to start sharing GIFs."}
					</p>
					{isLoggedIn ? (
						<a href="/upload" class="btn btn-primary">
							Upload GIF
						</a>
					) : (
						<a href="/login" class="btn btn-primary">
							Sign In
						</a>
					)}
				</div>
			)}

			{/* Load More Button */}
			{gifs.length > 0 && (
				<div class="text-center mt-xl">
					<button
						type="button"
						class="btn btn-secondary"
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
	const cid = (gif.file.ref as any).$link || (gif.file.ref as any).link;
	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}

// Icons
const EmptyIcon = () => (
	<svg
		class="empty-state-icon"
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

export default HomePage;
