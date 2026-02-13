import type { FC } from "hono/jsx";
import {
	GifCard,
	GifGrid,
	GifGridItem,
	Layout,
	ProfileCard,
} from "../components";
import type { GifView } from "../types/gif";
import { getGifUrl } from "../utils";

interface ProfilePageProps {
	isLoggedIn: boolean;
	isOwnProfile: boolean;
	profile: ProfileData;
	gifs: GifViewWithAuthor[];
}

interface ProfileData {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	description?: string;

	isFollowing?: boolean;
}

interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
}

export const ProfilePage: FC<ProfilePageProps> = ({
	isLoggedIn,
	isOwnProfile,
	profile,

	gifs,
}) => {
	return (
		<Layout
			isLoggedIn={isLoggedIn}
			activeTab="profile"
			showBack={!isOwnProfile}
			title={!isOwnProfile ? "jjalcloud" : undefined}
			avatarUrl={isOwnProfile ? profile.avatar : undefined}
		>
			{/* Profile Card */}
			<div class="bg-bg-surface rounded-xl shadow-card overflow-hidden mb-6">
				<ProfileCard
					did={profile.did}
					handle={profile.handle}
					displayName={profile.displayName}
					avatar={profile.avatar}
					description={profile.description}
					isOwnProfile={isOwnProfile}
					isFollowing={profile.isFollowing}
				/>
			</div>

			{/* Tabs removed, only showing Collection */}

			<GifCollectionTab gifs={gifs} profile={profile} />
		</Layout>
	);
};

// Sub-components
const GifCollectionTab: FC<{
	gifs: GifViewWithAuthor[];
	profile: ProfileData;
	emptyText?: string;
}> = ({ gifs, profile, emptyText = "No GIFs uploaded yet" }) => {
	if (gifs.length === 0) {
		return (
			<div class="flex flex-col items-center justify-center p-12 text-center">
				<EmptyIcon />
				<h3 class="text-lg font-semibold text-text mb-1">{emptyText}</h3>
				<p class="text-sm text-text-muted mb-6">
					Start uploading to build your collection.
				</p>
			</div>
		);
	}

	return (
		<GifGrid>
			{gifs.map((gif, index) => (
				<GifGridItem key={gif.rkey}>
					<GifCard
						rkey={gif.rkey}
						cid={gif.cid}
						title={gif.title}
						alt={gif.alt}
						tags={gif.tags}
						gifUrl={getGifUrl(gif)}
						authorDid={profile.did}
						authorHandle={profile.handle}
						authorAvatar={profile.avatar}
						likeCount={gif.likeCount ?? 0}
						isLiked={gif.isLiked}
						showActions
						index={index}
						width={gif.width}
						height={gif.height}
					/>
				</GifGridItem>
			))}
		</GifGrid>
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

export default ProfilePage;
