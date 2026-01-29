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
		<label 
			class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-bg-surface cursor-pointer transition-all duration-200 hover:border-brand-primary hover:bg-brand-primary-pale group" 
			for={`${id}-input`} 
			id={id}
		>
			<div class="w-16 h-16 text-brand-primary-light mb-4">
				<CloudUploadIcon />
			</div>
			<div class="text-lg font-medium text-text mb-1">Tap or Drag GIFs Here</div>
			<div class="text-sm text-text-muted mb-4">
				Supports .gif, .mp4, .webp up to 15MB
			</div>
			<span class="inline-flex items-center justify-center gap-2 px-3 py-1 text-sm font-medium rounded-md bg-bg-surface text-text border border-border transition-all hover:bg-bg-surface-hover hover:border-brand-primary-light">Browse Files</span>
			<input
				type="file"
				id={`${id}-input`}
				name="file"
				accept="image/gif,video/mp4,image/webp"
				class="hidden"
				required
			/>
		</label>
	);
};
