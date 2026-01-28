import type { FC } from "hono/jsx";

interface ProfileCardProps {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	description?: string;
	isVerified?: boolean;
	isOwnProfile?: boolean;
	isFollowing?: boolean;
}

export const ProfileCard: FC<ProfileCardProps> = ({
	did,
	handle,
	displayName,
	avatar,
	description,
	isVerified = false,
	isOwnProfile = false,
	isFollowing = false,
}) => {
	return (
		<div class="profile-card">
			{/* Avatar */}
			<div class={isVerified ? "profile-verified" : ""}>
				{avatar ? (
					<img
						src={avatar}
						alt={displayName || handle}
						class="profile-avatar"
					/>
				) : (
					<div class="profile-avatar-placeholder">👤</div>
				)}
			</div>

			{/* Name & Handle */}
			<h1 class="profile-name">{displayName || handle}</h1>
			<a
				href={`https://bsky.app/profile/${handle}`}
				target="_blank"
				rel="noopener noreferrer"
				class="profile-handle"
				style={{
					textDecoration: "none",
					display: "inline-block",
				}}
			>
				@{handle}
			</a>

			{/* Bio */}
			{description && <p class="profile-bio">{description}</p>}

			{/* Actions */
			!isOwnProfile && (
				<div class="profile-actions">
					<button
						type="button"
						class={`btn ${isFollowing ? "btn-secondary" : "btn-primary"}`}
						data-did={did}
					>
						{isFollowing ? (
							<>
								<CheckIcon />
								Following
							</>
						) : (
							<>
								<PlusIcon />
								Follow
							</>
						)}
					</button>
					<button type="button" class="btn btn-secondary">
						<MessageIcon />
						Message
					</button>
				</div>
			)}
		</div>
	);
};

// Helper function removed


// Icons
const PlusIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</svg>
);

const CheckIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<polyline points="20 6 9 17 4 12" />
	</svg>
);

const MessageIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M22 2 11 13" />
		<path d="M22 2 15 22l-4-9-9-4Z" />
	</svg>
);
