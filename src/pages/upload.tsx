import type { FC } from "hono/jsx";
import { Layout, UploadZone } from "../components";

interface UploadPageProps {
	isLoggedIn: boolean;
	error?: string;
	success?: string;
	avatarUrl?: string;
}

export const UploadPage: FC<UploadPageProps> = ({
	isLoggedIn,
	error,
	success,
	avatarUrl,
}) => {
	// Redirect to login if not authenticated
	if (!isLoggedIn) {
		return (
			<Layout isLoggedIn={false} activeTab="upload">
				<div class="flex flex-col items-center justify-center p-12 text-center">
					<LockIcon />
					<h3 class="text-lg font-semibold text-text mb-1">Sign in Required</h3>
					<p class="text-sm text-text-muted mb-6">
						Please sign in to upload GIFs to the cloud.
					</p>
					<a href="/login" class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 no-underline">
						Sign In
					</a>
				</div>
			</Layout>
		);
	}

	return (
		<Layout
			isLoggedIn={isLoggedIn}
			activeTab="upload"
			showBack
			title="jjalcloud"
			avatarUrl={avatarUrl}
		>
			{/* Page Title */}
			<div class="text-center mb-6">
				<h1 class="text-3xl font-bold text-text mb-1">
					Upload to the Cloud
				</h1>
				<p class="text-text-secondary">
					Share your favorite GIFs with the decentralized world.
				</p>
			</div>

			{/* Messages */}
			{error && <div class="mb-6 p-4 rounded-md text-sm bg-status-error/10 border border-status-error text-status-error">{error}</div>}
			{success && <div class="mb-6 p-4 rounded-md text-sm bg-status-success/10 border border-status-success text-status-success">{success}</div>}

			{/* Upload Form */}
			<form
				id="upload-form"
				action="/api/gif"
				method="post"
				enctype="multipart/form-data"
			>
				{/* Upload Zone */}
				<div class="mb-6">
					<UploadZone id="gif-upload" />
				</div>

				{/* Preview */}
				<div
					id="preview-container"
					class="mb-6 hidden"
				>
					<div class="bg-bg-surface rounded-xl shadow-card overflow-hidden p-4 flex items-center gap-4">
						<img
							id="preview-image"
							src=""
							alt="Preview"
							class="w-20 h-20 object-cover rounded-md"
						/>
						<div class="flex-1">
							<div
								id="preview-name"
								class="font-medium mb-1"
							></div>
							<div
								id="preview-size"
								class="text-sm text-text-muted"
							></div>
						</div>
						<button
							type="button"
							id="remove-file-btn"
							class="p-2 rounded-full hover:bg-bg-primary-pale hover:text-brand-primary text-text-secondary bg-transparent transition-colors"
							aria-label="Remove file"
						>
							<XIcon />
						</button>
					</div>
				</div>

				{/* GIF Title */}
				<div class="mb-6">
					<label class="block text-sm font-medium text-brand-primary mb-2" for="title">
						GIF Title
					</label>
					<input
						type="text"
						id="title"
						name="title"
						class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
						placeholder="Give it a catchy name..."
						maxLength={100}
					/>
				</div>

				{/* Tags */}
				<div class="mb-6">
					<label class="block text-sm font-medium text-brand-primary mb-2" for="tags">
						Tags
					</label>
					<div class="relative">
						<span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
							#
						</span>
						<input
							type="text"
							id="tags"
							name="tags"
							class="w-full box-border px-4 py-3 pl-8 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
							placeholder="funny, cat, reaction..."
						/>
					</div>
					<p class="text-xs text-text-muted mt-1">
						Separate tags with commas (max 10 tags)
					</p>
				</div>

				{/* Description */}
				<div class="mb-6">
					<label class="block text-sm font-medium text-brand-primary mb-2" for="alt">
						Description (Optional)
					</label>
					<textarea
						id="alt"
						name="alt"
						class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80 min-h-[100px] resize-y"
						placeholder="Add some context..."
						maxLength={300}
					></textarea>
					<p class="text-xs text-text-muted mt-1">
						Also used as alt text for accessibility
					</p>
				</div>

				{/* Submit Button */}
				<button
					type="submit"
					id="upload-btn"
					class="w-full box-border flex items-center justify-center gap-2 py-3 text-lg font-bold rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse border-none shadow-md hover:shadow-lg hover:opacity-95 transform active:scale-[0.98] transition-all duration-200"
				>
					<CloudUploadIcon />
					Upload GIF
				</button>

				{/* Terms */}
				<p class="text-center mt-4 text-xs text-text-muted">
					By uploading, you agree to our{" "}
					<a href="/terms" class="text-brand-primary hover:underline">
						Terms of Service
					</a>
					.
				</p>
			</form>

			{/* Upload Status */}
			<div id="upload-status" class="mt-md"></div>

			{/* Client-side scripts */}
			<script
				dangerouslySetInnerHTML={{
					__html: `
						const uploadZone = document.getElementById('gif-upload');
						const fileInput = document.getElementById('gif-upload-input');
						const previewContainer = document.getElementById('preview-container');
						const previewImage = document.getElementById('preview-image');
						const previewName = document.getElementById('preview-name');
						const previewSize = document.getElementById('preview-size');
						const removeBtn = document.getElementById('remove-file-btn');
						const uploadForm = document.getElementById('upload-form');
						const uploadBtn = document.getElementById('upload-btn');
						const statusEl = document.getElementById('upload-status');

						// Drag and drop handling
						['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
							uploadZone.addEventListener(eventName, (e) => {
								e.preventDefault();
								e.stopPropagation();
							});
						});

						['dragenter', 'dragover'].forEach(eventName => {
							uploadZone.addEventListener(eventName, () => {
								uploadZone.classList.add('dragover');
							});
						});

						['dragleave', 'drop'].forEach(eventName => {
							uploadZone.addEventListener(eventName, () => {
								uploadZone.classList.remove('dragover');
							});
						});

						uploadZone.addEventListener('drop', (e) => {
							const files = e.dataTransfer.files;
							if (files.length > 0) {
								fileInput.files = files;
								showPreview(files[0]);
							}
						});

						// File input change
						fileInput.addEventListener('change', (e) => {
							if (e.target.files.length > 0) {
								showPreview(e.target.files[0]);
							}
						});

						// Show preview
						function showPreview(file) {
							const reader = new FileReader();
							reader.onload = (e) => {
								previewImage.src = e.target.result;
								previewName.textContent = file.name;
								previewSize.textContent = formatFileSize(file.size);
								previewContainer.style.display = 'block';
								uploadZone.style.display = 'none';
							};
							reader.readAsDataURL(file);
						}

						// Remove file
						removeBtn.addEventListener('click', () => {
							fileInput.value = '';
							previewContainer.style.display = 'none';
							uploadZone.style.display = 'flex';
						});

						// Format file size
						function formatFileSize(bytes) {
							if (bytes === 0) return '0 Bytes';
							const k = 1024;
							const sizes = ['Bytes', 'KB', 'MB', 'GB'];
							const i = Math.floor(Math.log(bytes) / Math.log(k));
							return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
						}

						// Form submission
						uploadForm.addEventListener('submit', async (e) => {
							e.preventDefault();
							
							const formData = new FormData(uploadForm);
							
							uploadBtn.disabled = true;
							uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';
							statusEl.innerHTML = '<p style="color: var(--color-text-muted);">Uploading to the cloud...</p>';
							
							try {
								const res = await fetch('/api/gif', {
									method: 'POST',
									body: formData,
								});
								const data = await res.json();
								
								if (data.error) {
									statusEl.innerHTML = '<div class="alert alert-error">' + data.message + '</div>';
								} else {
									statusEl.innerHTML = '<div class="alert alert-success">✅ ' + data.message + '</div>';
									uploadForm.reset();
									previewContainer.style.display = 'none';
									uploadZone.style.display = 'flex';
									
									// Redirect to home after success
									setTimeout(() => {
										window.location.href = '/';
									}, 1500);
								}
							} catch (err) {
								statusEl.innerHTML = '<div class="alert alert-error">Upload failed. Please try again.</div>';
							} finally {
								uploadBtn.disabled = false;
								uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg> Upload GIF';
							}
						});
					`,
				}}
			/>
		</Layout>
	);
};

// Icons
const LockIcon = () => (
	<svg
		class="w-16 h-16 text-text-muted mb-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</svg>
);

const XIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "20px", height: "20px" }}
	>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</svg>
);

const CloudUploadIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
		<path d="M12 12v9" />
		<path d="m16 16-4-4-4 4" />
	</svg>
);

export default UploadPage;
