import type { FC } from "hono/jsx";
import { Layout } from "../components";

interface LoginPageProps {
	error?: string;
	errorMessage?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error, errorMessage }) => {
	return (
		<Layout isLoggedIn={false} showFooter={false}>
			<div class="flex flex-col items-center justify-center min-h-[calc(100vh-60px-2rem)] p-8">
				{/* Logo */}
				<div class="mb-8 text-center">
					<div class="w-20 h-20 mx-auto mb-4 text-brand-primary">
						<CloudIcon />
					</div>
					<h1 class="text-3xl font-bold text-brand-primary mb-1">
						jjalcloud
					</h1>
					<p class="text-text-secondary">
						AT Protocol 기반 탈중앙화 GIF 공유 플랫폼
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div class="w-full max-w-[360px] mb-6 p-4 rounded-md text-sm bg-status-error/10 border border-status-error text-status-error">
						<strong>로그인 실패:</strong> {errorMessage || error}
					</div>
				)}

				{/* Login Card */}
				<div class="w-full max-w-[360px] p-8 bg-bg-surface/60 backdrop-blur-sm rounded-3xl shadow-card border border-white/50">
					<h2 class="text-xl font-semibold text-center mb-6">
						Bluesky로 로그인
					</h2>

					<form action="/oauth/login" method="get">
						<div class="mb-6">
							<label class="block text-sm font-medium text-brand-primary mb-2" for="handle">
								Bluesky Handle
							</label>
							<input
								type="text"
								id="handle"
								name="handle"
								class="w-full p-4 text-base text-text bg-bg-surface/50 border border-border rounded-xl transition-all focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_theme('colors.brand.primary-pale')] placeholder:text-text-muted"
								placeholder="yourname.bsky.social"
								required
								autocomplete="username"
								autocapitalize="none"
							/>
						</div>

						<button
							type="submit"
							class="w-full flex items-center justify-center gap-2 py-3 text-lg font-medium rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:opacity-90 hover:shadow-md transition-all"
						>
							<BlueskyIcon />
							Continue with Bluesky
						</button>
					</form>

					<div class="mt-6 pt-6 border-t border-border-light text-center">
						<p class="text-sm text-text-muted">
							계정이 없으신가요?{" "}
							<a
								href="https://bsky.app"
								target="_blank"
								rel="noopener noreferrer"
								class="text-brand-primary hover:underline"
							>
								Bluesky 가입하기
							</a>
						</p>
					</div>
				</div>

				{/* Info */}
				<div class="text-center max-w-[360px] mt-8">
					<h3 class="text-sm font-semibold text-text mb-2">
						왜 Bluesky 계정이 필요한가요?
					</h3>
					<p class="text-xs text-text-muted leading-relaxed">
						jjalcloud는 AT Protocol을 사용하여 당신의 GIF를
						탈중앙화된 방식으로 저장합니다. Bluesky 계정을 통해
						로그인하면 당신의 개인 데이터 서버(PDS)에 GIF가
						저장됩니다.
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
