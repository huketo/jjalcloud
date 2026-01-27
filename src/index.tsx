import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderer } from "./renderer";
import oauthRoutes from "./routes/oauth";
import gifRoutes from "./routes/gif";
import type { HonoEnv } from "./lib/auth";

const app = new Hono<HonoEnv>();

app.use(renderer);

// OAuth 라우트 등록
app.route("/oauth", oauthRoutes);

// GIF API 라우트 등록
app.route("/api/gif", gifRoutes);

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
			<div
				style={{
					padding: "2rem",
					fontFamily: "system-ui, sans-serif",
					maxWidth: "1200px",
					margin: "0 auto",
				}}
			>
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

				{/* GIF 업로드 섹션 */}
				<div
					style={{
						marginTop: "2rem",
						padding: "1.5rem",
						backgroundColor: "#e8f4ff",
						borderRadius: "12px",
					}}
				>
					<h2 style={{ marginTop: 0 }}>📤 GIF 업로드</h2>
					<form
						id="upload-form"
						enctype="multipart/form-data"
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "1rem",
						}}
					>
						<div>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: "bold",
								}}
							>
								GIF 파일 *
							</label>
							<input
								type="file"
								name="file"
								accept="image/gif"
								required
								style={{
									padding: "0.5rem",
									border: "1px solid #ccc",
									borderRadius: "8px",
									width: "100%",
								}}
							/>
						</div>
						<div>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: "bold",
								}}
							>
								제목
							</label>
							<input
								type="text"
								name="title"
								placeholder="GIF 제목을 입력하세요"
								maxLength={100}
								style={{
									padding: "0.75rem",
									border: "1px solid #ccc",
									borderRadius: "8px",
									width: "100%",
									boxSizing: "border-box",
								}}
							/>
						</div>
						<div>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: "bold",
								}}
							>
								대체 텍스트 (접근성)
							</label>
							<input
								type="text"
								name="alt"
								placeholder="이미지 설명을 입력하세요"
								maxLength={300}
								style={{
									padding: "0.75rem",
									border: "1px solid #ccc",
									borderRadius: "8px",
									width: "100%",
									boxSizing: "border-box",
								}}
							/>
						</div>
						<div>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: "bold",
								}}
							>
								태그 (쉼표로 구분)
							</label>
							<input
								type="text"
								name="tags"
								placeholder="태그1, 태그2, 태그3"
								style={{
									padding: "0.75rem",
									border: "1px solid #ccc",
									borderRadius: "8px",
									width: "100%",
									boxSizing: "border-box",
								}}
							/>
						</div>
						<button
							type="submit"
							id="upload-btn"
							style={{
								padding: "0.75rem 1.5rem",
								fontSize: "1rem",
								backgroundColor: "#0085ff",
								color: "white",
								border: "none",
								borderRadius: "8px",
								cursor: "pointer",
								alignSelf: "flex-start",
							}}
						>
							업로드
						</button>
					</form>
					<div id="upload-status" style={{ marginTop: "1rem" }}></div>
				</div>

				{/* 내 GIF 목록 */}
				<div style={{ marginTop: "2rem" }}>
					<h2>🎞️ 내 GIF 목록</h2>
					<div
						id="gif-list"
						style={{
							display: "grid",
							gridTemplateColumns:
								"repeat(auto-fill, minmax(250px, 1fr))",
							gap: "1rem",
						}}
					>
						<p>GIF 목록 로딩 중...</p>
					</div>
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
							// 프로필 로드
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

							// GIF 목록 로드
							async function loadGifs() {
								try {
									const res = await fetch('/api/gif');
									const data = await res.json();
									
									if (data.error) {
										document.getElementById('gif-list').innerHTML = 
											'<p style="color: red;">GIF 목록을 불러올 수 없습니다: ' + data.message + '</p>';
										return;
									}
									
									if (!data.gifs || data.gifs.length === 0) {
										document.getElementById('gif-list').innerHTML = 
											'<p style="color: #666;">아직 업로드한 GIF가 없습니다. 첫 번째 GIF를 업로드해보세요!</p>';
										return;
									}
									
									document.getElementById('gif-list').innerHTML = data.gifs.map(gif => {
										// DID에서 PDS 서버를 추출 (did:plc: -> bsky.social, did:web: -> 해당 도메인)
										const did = gif.uri.split('/')[2];
										const cid = gif.file.ref.$link || gif.file.ref.link;
										// 원본 GIF를 가져오기 위해 sync.getBlob 사용 (자동재생 지원)
										const gifUrl = \`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=\${encodeURIComponent(did)}&cid=\${cid}\`;
										
										return \`
										<div style="background: #fff; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; position: relative;">
											<img 
												src="\${gifUrl}" 
												alt="\${gif.alt || gif.title || 'GIF'}"
												style="width: 100%; aspect-ratio: 1; object-fit: cover; display: block;"
												loading="lazy"
											/>
											<div style="padding: 1rem;">
												<h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">\${gif.title || '제목 없음'}</h3>
												\${gif.tags && gif.tags.length > 0 
													? '<div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">' + 
														gif.tags.map(tag => '<span style="background: #e8f4ff; color: #0085ff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">#' + tag + '</span>').join('') + 
														'</div>'
													: ''
												}
												<div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
													<button onclick="editGif('\${gif.rkey}', '\${(gif.title || '').replace(/'/g, "\\\\'")}', '\${(gif.alt || '').replace(/'/g, "\\\\'")}', '\${(gif.tags || []).join(', ')}')" style="flex: 1; padding: 0.5rem; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer;">✏️ 수정</button>
													<button onclick="deleteGif('\${gif.rkey}')" style="flex: 1; padding: 0.5rem; background: #fee; color: #c00; border: none; border-radius: 6px; cursor: pointer;">🗑️ 삭제</button>
												</div>
											</div>
										</div>
									\`}).join('');
								} catch (err) {
									console.error('GIF list fetch error:', err);
									document.getElementById('gif-list').innerHTML = 
										'<p style="color: red;">GIF 목록을 불러오는 중 오류가 발생했습니다.</p>';
								}
							}
							loadGifs();

							// GIF 업로드
							document.getElementById('upload-form').addEventListener('submit', async (e) => {
								e.preventDefault();
								const form = e.target;
								const formData = new FormData(form);
								const statusEl = document.getElementById('upload-status');
								const uploadBtn = document.getElementById('upload-btn');
								
								uploadBtn.disabled = true;
								uploadBtn.textContent = '업로드 중...';
								statusEl.innerHTML = '<p style="color: #666;">업로드 중입니다...</p>';
								
								try {
									const res = await fetch('/api/gif', {
										method: 'POST',
										body: formData,
									});
									const data = await res.json();
									
									if (data.error) {
										statusEl.innerHTML = '<p style="color: red;">업로드 실패: ' + data.message + '</p>';
									} else {
										statusEl.innerHTML = '<p style="color: green;">✅ ' + data.message + '</p>';
										form.reset();
										loadGifs(); // 목록 새로고침
									}
								} catch (err) {
									statusEl.innerHTML = '<p style="color: red;">업로드 중 오류가 발생했습니다.</p>';
								} finally {
									uploadBtn.disabled = false;
									uploadBtn.textContent = '업로드';
								}
							});

							// GIF 삭제
							async function deleteGif(rkey) {
								if (!confirm('정말 이 GIF를 삭제하시겠습니까?')) return;
								
								try {
									const res = await fetch('/api/gif/' + rkey, { method: 'DELETE' });
									const data = await res.json();
									
									if (data.error) {
										alert('삭제 실패: ' + data.message);
									} else {
										alert(data.message);
										loadGifs();
									}
								} catch (err) {
									alert('삭제 중 오류가 발생했습니다.');
								}
							}

							// GIF 수정
							async function editGif(rkey, currentTitle, currentAlt, currentTags) {
								const title = prompt('새 제목을 입력하세요:', currentTitle);
								if (title === null) return; // 취소됨
								
								const alt = prompt('새 대체 텍스트를 입력하세요:', currentAlt);
								if (alt === null) return;
								
								const tagsStr = prompt('새 태그를 입력하세요 (쉼표로 구분):', currentTags);
								if (tagsStr === null) return;
								
								const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
								
								try {
									const res = await fetch('/api/gif/' + rkey, {
										method: 'PUT',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ title, alt, tags }),
									});
									const data = await res.json();
									
									if (data.error) {
										alert('수정 실패: ' + data.message);
									} else {
										alert(data.message);
										loadGifs();
									}
								} catch (err) {
									alert('수정 중 오류가 발생했습니다.');
								}
							}
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
