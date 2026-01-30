/** @jsxImportSource hono/jsx/dom */
import { useState } from "hono/jsx";

interface EditFormProps {
	rkey: string;
	initialTitle?: string;
	initialTags?: string[];
	initialAlt?: string;
}

export const EditForm = ({
	rkey,
	initialTitle = "",
	initialTags = [],
	initialAlt = "",
}: EditFormProps) => {
	const [status, setStatus] = useState<{
		type: "error" | "success" | "info";
		message: string;
	} | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);

		const title = formData.get("title") as string;
		const tagsStr = formData.get("tags") as string;
		const alt = formData.get("alt") as string;

		const tags = tagsStr
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		setIsSubmitting(true);
		setStatus({ type: "info", message: "Updating..." });

		try {
			const res = await fetch(`/api/gif/${rkey}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title,
					tags,
					alt,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				setStatus({ type: "success", message: "✅ Updated successfully!" });
				setTimeout(() => {
					window.location.href = `/gif/${rkey}`;
				}, 1000);
			} else {
				setStatus({
					type: "error",
					message: data.message || "Failed to update.",
				});
				setIsSubmitting(false);
			}
		} catch (err) {
			setStatus({ type: "error", message: "Network error occurred." });
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		setIsSubmitting(true);
		setStatus({ type: "info", message: "Deleting..." });

		try {
			const res = await fetch(`/api/gif/${rkey}`, {
				method: "DELETE",
			});

			const data = await res.json();

			if (res.ok) {
				setStatus({ type: "success", message: "✅ Deleted successfully." });
				setTimeout(() => {
					window.location.href = "/";
				}, 1000);
			} else {
				setStatus({
					type: "error",
					message: data.message || "Failed to delete.",
				});
				setIsSubmitting(false);
				setShowDeleteConfirm(false);
			}
		} catch (err) {
			setStatus({ type: "error", message: "Network error occurred." });
			setIsSubmitting(false);
			setShowDeleteConfirm(false);
		}
	};

	return (
		<div class="w-full">
			{/* Status Message */}
			{status && (
				<div
					class={`mb-6 p-4 rounded-md text-sm border ${
						status.type === "error"
							? "bg-status-error/10 border-status-error text-status-error"
							: status.type === "success"
								? "bg-status-success/10 border-status-success text-status-success"
								: "bg-brand-primary-pale border-brand-primary text-brand-primary"
					}`}
				>
					{status.message}
				</div>
			)}

			<form onSubmit={handleSubmit} class="space-y-6">
				{/* Title */}
				<div>
					<label
						class="block text-sm font-medium text-brand-primary mb-2"
						for="title"
					>
						GIF Title
					</label>
					<input
						type="text"
						id="title"
						name="title"
						defaultValue={initialTitle}
						class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
						placeholder="Give it a catchy name..."
						maxLength={100}
					/>
				</div>

				{/* Tags */}
				<div>
					<label
						class="block text-sm font-medium text-brand-primary mb-2"
						for="tags"
					>
						Tags
					</label>
					<div class="relative">
						<input
							type="text"
							id="tags"
							name="tags"
							defaultValue={initialTags.join(", ")}
							class="w-full box-border px-4 py-3 pl-8 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
							placeholder="funny, cat, reaction..."
						/>
					</div>
					<p class="text-xs text-text-muted mt-1">
						Separate tags with commas (max 10 tags)
					</p>
				</div>

				{/* Description / Alt */}
				<div>
					<label
						class="block text-sm font-medium text-brand-primary mb-2"
						for="alt"
					>
						Description (Alt Text)
					</label>
					<textarea
						id="alt"
						name="alt"
						defaultValue={initialAlt}
						class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-md transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80 min-h-[100px] resize-y"
						placeholder="Add some context..."
						maxLength={300}
					></textarea>
				</div>

				{/* Actions */}
				<div class="flex flex-col gap-4 mt-8 pt-6 border-t border-border-light">
					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full py-3 text-lg font-bold rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-md hover:shadow-lg hover:opacity-95 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed border-none cursor-pointer"
					>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</button>

					{!showDeleteConfirm ? (
						<button
							type="button"
							onClick={() => setShowDeleteConfirm(true)}
							disabled={isSubmitting}
							class="w-full py-3 text-base font-medium rounded-xl text-status-error bg-status-error/5 hover:bg-status-error/10 transition-colors border-none cursor-pointer"
						>
							Delete GIF
						</button>
					) : (
						<div class="flex flex-col gap-2 p-4 bg-status-error/5 rounded-xl border border-status-error/20">
							<p class="text-status-error font-medium text-center m-0 mb-2">
								Are you sure? This cannot be undone.
							</p>
							<div class="flex gap-2">
								<button
									type="button"
									onClick={() => setShowDeleteConfirm(false)}
									class="flex-1 py-2 text-sm font-medium rounded-lg bg-bg-surface text-text border border-border hover:bg-bg-surface-hover cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleDelete}
									class="flex-1 py-2 text-sm font-bold rounded-lg bg-status-error text-white border-none hover:opacity-90 cursor-pointer"
								>
									Confirm Delete
								</button>
							</div>
						</div>
					)}
				</div>
			</form>
		</div>
	);
};
