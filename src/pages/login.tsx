import type { FC } from "hono/jsx";
import { Layout } from "../components";

interface LoginPageProps {
	error?: string;
	errorMessage?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error, errorMessage }) => {
	return (
		<Layout isLoggedIn={false} showFooter={false}>
			<div class="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] p-4">
				
				{/* Logo & Headline */}
				<div class="mb-6 text-center space-y-1">
					<div class="w-14 h-14 mx-auto mb-3 text-brand-primary drop-shadow-md">
						<CloudIcon />
					</div>
					<h1 class="text-3xl md:text-3xl font-bold text-brand-primary tracking-tight">
						jjalcloud
					</h1>
					<p class="text-base text-text-secondary font-medium">
						A Decentralized GIF Platform built on the AT Protocol
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div class="w-full max-w-sm mb-4 p-3 rounded-lg text-sm font-medium bg-status-error/10 border border-status-error text-status-error shadow-sm">
						<strong>Login Failed:</strong> {errorMessage || error}
					</div>
				)}

				{/* Login Card */}
				<div class="w-full max-w-sm p-6 md:p-8 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-border/60">
					<h2 class="text-xl font-bold text-center text-text mb-6">
						Sign in with Bluesky
					</h2>

					<form action="/oauth/login" method="get">
						<div class="mb-6 group">
							<label class="block text-sm font-semibold text-text-secondary mb-1.5" for="handle">
								Bluesky Handle
							</label>
							<div class="relative w-full">
								<input
									type="text"
									id="handle"
									name="handle"
									class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
									placeholder="username.bsky.social"
									required
									autocomplete="username"
									autocapitalize="none"
								/>
							</div>
						</div>

						<button
							type="submit"
							class="w-full box-border flex items-center justify-center gap-2 py-3 text-base font-bold rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-dark text-white border-none shadow-md hover:shadow-lg hover:opacity-95 transform active:scale-[0.98] transition-all duration-200"
						>
							<BlueskyIcon />
							<span>Continue with Bluesky</span>
						</button>
					</form>

					<div class="mt-6 pt-5 border-t border-border-light text-center">
						<p class="text-sm text-text-secondary">
							Don't have an account?{" "}
							<a
								href="https://bsky.app"
								target="_blank"
								rel="noopener noreferrer"
								class="font-semibold text-brand-primary hover:text-brand-primary-dark hover:underline transition-colors"
							>
								Join Bluesky
							</a>
						</p>
					</div>
				</div>

				{/* Info Section */}
				<div class="text-center max-w-sm mt-8 space-y-1">
					<h3 class="text-sm font-semibold text-text">
						Why do I need a Bluesky account?
					</h3>
					<p class="text-xs text-text-muted leading-relaxed">
						jjalcloud leverages the AT Protocol to store your GIFs in a truly decentralized way. 
						Your account ensures that your data lives in your own Personal Data Server (PDS).
					</p>
				</div>
			</div>
		</Layout>
	);
};

// Icons
const CloudIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "100%", height: "100%" }}
	>
		<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
	</svg>
);

const BlueskyIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="currentColor"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
	</svg>
);

export default LoginPage;
