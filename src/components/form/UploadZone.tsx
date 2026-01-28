import type { FC } from "hono/jsx";

interface UploadZoneProps {
	id?: string;
}

const CloudUploadIcon = () => (
	<svg
		class="upload-zone-icon"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
		<path d="M12 12v9" />
		<path d="m16 16-4-4-4 4" />
	</svg>
);

export const UploadZone: FC<UploadZoneProps> = ({ id = "upload-zone" }) => {
	return (
		<label class="upload-zone" for={`${id}-input`} id={id}>
			<CloudUploadIcon />
			<div class="upload-zone-text">Tap or Drag GIFs Here</div>
			<div class="upload-zone-hint">
				Supports .gif, .mp4, .webp up to 15MB
			</div>
			<span class="btn btn-secondary btn-sm">Browse Files</span>
			<input
				type="file"
				id={`${id}-input`}
				name="file"
				accept="image/gif,video/mp4,image/webp"
				style={{ display: "none" }}
				required
			/>
		</label>
	);
};
