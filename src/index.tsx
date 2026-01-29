import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderer } from "./renderer";
import oauthRoutes from "./routes/oauth";
import gifRoutes from "./routes/gif";
import type { HonoEnv } from "./auth";
import { SESSION_COOKIE } from "./constants";
import { HomePage } from "./pages/home";
import { DetailPage } from "./pages/detail";
import { ProfilePage } from "./pages/profile";
import { UploadPage } from "./pages/upload";
import { LoginPage } from "./pages/login";
import { toGifView } from "./types/gif";
import { fetchProfile } from "./utils";

const app = new Hono<HonoEnv>();

app.use(renderer);

// OAuth 라우트 등록
app.route("/oauth", oauthRoutes);

// GIF API 라우트 등록
app.route("/api/gif", gifRoutes);

// ================================
// 메인 페이지 (홈 피드)
// ================================
app.get("/", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const activeTab = c.req.query("tab") || "for-you";
	const isLoggedIn = !!did;

	// GIF 목록 가져오기 (로그인한 경우 자신의 GIF, 아니면 빈 배열)
	let gifs: any[] = [];
	let avatarUrl: string | undefined;

	if (isLoggedIn) {
		try {
			// 1. Fetch profile first to get handle and avatar
			const profileRes = await fetch(
				new URL("/oauth/profile", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const profileData = await profileRes.json();
			if (!profileData.error) {
				avatarUrl = profileData.avatar;
			}

			// 2. Fetch GIFs
			const response = await fetch(
				new URL("/api/gif", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const data = await response.json();
			if (data.gifs) {
				// Add author info from session/profile
				gifs = data.gifs.map((gif: any) => ({
					...gif,
					authorDid: did,
					authorHandle: profileData.handle,
					authorAvatar: profileData.avatar,
				}));
			}
		} catch (err) {
			console.error("Failed to fetch GIFs or Profile:", err);
		}
	}

	return c.render(
		<HomePage
			isLoggedIn={isLoggedIn}
			gifs={gifs}
			activeTab={activeTab}
			avatarUrl={avatarUrl}
		/>,
	);
});

// ================================
// 로그인 페이지
// ================================
app.get("/login", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	// 이미 로그인되어 있으면 홈으로 리다이렉트
	if (did) {
		return c.redirect("/");
	}

	const error = c.req.query("error");
	const errorMessage = c.req.query("message");

	return c.render(<LoginPage error={error} errorMessage={errorMessage} />);
});

// ================================
// GIF 상세 페이지
// ================================
app.get("/gif/:rkey", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const rkey = c.req.param("rkey");
	const isLoggedIn = !!did;

	// GIF 상세 정보 가져오기
	try {
		const response = await fetch(
			new URL(`/api/gif/${rkey}`, c.req.url).toString(),
			{
				headers: { Cookie: c.req.header("Cookie") || "" },
			},
		);
		const data = await response.json();

		if (data.error) {
			return c.render(
				<div class="app">
					<main class="main-content">
						<div class="empty-state">
							<h3 class="empty-state-title">
								GIF를 찾을 수 없습니다
							</h3>
							<p class="empty-state-text">{data.message}</p>
							<a href="/" class="btn btn-primary">
								홈으로 돌아가기
							</a>
						</div>
					</main>
				</div>,
			);
		}

		// Extract author DID from URI
		const authorDid = data.uri ? data.uri.split("/")[2] : did;
		const authorProfile = await fetchProfile(authorDid);

		const gif = {
			...data,
			authorDid: authorDid,
			authorHandle: authorProfile?.handle || "unknown",
			authorAvatar: authorProfile?.avatar,
			authorDisplayName: authorProfile?.displayName,
			likeCount: Math.floor(Math.random() * 5000), // Mock for UI
			commentCount: Math.floor(Math.random() * 200),
		};
        
        // Fetch profile for avatar
		let avatarUrl: string | undefined;
		if (isLoggedIn) {
			try {
				const profileRes = await fetch(
					new URL("/oauth/profile", c.req.url).toString(),
					{
						headers: { Cookie: c.req.header("Cookie") || "" },
					},
				);
				const profileData = await profileRes.json();
				if (!profileData.error) {
					avatarUrl = profileData.avatar;
				}
			} catch (err) {
				console.error("Failed to fetch Profile:", err);
			}
		}

		return c.render(
			<DetailPage
				isLoggedIn={isLoggedIn}
				gif={gif}
				relatedGifs={[]}
				avatarUrl={avatarUrl}
			/>,
		);
	} catch (err) {
		console.error("Failed to fetch GIF:", err);
		return c.render(
			<div class="app">
				<main class="main-content">
					<div class="empty-state">
						<h3 class="empty-state-title">오류가 발생했습니다</h3>
						<p class="empty-state-text">
							GIF를 불러오는 중 문제가 발생했습니다.
						</p>
						<a href="/" class="btn btn-primary">
							홈으로 돌아가기
						</a>
					</div>
				</main>
			</div>,
		);
	}
});

// ================================
// 프로필 페이지 (자신)
// ================================
app.get("/profile", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	if (!did) {
		return c.redirect("/login");
	}

	try {
		// Fetch profile to get handle
		const profileRes = await fetch(
			new URL("/oauth/profile", c.req.url).toString(),
			{
				headers: { Cookie: c.req.header("Cookie") || "" },
			},
		);
		const profileData = await profileRes.json();
		if (!profileData.error && profileData.handle) {
			return c.redirect(`/profile/${profileData.handle}`);
		}
	} catch (err) {
		console.error("Failed to fetch profile for redirect:", err);
	}

	return c.redirect("/");
});

