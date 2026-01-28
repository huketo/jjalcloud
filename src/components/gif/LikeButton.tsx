import type { FC } from "hono/jsx";

// Heart Icons
const HeartOutlineIcon = () => (
	<svg
		class="like-icon"
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
		class="like-icon"
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
}

export const LikeButton: FC<LikeButtonProps> = ({
	count = 0,
	isLiked = false,
	size = "md",
	showCount = true,
	gifUri,
}) => {
	const sizeStyles: Record<string, { icon: string; font: string }> = {
		sm: { icon: "16px", font: "var(--font-size-xs)" },
		md: { icon: "20px", font: "var(--font-size-sm)" },
		lg: { icon: "28px", font: "var(--font-size-base)" },
	};

	const { icon, font } = sizeStyles[size];

	return (
		<button
			type="button"
			class={`like-btn ${isLiked ? "liked" : ""}`}
			data-gif-uri={gifUri}
			aria-label={isLiked ? "좋아요 취소" : "좋아요"}
			style={{
				"--icon-size": icon,
			}}
		>
			<span style={{ width: icon, height: icon, display: "flex" }}>
				{isLiked ? <HeartFilledIcon /> : <HeartOutlineIcon />}
			</span>
			{showCount && (
				<span class="like-count" style={{ fontSize: font }}>
					{formatCount(count)}
				</span>
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
