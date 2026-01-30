import type { FC } from "hono/jsx";

// Heart Icons
const HeartOutlineIcon = () => (
	<svg
		class="like-icon w-full h-full"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</svg>
);

const HeartFilledIcon = () => (
	<svg
		class="like-icon w-full h-full"
		viewBox="0 0 24 24"
		fill="currentColor"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</svg>
);

interface LikeButtonProps {
	count?: number;
	isLiked?: boolean;
	size?: "sm" | "md" | "lg";
	showCount?: boolean;
	gifUri?: string;
	gifCid?: string;
	variant?: "default" | "glass";
}

export const LikeButton: FC<LikeButtonProps> = ({
	count = 0,
	isLiked = false,
	size = "md",
	showCount = true,
	gifUri,
	gifCid,
	variant = "default",
}) => {
	const sizeClasses = {
		sm: { icon: "w-4 h-4", font: "text-xs" },
		md: { icon: "w-5 h-5", font: "text-sm" },
		lg: { icon: "w-7 h-7", font: "text-base" },
	};

	const { icon: iconClass, font: fontClass } = sizeClasses[size];

	if (variant === "glass") {
		return (
			<button
				type="button"
				class={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 backdrop-blur-md border border-white/20 bg-black/30 hover:scale-105 active:scale-95 ${
					isLiked ? "text-status-like" : "text-white"
				} like-btn`}
				data-gif-uri={gifUri}
				data-gif-cid={gifCid}
				aria-label={isLiked ? "Unlike" : "Like"}
			>
				<span class="flex items-center justify-center w-5 h-5">
					<HeartFilledIcon />
				</span>
			</button>
		);
	}

	return (
		<button
			type="button"
			class={`flex items-center gap-1 px-1.5 py-1 rounded-full transition-all duration-150 hover:text-status-like hover:bg-status-like/10 ${
				isLiked ? "text-status-like-active" : "text-text-muted"
			} like-btn`}
			data-gif-uri={gifUri}
			data-gif-cid={gifCid}
			aria-label={isLiked ? "Unlike" : "Like"}
		>
			<span class={`flex items-center justify-center ${iconClass}`}>
				{isLiked ? <HeartFilledIcon /> : <HeartOutlineIcon />}
			</span>
			{showCount && (
				<span class={`font-medium ${fontClass}`}>{formatCount(count)}</span>
			)}
		</button>
	);
};

// 숫자 포맷팅 (1000 -> 1k, 1000000 -> 1M)
function formatCount(num: number): string {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
	}
	return num.toString();
}