// ================================
// 프로필 페이지 (다른 사용자)
// ================================
app.get("/profile/:handle", async (c) => {
	const currentDid = getCookie(c, SESSION_COOKIE);
	const identifier = c.req.param("handle");
	const isLoggedIn = !!currentDid;

	let isOwnProfile = false;
	let profile: any = {
		handle: identifier,
		displayName: identifier,
		did: identifier.startsWith("did:") ? identifier : undefined,
	};
	let gifs: any[] = [];

	// Check if looking at own profile
	if (isLoggedIn) {
		try {
			const profileRes = await fetch(
				new URL("/oauth/profile", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const profileData = await profileRes.json();
			
			if (
				!profileData.error && 
				(profileData.handle === identifier || profileData.did === identifier)
			) {
				isOwnProfile = true;
				profile = {
					did: currentDid,
					handle: profileData.handle,
					displayName: profileData.displayName,
					avatar: profileData.avatar,
					description: profileData.description,
					isFollowing: false, // Own profile
				};

				// Fetch GIFs for own profile
				const gifsRes = await fetch(new URL("/api/gif", c.req.url).toString(), {
					headers: { Cookie: c.req.header("Cookie") || "" },
				});
				const gifsData = await gifsRes.json();
				if (gifsData.gifs) {
					gifs = gifsData.gifs;
				}
			}
		} catch (err) {
			console.error("Failed to check own profile:", err);
		}
	}

	return c.render(
		<ProfilePage
			isLoggedIn={isLoggedIn}
			isOwnProfile={isOwnProfile}
			profile={profile}
			gifs={gifs}
		/>,
	);
});

// ================================
// 업로드 페이지
// ================================
app.get("/upload", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const isLoggedIn = !!did;

	if (!isLoggedIn) {
		return c.redirect("/login");
	}

	const error = c.req.query("error");
	const success = c.req.query("success");

    // Fetch profile for avatar
    let avatarUrl: string | undefined;
    try {
        const profileRes = await fetch(
            new URL("/oauth/profile", c.req.url).toString(),
            {
                headers: { Cookie: c.req.header("Cookie") || "" },
            },
        );
        const profileData = await profileRes.json();
        if (!profileData.error) {
            avatarUrl = profileData.avatar;
        }
    } catch (err) {
        console.error("Failed to fetch Profile:", err);
    }

	return c.render(
		<UploadPage
			isLoggedIn={isLoggedIn}
			error={error}
			success={success}
			avatarUrl={avatarUrl}
		/>,
	);
});

export default app;
