import type { FC } from "hono/jsx";
import { Layout } from "../components";

interface LoginPageProps {
	error?: string;
	errorMessage?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error, errorMessage }) => {
	return (
		<Layout isLoggedIn={false} showFooter={false}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					minHeight:
						"calc(100vh - var(--header-height) - var(--spacing-xl))",
					padding: "var(--spacing-xl)",
				}}
			>
				{/* Logo */}
				<div
					style={{
						marginBottom: "var(--spacing-xl)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							width: "80px",
							height: "80px",
							margin: "0 auto var(--spacing-md)",
							color: "var(--color-primary)",
						}}
					>
						<CloudIcon />
					</div>
					<h1
						style={{
							fontSize: "var(--font-size-3xl)",
							fontWeight: 700,
							color: "var(--color-primary)",
							marginBottom: "var(--spacing-xs)",
						}}
					>
						jjalcloud
					</h1>
					<p style={{ color: "var(--color-text-secondary)" }}>
						AT Protocol 기반 탈중앙화 GIF 공유 플랫폼
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div
						class="alert alert-error mb-lg"
						style={{ width: "100%", maxWidth: "360px" }}
					>
						<strong>로그인 실패:</strong> {errorMessage || error}
					</div>
				)}

				{/* Login Card */}
				<div
					class="card"
					style={{
						width: "100%",
						maxWidth: "360px",
						padding: "var(--spacing-xl)",
					}}
				>
					<h2
						style={{
							fontSize: "var(--font-size-xl)",
							fontWeight: 600,
							textAlign: "center",
							marginBottom: "var(--spacing-lg)",
						}}
					>
						Bluesky로 로그인
					</h2>

					<form action="/oauth/login" method="get">
						<div class="form-group">
							<label class="form-label" for="handle">
								Bluesky Handle
							</label>
							<input
								type="text"
								id="handle"
								name="handle"
								class="form-input"
								placeholder="yourname.bsky.social"
								required
								autocomplete="username"
								autocapitalize="none"
							/>
						</div>

						<button
							type="submit"
							class="btn btn-primary btn-lg"
							style={{ width: "100%" }}
						>
							<BlueskyIcon />
							Continue with Bluesky
						</button>
					</form>

					<div
						style={{
							marginTop: "var(--spacing-lg)",
							paddingTop: "var(--spacing-lg)",
							borderTop: "1px solid var(--color-border-light)",
							textAlign: "center",
						}}
					>
						<p
							style={{
								fontSize: "var(--font-size-sm)",
								color: "var(--color-text-muted)",
							}}
						>
							계정이 없으신가요?{" "}
							<a
								href="https://bsky.app"
								target="_blank"
								rel="noopener noreferrer"
								style={{ color: "var(--color-primary)" }}
							>
								Bluesky 가입하기
							</a>
						</p>
					</div>
				</div>

				{/* Info */}
				<div
					style={{
						marginTop: "var(--spacing-xl)",
						textAlign: "center",
						maxWidth: "360px",
					}}
				>
					<h3
						style={{
							fontSize: "var(--font-size-sm)",
							fontWeight: 600,
							color: "var(--color-text)",
							marginBottom: "var(--spacing-sm)",
						}}
					>
						왜 Bluesky 계정이 필요한가요?
					</h3>
					<p
						style={{
							fontSize: "var(--font-size-xs)",
							color: "var(--color-text-muted)",
							lineHeight: 1.6,
						}}
					>
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
