import type { FC } from "hono/jsx";
import { Layout } from "../components";
import type { GifView } from "../types/gif";
import { getGifUrl } from "../utils";

interface EditPageProps {
	isLoggedIn: boolean;
	gif: GifView;
	avatarUrl?: string;
}

export const EditPage: FC<EditPageProps> = ({ isLoggedIn, gif, avatarUrl }) => {
	// Redirect to login if not authenticated (handled by router usually, but safety check)
	if (!isLoggedIn) {
		return (
			<Layout isLoggedIn={false}>
				<div class="flex flex-col items-center justify-center p-12 text-center">
					<h3 class="text-lg font-semibold text-text mb-1">Sign in Required</h3>
					<p class="text-sm text-text-muted mb-6">
						Please sign in to edit your GIFs.
					</p>
					<a
						href="/login"
						class="inline-flex items-center justify-center gap-2 px-6 py-2 text-base font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 no-underline"
					>
						Sign In
					</a>
				</div>
			</Layout>
		);
	}

	return (
		<Layout
			isLoggedIn={isLoggedIn}
			showBack
			title="jjalcloud"
			avatarUrl={avatarUrl}
		>
			<div class="max-w-xl mx-auto px-4 py-8">
				<div class="text-center mb-8">
					<h1 class="text-2xl font-bold text-text mb-2">Edit GIF</h1>
					<p class="text-text-secondary">Update details or delete your GIF</p>
				</div>

				{/* Preview Image */}
				<div class="mb-8 flex justify-center">
					<div class="relative rounded-xl overflow-hidden shadow-card max-h-[300px] inline-block">
						<img
							src={getGifUrl(gif)}
							alt={gif.title || "GIF Preview"}
							class="max-w-full max-h-[300px] object-contain block"
						/>
					</div>
				</div>

				<div
					id="edit-form-root"
					data-props={JSON.stringify({
						rkey: gif.rkey,
						initialTitle: gif.title,
						initialTags: gif.tags,
						initialAlt: gif.alt,
					})}
				/>
			</div>
		</Layout>
	);
};

export default EditPage;
