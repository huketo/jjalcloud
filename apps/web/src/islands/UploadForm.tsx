/** @jsxImportSource hono/jsx/dom */
import { useRef, useState } from "hono/jsx";
import { UploadZone } from "../components/form";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import {
	createUploadPreview,
	getInitialUploadStatus,
	type UploadPreview,
	type UploadStatus,
} from "./uploadFormUtils";

interface UploadFormProps {
	initialError?: string;
	initialSuccess?: string;
}

export const UploadForm = ({
	initialError,
	initialSuccess,
}: UploadFormProps) => {
	const [isUploading, setIsUploading] = useState(false);
	const [preview, setPreview] = useState<UploadPreview | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [status, setStatus] = useState<UploadStatus | null>(
		getInitialUploadStatus(initialError, initialSuccess),
	);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const handleFile = async (file: File) => {
		if (!file) return;

		try {
			const nextPreview = await createUploadPreview(file);
			setPreview(nextPreview);
		} catch {
			setStatus({
				type: "error",
				message: "Failed to preview file. Please try again.",
			});
		}
	};

	const handleDrop = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		const dt = (e as DragEvent).dataTransfer;
		if (dt?.files && dt.files.length > 0) {
			const file = dt.files[0];
			if (fileInputRef.current) {
				// Manually setting files is tricky in some browsers but works in modern ones
				const dataTransfer = new DataTransfer();
				dataTransfer.items.add(file);
				fileInputRef.current.files = dataTransfer.files;
			}
			void handleFile(file);
		}
	};

	const handleDragOver = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	};

	const handleChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			void handleFile(target.files[0]);
		}
	};

	const handleRemoveFile = () => {
		setPreview(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (!formRef.current) return;

		setIsUploading(true);
		setStatus({ type: "success", message: "Uploading to the cloud..." }); // Loading state really

		const formData = new FormData(formRef.current);

		if (preview?.width) formData.append("width", String(preview.width));
		if (preview?.height) formData.append("height", String(preview.height));

		try {
			const res = await fetch("/api/gif", {
				method: "POST",
				body: formData,
			});
			const data = (await res.json()) as {
				error?: string | boolean;
				message?: string;
				uri?: string;
			};

			if (data.error) {
				setStatus({
					type: "error",
					message: data.message || String(data.error),
				});
				setIsUploading(false);
			} else {
				setStatus({ type: "success", message: `✅ ${data.message}` });
				// Reset form
				if (formRef.current) formRef.current.reset();
				setPreview(null);

				// Redirect
				setTimeout(() => {
					window.location.href = "/";
				}, 1500);
			}
		} catch (_err) {
			setStatus({
				type: "error",
				message: "Upload failed. Please try again.",
			});
			setIsUploading(false);
		}
	};

	return (
		<div class="w-full">
			{/* Messages */}
			{status && (
				<div
					class={`mb-6 p-4 rounded-md text-sm border ${
						status.type === "error"
							? "bg-status-error/10 border-status-error text-status-error"
							: "bg-status-success/10 border-status-success text-status-success"
					}`}
				>
					{status.type === "success" &&
					status.message === "Uploading to the cloud..." ? (
						<p style={{ color: "var(--color-text-muted)" }}>{status.message}</p>
					) : (
						status.message
					)}
				</div>
			)}

			<form
				ref={formRef}
				action="/api/gif"
				method="post"
				enctype="multipart/form-data"
				onSubmit={handleSubmit}
				class="space-y-6"
			>
				{/* Upload Zone */}
				{!preview && (
					<div>
						<UploadZone
							id="gif-upload"
							inputId="gif-upload-input"
							isDragOver={isDragOver}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onDragEnter={handleDragOver}
						/>
					</div>
				)}

				<input
					ref={fileInputRef}
					type="file"
					id="gif-upload-input"
					name="file"
					accept="image/gif,video/mp4,image/webp"
					class="hidden"
					required
					onChange={handleChange}
				/>

				{/* Preview */}
				{preview && (
					<div>
						<div class="bg-bg-surface rounded-xl shadow-card overflow-hidden p-4 flex items-center gap-4">
							<img
								src={preview.url}
								alt="Preview"
								class="w-20 h-20 object-cover rounded-md"
							/>
							<div class="flex-1">
								<div class="font-medium mb-1">{preview.name}</div>
								<div class="text-sm text-text-muted">{preview.size}</div>
							</div>
							<button
								type="button"
								onClick={handleRemoveFile}
								class="p-2 rounded-full hover:bg-bg-primary-pale hover:text-brand-primary text-text-secondary bg-transparent transition-colors cursor-pointer border-none"
								aria-label="Remove file"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									style={{ width: "20px", height: "20px" }}
									aria-hidden="true"
								>
									<path d="M18 6 6 18" />
									<path d="m6 6 12 12" />
								</svg>
							</button>
						</div>
					</div>
				)}

				{/* GIF Title */}
				<div>
					<Label for="title">GIF Title</Label>
					<Input
						type="text"
						id="title"
						name="title"
						placeholder="Give it a catchy name..."
						maxLength={100}
					/>
				</div>

				{/* Tags */}
				<div>
					<Label for="tags">Tags</Label>
					<div class="relative">
						<Input
							type="text"
							id="tags"
							name="tags"
							placeholder="funny, cat, reaction..."
						/>
					</div>
					<p class="text-xs text-text-muted mt-1">
						Separate tags with commas (max 10 tags)
					</p>
				</div>

				{/* Description */}
				<div>
					<Label for="alt">Description (Optional)</Label>
					<Textarea
						id="alt"
						name="alt"
						placeholder="Add some context..."
						maxLength={300}
					/>
					<p class="text-xs text-text-muted mt-1">
						Also used as alt text for accessibility
					</p>
				</div>

				{/* Submit Button */}
				<Button
					type="submit"
					disabled={isUploading}
					isLoading={isUploading}
					variant="primary"
					size="lg"
					className="w-full flex items-center justify-center gap-2 font-bold transform active:scale-[0.98] transition-all duration-200"
				>
					{!isUploading && (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							style={{ width: "18px", height: "18px" }}
							aria-hidden="true"
						>
							<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
							<path d="M12 12v9" />
							<path d="m16 16-4-4-4 4" />
						</svg>
					)}
					{isUploading ? "Uploading..." : "Upload GIF"}
				</Button>

				{/* Terms */}
				<p class="text-center mt-4 text-xs text-text-muted">
					By uploading, you agree to our{" "}
					<a href="/terms" class="text-brand-primary hover:underline">
						Terms of Service
					</a>
					.
				</p>
			</form>
		</div>
	);
};
