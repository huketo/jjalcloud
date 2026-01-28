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
				<div class="empty-state">
					<LockIcon />
					<h3 class="empty-state-title">Sign in Required</h3>
					<p class="empty-state-text">
						Please sign in to upload GIFs to the cloud.
					</p>
					<a href="/login" class="btn btn-primary">
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
			<div class="text-center mb-lg">
				<h1
					style={{
						fontSize: "var(--font-size-2xl)",
						fontWeight: 700,
						color: "var(--color-text)",
						marginBottom: "var(--spacing-xs)",
					}}
				>
					Upload to the Cloud
				</h1>
				<p style={{ color: "var(--color-text-secondary)" }}>
					Share your favorite GIFs with the decentralized world.
				</p>
			</div>

			{/* Messages */}
			{error && <div class="alert alert-error mb-lg">{error}</div>}
			{success && <div class="alert alert-success mb-lg">{success}</div>}

			{/* Upload Form */}
			<form
				id="upload-form"
				action="/api/gif"
				method="post"
				enctype="multipart/form-data"
			>
				{/* Upload Zone */}
				<div class="mb-lg">
					<UploadZone id="gif-upload" />
				</div>

				{/* Preview */}
				<div
					id="preview-container"
					class="mb-lg"
					style={{ display: "none" }}
				>
					<div
						class="card"
						style={{
							padding: "var(--spacing-md)",
							display: "flex",
							alignItems: "center",
							gap: "var(--spacing-md)",
						}}
					>
						<img
							id="preview-image"
							src=""
							alt="Preview"
							style={{
								width: "80px",
								height: "80px",
								objectFit: "cover",
								borderRadius: "var(--radius-md)",
							}}
						/>
						<div style={{ flex: 1 }}>
							<div
								id="preview-name"
								style={{
									fontWeight: 500,
									marginBottom: "var(--spacing-xs)",
								}}
							></div>
							<div
								id="preview-size"
								style={{
									fontSize: "var(--font-size-sm)",
									color: "var(--color-text-muted)",
								}}
							></div>
						</div>
						<button
							type="button"
							id="remove-file-btn"
							class="btn btn-ghost btn-icon"
							aria-label="Remove file"
						>
							<XIcon />
						</button>
					</div>
				</div>

				{/* GIF Title */}
				<div class="form-group">
					<label class="form-label" for="title">
						GIF Title
					</label>
					<input
						type="text"
						id="title"
						name="title"
						class="form-input"
						placeholder="Give it a catchy name..."
						maxLength={100}
					/>
				</div>

				{/* Tags */}
				<div class="form-group">
					<label class="form-label" for="tags">
						Tags
					</label>
					<div style={{ position: "relative" }}>
						<span
							style={{
								position: "absolute",
								left: "var(--spacing-md)",
								top: "50%",
								transform: "translateY(-50%)",
								color: "var(--color-text-muted)",
							}}
						>
							#
						</span>
						<input
							type="text"
							id="tags"
							name="tags"
							class="form-input"
							placeholder="funny, cat, reaction..."
							style={{
								paddingLeft: "calc(var(--spacing-md) + 16px)",
							}}
						/>
					</div>
					<p class="form-hint">
						Separate tags with commas (max 10 tags)
					</p>
				</div>

				{/* Description */}
				<div class="form-group">
					<label class="form-label" for="alt">
						Description (Optional)
					</label>
					<textarea
						id="alt"
						name="alt"
						class="form-input form-textarea"
						placeholder="Add some context..."
						maxLength={300}
					></textarea>
					<p class="form-hint">
						Also used as alt text for accessibility
					</p>
				</div>

				{/* Submit Button */}
				<button
					type="submit"
					id="upload-btn"
					class="btn btn-primary btn-lg"
					style={{ width: "100%" }}
				>
					<CloudUploadIcon />
					Upload GIF
				</button>

				{/* Terms */}
				<p
					class="text-center mt-md"
					style={{
						fontSize: "var(--font-size-xs)",
						color: "var(--color-text-muted)",
					}}
				>
					By uploading, you agree to our{" "}
					<a href="/terms" style={{ color: "var(--color-primary)" }}>
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
		class="empty-state-icon"
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
