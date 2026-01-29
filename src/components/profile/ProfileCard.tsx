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
		<div class="flex flex-col items-center p-8 text-center bg-bg-surface rounded-2xl shadow-card">
			{/* Avatar */}
			<div class="relative mb-4">
				{avatar ? (
					<img
						src={avatar}
						alt={displayName || handle}
						class="w-24 h-24 rounded-full object-cover border-[3px] border-brand-primary-light shadow-md block"
					/>
				) : (
					<div class="w-24 h-24 rounded-full bg-gradient-to-br from-brand-primary-pale to-brand-primary-light flex items-center justify-center text-3xl mb-4 border-[3px] border-brand-primary-light">👤</div>
				)}
				{isVerified && (
					<div class="absolute bottom-0 right-0 w-6 h-6 bg-brand-primary text-text-inverse rounded-full flex items-center justify-center text-xs border-2 border-bg-surface">
						✓
					</div>
				)}
			</div>

			{/* Name & Handle */}
			<h1 class="text-2xl font-bold text-text mb-1 mt-0">{displayName || handle}</h1>
			<a
				href={`https://bsky.app/profile/${handle}`}
				target="_blank"
				rel="noopener noreferrer"
				class="text-brand-primary font-medium hover:text-brand-primary-dark mb-4 text-sm no-underline inline-block"
			>
				@{handle}
			</a>

			{/* Bio */}
			{description && <p class="text-sm text-text-secondary max-w-xs mb-3 leading-normal">{description}</p>}

			{/* Actions */}
			{!isOwnProfile && (
				<div class="flex gap-2 w-full max-w-xs">
					<button
						type="button"
						class={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-md transition-all shadow-sm hover:shadow-md hover:opacity-90 ${
							isFollowing 
							? "bg-bg-surface text-text border border-border hover:bg-bg-surface-hover hover:border-brand-primary-light" 
							: "bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse"
						}`}
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
					<button 
						type="button" 
						class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-md transition-all bg-bg-surface text-text border border-border hover:bg-bg-surface-hover hover:border-brand-primary-light"
					>
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
