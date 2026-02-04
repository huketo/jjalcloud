/** @jsxImportSource hono/jsx/dom */
import { useState } from "hono/jsx";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";

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

	// Controlled inputs state
	const [title, setTitle] = useState<string>(initialTitle);
	const [tags, setTags] = useState<string>(
		initialTags ? initialTags.join(", ") : "",
	);
	const [alt, setAlt] = useState<string>(initialAlt);

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

			const data = (await res.json()) as {
				success?: boolean;
				message?: string;
			};

			if (res.ok) {
				setStatus({
					type: "success",
					message: "✅ Updated successfully!",
				});
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
		} catch (_err) {
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

			const data = (await res.json()) as {
				success?: boolean;
				message?: string;
			};

			if (res.ok) {
				setStatus({
					type: "success",
					message: "✅ Deleted successfully.",
				});
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
		} catch (_err) {
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
					<Label for="title">GIF Title</Label>
					<Input
						type="text"
						id="title"
						name="title"
						value={title}
						onInput={(e) =>
							setTitle((e.target as HTMLInputElement)?.value || "")
						}
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
							value={tags}
							onInput={(e) =>
								setTags((e.target as HTMLInputElement)?.value || "")
							}
							placeholder="funny, cat, reaction..."
						/>
					</div>
					<p class="text-xs text-text-muted mt-1">
						Separate tags with commas (max 10 tags)
					</p>
				</div>

				{/* Description / Alt */}
				<div>
					<Label for="alt">Description (Alt Text)</Label>
					<Textarea
						id="alt"
						name="alt"
						value={alt}
						onInput={(e) =>
							setAlt((e.target as HTMLTextAreaElement)?.value || "")
						}
						placeholder="Add some context..."
						maxLength={300}
					/>
				</div>

				{/* Actions */}
				<div class="flex flex-col gap-4 mt-8 pt-6 border-t border-border-light">
					<Button
						type="submit"
						disabled={isSubmitting}
						isLoading={isSubmitting}
						variant="primary"
						size="lg"
						className="w-full font-bold"
					>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</Button>

					{!showDeleteConfirm ? (
						<Button
							type="button"
							onClick={() => setShowDeleteConfirm(true)}
							disabled={isSubmitting}
							variant="destructive"
							size="lg"
							className="w-full font-bold"
						>
							Delete GIF
						</Button>
					) : (
						<div class="flex flex-col gap-2 p-4 bg-status-error/5 rounded-xl border border-status-error/20">
							<p class="text-status-error font-medium text-center m-0 mb-2">
								Are you sure? This cannot be undone.
							</p>
							<div class="flex gap-2">
								<Button
									type="button"
									onClick={() => setShowDeleteConfirm(false)}
									variant="outline"
									className="flex-1"
								>
									Cancel
								</Button>
								<Button
									type="button"
									onClick={handleDelete}
									variant="destructive"
									className="flex-1 font-bold"
								>
									Confirm Delete
								</Button>
							</div>
						</div>
					)}
				</div>
			</form>
		</div>
	);
};
