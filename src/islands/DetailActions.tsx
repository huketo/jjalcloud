/** @jsxImportSource hono/jsx/dom */
import { useState } from "hono/jsx";
import { showToast } from "../components/ui/Toast";

interface DetailActionsProps {
	gifUrl: string;
	gifTitle: string;
	gifUri?: string;
	gifCid?: string;
	isLiked?: boolean; // Currently UI only for this Demo
	isOwner?: boolean;
	rkey?: string;
}

export const DetailActions = ({
	gifUrl,
	// gifTitle,
	gifUri,
	gifCid,
	isLiked: initialIsLiked = false,
	isOwner = false,
	rkey,
}: DetailActionsProps) => {
	const [isLiked, setIsLiked] = useState(initialIsLiked);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(gifUrl);
			showToast("✅ Link copied to clipboard!");
		} catch (e) {
			console.error(e);
			showToast("Failed to copy link", "error");
		}
	};

	const handleDownload = async () => {
		try {
			const response = await fetch(gifUrl);
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `jjalcloud_${Date.now()}.gif`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			showToast("Download started!");
		} catch (e) {
			console.error(e);
			window.open(gifUrl, "_blank");
		}
	};

	const handleLike = async () => {
		if (!gifUri || !gifCid) {
			showToast("Cannot like this item", "error");
			return;
		}

		const nextIsLiked = !isLiked;
		setIsLiked(nextIsLiked); // Optimistic

		const method = nextIsLiked ? "POST" : "DELETE";
		const body = nextIsLiked
			? JSON.stringify({ subject: { uri: gifUri, cid: gifCid } })
			: JSON.stringify({ subject: { uri: gifUri } });

		try {
			const res = await fetch("/api/like", {
				method,
				headers: { "Content-Type": "application/json" },
				body,
			});

			if (!res.ok) {
				if (res.status === 401) {
					window.location.href = "/login";
					return;
				}
				throw new Error("Failed to like");
			}
		} catch (err) {
			console.error("Like action failed", err);
			setIsLiked(!nextIsLiked); // Revert
			showToast("Failed to update like", "error");
		}
	};

	const buttonBaseClass =
		"group flex items-center gap-3 py-2 font-medium text-text-secondary transition-colors bg-transparent border-none shadow-none cursor-pointer";

	return (
		<div class="flex flex-row md:flex-col gap-2 w-full md:w-auto">
			<button
				type="button"
				onClick={handleLike}
				class={`${buttonBaseClass} ${isLiked ? "text-red-500 hover:text-red-600" : "hover:text-red-500"}`}
			>
				<HeartIcon
					filled={isLiked}
					className={`w-6 h-6 transition-transform duration-200 group-hover:scale-110 ${isLiked ? "fill-current" : ""}`}
				/>
				<span>Favorite</span>
			</button>

			<button
				type="button"
				onClick={handleCopy}
				class={`${buttonBaseClass} hover:text-brand-primary`}
			>
				<LinkIcon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
				<span>Copy Link</span>
			</button>

			<button
				type="button"
				onClick={handleDownload}
				class={`${buttonBaseClass} hover:text-green-600`}
			>
				<DownloadIcon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
				<span>Download</span>
			</button>

			{isOwner && rkey && (
				<button
					type="button"
					onClick={() => {
						window.location.href = `/edit/${rkey}`;
					}}
					class={`${buttonBaseClass} hover:text-blue-500`}
				>
					<EditIcon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
					<span>Edit GIF</span>
				</button>
			)}
		</div>
	);
};

// Icons (duplicated for client bundle)
const HeartIcon = ({
	filled,
	className,
}: {
	filled?: boolean;
	className?: string;
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

const EditIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={className}
	>
		<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
	</svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
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

const DownloadIcon = ({ className }: { className?: string }) => (
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
