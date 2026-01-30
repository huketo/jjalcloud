import type { FC } from "hono/jsx";
import { Layout } from "../components";

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

			{/* Messages and Form controlled by Client Island */}
			<div 
				id="upload-form-root" 
				data-props={JSON.stringify({ 
					initialError: error, 
					initialSuccess: success 
				})} 
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



export default UploadPage;
