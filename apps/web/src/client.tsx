/** @jsxImportSource hono/jsx/dom */
import { render } from "hono/jsx/dom";
import { ToastContainer } from "./components/ui/Toast";
import { DetailActions } from "./islands/DetailActions";

// Mount Toast Container globally
const toastRoot = document.getElementById("toast-root");
if (toastRoot) {
	render(<ToastContainer />, toastRoot);
}

// Mount Detail Actions if present
const detailActionsRoot = document.getElementById("detail-actions-root");
if (detailActionsRoot) {
	const propsInJSON = detailActionsRoot.getAttribute("data-props");
	const props = propsInJSON ? JSON.parse(propsInJSON) : {};
	render(<DetailActions {...props} />, detailActionsRoot);
}

// Mount Upload Form if present
import { UploadForm } from "./islands/UploadForm";

const uploadFormRoot = document.getElementById("upload-form-root");
if (uploadFormRoot) {
	const propsInJSON = uploadFormRoot.getAttribute("data-props");
	const props = propsInJSON ? JSON.parse(propsInJSON) : {};
	render(<UploadForm {...props} />, uploadFormRoot);
}

// Mount Edit Form if present
import { EditForm } from "./islands/EditForm";

const editFormRoot = document.getElementById("edit-form-root");
if (editFormRoot) {
	const propsInJSON = editFormRoot.getAttribute("data-props");
	const props = propsInJSON ? JSON.parse(propsInJSON) : {};
	render(<EditForm {...props} />, editFormRoot);
}

// Global Event Delegation for simple interactions (like Card Copy)
document.addEventListener("click", (e) => {
	const target = (e.target as HTMLElement).closest(
		"[data-copy-text]",
	) as HTMLElement | null;
	const menuTrigger = (e.target as HTMLElement).closest(
		"[data-toggle-menu]",
	) as HTMLElement | null;
	const mobileMenu = document.getElementById("mobile-menu");

	const likeBtn = (e.target as HTMLElement).closest(
		".like-btn",
	) as HTMLElement | null;

	// Handle Copy Button
	if (target) {
		const text = target.getAttribute("data-copy-text");
		const message =
			target.getAttribute("data-copy-message") ||
			"✅ Link copied to clipboard!";

		if (text) {
			navigator.clipboard
				.writeText(text)
				.then(() => {
					// Dispatch custom event that ToastContainer listens to
					window.dispatchEvent(
						new CustomEvent("show-toast", {
							detail: { message, type: "success" },
						}),
					);
				})
				.catch((err) => {
					console.error("Failed to copy", err);
				});
		}
	}

	// Handle Like Button
	if (likeBtn) {
		e.preventDefault();
		e.stopPropagation();

		const uri = likeBtn.getAttribute("data-gif-uri");
		const cid = likeBtn.getAttribute("data-gif-cid");
		const isLiked = likeBtn.getAttribute("aria-label") === "Unlike"; // Assuming aria-label tracks state or we need a data attr
		// Better: use data-is-liked or check class
		// Let's rely on aria-label or toggle class for now, but safer to have explicit data attr on update.
		// However, we are modifying DOM directly here.

		if (!uri || !cid) return;

		// Optimistic UI Update
		const iconContainer = likeBtn.querySelector("span:first-child");
		const filledIcon = `<svg class="like-icon w-full h-full" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>`;
		const outlineIcon = `<svg class="like-icon w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>`;

		const nextIsLiked = !isLiked;

		// Toggle Classes
		if (nextIsLiked) {
			likeBtn.classList.add("text-status-like-active");
			likeBtn.classList.remove("text-text-muted", "text-white"); // Remove potential inactive classes
			if (likeBtn.classList.contains("backdrop-blur-md")) {
				// Glass variant
				likeBtn.classList.add("text-status-like");
			}
			if (iconContainer) iconContainer.innerHTML = filledIcon;
			likeBtn.setAttribute("aria-label", "Unlike");
		} else {
			likeBtn.classList.remove("text-status-like-active", "text-status-like");
			likeBtn.classList.add("text-text-muted"); // Default variant
			if (likeBtn.classList.contains("backdrop-blur-md")) {
				// Glass variant
				likeBtn.classList.add("text-white");
				likeBtn.classList.remove("text-text-muted");
			}
			if (iconContainer) iconContainer.innerHTML = outlineIcon;
			likeBtn.setAttribute("aria-label", "Like");
		}

		// API Call
		const method = nextIsLiked ? "POST" : "DELETE";
		const body = nextIsLiked
			? JSON.stringify({ subject: { uri, cid } })
			: JSON.stringify({ subject: { uri } });

		fetch("/api/like", {
			method,
			headers: { "Content-Type": "application/json" },
			body,
		})
			.then(async (res) => {
				if (!res.ok) {
					if (res.status === 401) {
						window.location.href = "/login";
						return;
					}
					throw new Error("Failed to like");
				}
				// Success: Maybe update count if present
				// We aren't updating count locally for now (too complex to parse number).
				// But the next page load will show correct count.
			})
			.catch((err) => {
				console.error("Like action failed", err);
				// Revert UI
				if (!nextIsLiked) {
					// Tried to unlike, failed -> revert to liked
					likeBtn.classList.add("text-status-like-active");
					if (iconContainer) iconContainer.innerHTML = filledIcon;
					likeBtn.setAttribute("aria-label", "Unlike");
				} else {
					// Tried to like, failed -> revert to unliked
					likeBtn.classList.remove("text-status-like-active");
					if (iconContainer) iconContainer.innerHTML = outlineIcon;
					likeBtn.setAttribute("aria-label", "Like");
				}
				window.dispatchEvent(
					new CustomEvent("show-toast", {
						detail: { message: "Failed to update like", type: "error" },
					}),
				);
			});
	}

	// Handle Mobile Menu Toggle
	if (menuTrigger) {
		if (mobileMenu) {
			mobileMenu.classList.toggle("hidden");
			const isExpanded = !mobileMenu.classList.contains("hidden");
			menuTrigger.setAttribute("aria-expanded", String(isExpanded));
		}
	} else if (
		mobileMenu &&
		!mobileMenu.classList.contains("hidden") &&
		!(e.target as HTMLElement).closest("#mobile-menu")
	) {
		// Close menu when clicking outside
		mobileMenu.classList.add("hidden");
		const trigger = document.querySelector("[data-toggle-menu]");
		if (trigger) trigger.setAttribute("aria-expanded", "false");
	}
});
