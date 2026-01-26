import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderer } from "./renderer";
import oauthRoutes from "./routes/oauth";
import type { HonoEnv } from "./lib/auth";

const app = new Hono<HonoEnv>();

app.use(renderer);

// OAuth 라우트 등록
app.route("/oauth", oauthRoutes);

// 세션 쿠키 이름
const SESSION_COOKIE = "jjalcloud_session";

// 메인 페이지
app.get("/", async (c) => {
	const error = c.req.query("error");
	const errorMessage = c.req.query("message");
	const did = getCookie(c, SESSION_COOKIE);

	// 로그인 상태면 프로필 페이지로
	if (did) {
		return c.render(
			<div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
				<h1>🖼️ jjalcloud</h1>
				<p>AT Protocol 기반 탈중앙화 GIF 공유 플랫폼</p>

				<div
					id="profile-container"
					style={{
						marginTop: "2rem",
						padding: "1.5rem",
						backgroundColor: "#f5f5f5",
						borderRadius: "12px",
					}}
				>
					<p>프로필 로딩 중...</p>
				</div>

				<div style={{ marginTop: "1.5rem" }}>
					<form action="/oauth/logout" method="post">
						<button
							type="submit"
							style={{
								padding: "0.75rem 1.5rem",
								fontSize: "1rem",
								backgroundColor: "#ff4444",
								color: "white",
								border: "none",
								borderRadius: "8px",
								cursor: "pointer",
							}}
						>
							로그아웃
						</button>
					</form>
				</div>

				<script
					dangerouslySetInnerHTML={{
						__html: `
							(async () => {
								try {
									const res = await fetch('/oauth/profile');
									const profile = await res.json();
									
									if (profile.error) {
										document.getElementById('profile-container').innerHTML = 
											'<p style="color: red;">프로필을 불러올 수 없습니다: ' + profile.message + '</p>';
										return;
									}
									
									document.getElementById('profile-container').innerHTML = \`
										<div style="display: flex; align-items: center; gap: 1rem;">
											\${profile.avatar 
												? '<img src="' + profile.avatar + '" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />'
												: '<div style="width: 80px; height: 80px; border-radius: 50%; background: #ccc; display: flex; align-items: center; justify-content: center; font-size: 2rem;">👤</div>'
											}
											<div>
												<h2 style="margin: 0; font-size: 1.5rem;">\${profile.displayName || profile.handle}</h2>
												<p style="margin: 0.25rem 0; color: #666;">@\${profile.handle}</p>
												\${profile.description ? '<p style="margin: 0.5rem 0; color: #333;">' + profile.description + '</p>' : ''}
											</div>
										</div>
										<div style="display: flex; gap: 2rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd;">
											<div style="text-align: center;">
												<div style="font-size: 1.25rem; font-weight: bold;">\${profile.postsCount || 0}</div>
												<div style="color: #666; font-size: 0.875rem;">게시물</div>
											</div>
											<div style="text-align: center;">
												<div style="font-size: 1.25rem; font-weight: bold;">\${profile.followersCount || 0}</div>
												<div style="color: #666; font-size: 0.875rem;">팔로워</div>
											</div>
											<div style="text-align: center;">
												<div style="font-size: 1.25rem; font-weight: bold;">\${profile.followsCount || 0}</div>
												<div style="color: #666; font-size: 0.875rem;">팔로잉</div>
											</div>
										</div>
									\`;
								} catch (err) {
									console.error('Profile fetch error:', err);
									document.getElementById('profile-container').innerHTML = 
										'<p style="color: red;">프로필을 불러오는 중 오류가 발생했습니다.</p>';
								}
							})();
						`,
					}}
				/>
			</div>,
		);
	}

	// 비로그인 상태
	return c.render(
		<div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
			<h1>🖼️ jjalcloud</h1>
			<p>AT Protocol 기반 탈중앙화 GIF 공유 플랫폼</p>

			{error && (
				<div
					style={{
						padding: "1rem",
						backgroundColor: "#fee",
						border: "1px solid #fcc",
						borderRadius: "8px",
						marginBottom: "1rem",
					}}
				>
					<strong>로그인 실패:</strong> {errorMessage || error}
				</div>
			)}

			<div style={{ marginTop: "2rem" }}>
				<h2>Bluesky로 로그인</h2>
				<form
					action="/oauth/login"
					method="get"
					style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
				>
					<input
						type="text"
						name="handle"
						placeholder="yourname.bsky.social"
						required
						style={{
							padding: "0.75rem 1rem",
							fontSize: "1rem",
							border: "1px solid #ccc",
							borderRadius: "8px",
							minWidth: "250px",
						}}
					/>
					<button
						type="submit"
						style={{
							padding: "0.75rem 1.5rem",
							fontSize: "1rem",
							backgroundColor: "#0085ff",
							color: "white",
							border: "none",
							borderRadius: "8px",
							cursor: "pointer",
						}}
					>
						로그인
					</button>
				</form>
			</div>
		</div>,
	);
});

export default app;
