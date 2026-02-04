import type { BlobRef } from "@atproto/lexicon";
import { globalGifs } from "@jjalcloud/common/db/schema";
import { desc, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { HonoEnv } from "./auth";
import { SESSION_COOKIE } from "./constants";
import { DetailPage } from "./pages/detail";
import { EditPage } from "./pages/edit";
import { HomePage } from "./pages/home";
import { LoginPage } from "./pages/login";
import { ProfilePage } from "./pages/profile";
import { UploadPage } from "./pages/upload";
import { renderer } from "./renderer";
import gifRoutes from "./routes/gif";
import likeRoutes from "./routes/like";
import oauthRoutes from "./routes/oauth";
import type { GifView } from "./types/gif";
import { fetchProfile } from "./utils";

// Extended GifView with author info for internal use
interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
}

// Profile data structure
interface ProfileData {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	description?: string;
	isFollowing?: boolean;
}

const app = new Hono<HonoEnv>();

app.use(renderer);

// Register OAuth routes
app.route("/oauth", oauthRoutes);

// Dev Helper removed: Auto-fix logic was causing crashes. Use migrations instead.

// Register GIF API routes
app.route("/api/gif", gifRoutes);
app.route("/api/gif", gifRoutes);
app.route("/api/like", likeRoutes);

// Debug endpoint
app.get("/api/debug/tables", async (c) => {
	try {
		const db = c.env.jjalcloud_db;
		const result = await db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all();
		return c.json(result);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 500);
	}
});

// Global Feed API (Load More)
app.get("/api/feed", async (c) => {
	const cursor = c.req.query("cursor");
	const limit = 12;
	const db = drizzle(c.env.jjalcloud_db);

	try {
		const query = db
			.select()
			.from(globalGifs)
			.orderBy(desc(globalGifs.createdAt))
			.limit(limit);

		const results = cursor
			? await db
					.select()
					.from(globalGifs)
					.where(lt(globalGifs.createdAt, new Date(cursor)))
					.orderBy(desc(globalGifs.createdAt))
					.limit(limit)
					.all()
			: await query.all();

		// Fetch profiles for authors
		const uniqueDids = [...new Set(results.map((g) => g.author))];
		const profiles = new Map();

		await Promise.all(
			uniqueDids.map(async (did) => {
				const profile = await fetchProfile(did);
				if (profile) profiles.set(did, profile);
			}),
		);

		const gifs = results.map((g) => {
			const profile = profiles.get(g.author);
			// Parse file blob if needed, but for now assuming we construct URL correctly
			// Need to reconstruct the structure expected by frontend
			// g.file is stored as specific object in D1 (JSON)
			// But types/gif.ts expects `file: BlobRef`.
			// The `globalGifs` table `file` column is JSON. Cast it.

			return {
				uri: g.uri,
				cid: g.cid,
				rkey: g.uri.split("/").pop() || "",
				title: g.title,
				alt: g.alt,
				tags: g.tags ? JSON.parse(g.tags) : [],
				file: g.file,
				createdAt: g.createdAt.toISOString(),
				authorDid: g.author,
				authorHandle: profile?.handle || "unknown",
				authorAvatar: profile?.avatar,
				likeCount: 0, // Todo: join with likes
				isLiked: false,
			};
		});

		return c.json({ gifs });
	} catch (err) {
		console.error("Feed API Error:", err);
		return c.json({ error: "Failed to fetch feed" }, 500);
	}
});

// ================================
// Main Page (Home Feed)
// ================================
app.get("/", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const activeTab = c.req.query("tab") || "for-you";
	const isLoggedIn = !!did;

	// Fetch GIF list (Public Feed from D1)
	let gifs: GifViewWithAuthor[] = [];
	let avatarUrl: string | undefined;

	// Fetch user profile if logged in
	if (isLoggedIn) {
		try {
			const profileRes = await fetch(
				new URL("/oauth/profile", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const profileData = (await profileRes.json()) as ProfileData & {
				error?: string;
			};
			if (!profileData.error) {
				avatarUrl = profileData.avatar;
			}
		} catch (err) {
			console.error("Failed to fetch Profile:", err);
		}
	}

	// Fetch Global Feed
	try {
		const db = drizzle(c.env.jjalcloud_db);
		const results = await db
			.select()
			.from(globalGifs)
			.orderBy(desc(globalGifs.createdAt))
			.limit(20)
			.all();

		// Fetch profiles for authors
		const uniqueDids = [...new Set(results.map((g) => g.author))];
		const profiles = new Map();

		await Promise.all(
			uniqueDids.map(async (did) => {
				const profile = await fetchProfile(did);
				if (profile) profiles.set(did, profile);
			}),
		);

		gifs = results.map((g) => {
			const profile = profiles.get(g.author);
			// Assuming g.file is the BlobRef object (parsed from JSON by drizzle mode: "json")
			return {
				uri: g.uri,
				cid: g.cid,
				rkey: g.uri.split("/").pop() || "",
				title: g.title ?? undefined,
				alt: g.alt ?? undefined,
				tags: g.tags ? JSON.parse(g.tags) : [],
				file: g.file as BlobRef,
				createdAt: g.createdAt.toISOString(),
				authorDid: g.author,
				authorHandle: profile?.handle || "unknown",
				authorAvatar: profile?.avatar,
				likeCount: 0,
				isLiked: false,
			};
		});
	} catch (err) {
		console.error("Failed to fetch global feed:", err);
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
// Login Page
// ================================
app.get("/login", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);

	// Redirect to home if already logged in
	if (did) {
		return c.redirect("/");
	}

	const error = c.req.query("error");
	const errorMessage = c.req.query("message");

	return c.render(<LoginPage error={error} errorMessage={errorMessage} />);
});

// ================================
// GIF Detail Page
// ================================
app.get("/gif/:rkey", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	const rkey = c.req.param("rkey");
	const isLoggedIn = !!did;

	// Fetch GIF Details
	try {
		const response = await fetch(
			new URL(`/api/gif/${rkey}`, c.req.url).toString(),
			{
				headers: { Cookie: c.req.header("Cookie") || "" },
			},
		);
		const data = (await response.json()) as {
			error?: boolean;
			message?: string;
			uri?: string;
			[key: string]: unknown;
		};

		if (data.error) {
			return c.render(
				<div class="app">
					<main class="main-content">
						<div class="empty-state">
							<h3 class="empty-state-title">GIF Not Found</h3>
							<p class="empty-state-text">{data.message}</p>
							<a href="/" class="btn btn-primary">
								Return to Home
							</a>
						</div>
					</main>
				</div>,
			);
		}

		// Extract author DID from URI
		const authorDid = data.uri ? data.uri.split("/")[2] : did;
		const authorProfile = authorDid ? await fetchProfile(authorDid) : null;

		const gif = {
			uri: data.uri as string,
			cid: data.cid as string,
			rkey: rkey,
			title: data.title as string | undefined,
			alt: data.alt as string | undefined,
			tags: (data.tags as string[]) || [],
			file: data.file as BlobRef,
			createdAt: data.createdAt as string,
			authorDid: authorDid,
			authorHandle: authorProfile?.handle || "unknown",
			authorAvatar: authorProfile?.avatar,
			authorDisplayName: authorProfile?.displayName,
			likeCount:
				(data.likeCount as number | undefined) ??
				Math.floor(Math.random() * 5000),
			isLiked: (data.isLiked as boolean | undefined) ?? false,
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
				const profileData = (await profileRes.json()) as ProfileData & {
					error?: string;
				};
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
				isOwner={did === authorDid}
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
						<h3 class="empty-state-title">An error occurred</h3>
						<p class="empty-state-text">Failed to load GIF.</p>
						<a href="/" class="btn btn-primary">
							Return to Home
						</a>
					</div>
				</main>
			</div>,
		);
	}
});

// ================================
// Profile Page (Self)
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
		const profileData = (await profileRes.json()) as ProfileData & {
			error?: string;
			handle?: string;
		};
		if (!profileData.error && profileData.handle) {
			return c.redirect(`/profile/${profileData.handle}`);
		}
	} catch (err) {
		console.error("Failed to fetch profile for redirect:", err);
	}

	return c.redirect("/");
});

// ================================
// Profile Page (Other User)
// ================================
app.get("/profile/:handle", async (c) => {
	const currentDid = getCookie(c, SESSION_COOKIE);
	const identifier = c.req.param("handle");
	const isLoggedIn = !!currentDid;

	let isOwnProfile = false;
	let profile: ProfileData = {
		handle: identifier,
		displayName: identifier,
		did: identifier.startsWith("did:") ? identifier : "",
	};
	let gifs: GifViewWithAuthor[] = [];

	// Check if looking at own profile
	if (isLoggedIn) {
		try {
			const profileRes = await fetch(
				new URL("/oauth/profile", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const profileData = (await profileRes.json()) as ProfileData & {
				error?: string;
				handle?: string;
				did?: string;
			};

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
				const gifsData = (await gifsRes.json()) as {
					gifs?: GifViewWithAuthor[];
				};
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
// Upload Page
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
		const profileData = (await profileRes.json()) as ProfileData & {
			error?: string;
		};
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

// ================================
// Edit Page
// ================================
app.get("/edit/:rkey", async (c) => {
	const did = getCookie(c, SESSION_COOKIE);
	if (!did) {
		return c.redirect("/login");
	}

	const rkey = c.req.param("rkey");

	// Fetch GIF Details to verify ownership and populate form
	try {
		const response = await fetch(
			new URL(`/api/gif/${rkey}`, c.req.url).toString(),
			{
				headers: { Cookie: c.req.header("Cookie") || "" },
			},
		);
		const data = (await response.json()) as {
			error?: boolean;
			message?: string;
			uri?: string;
			[key: string]: unknown;
		};

		if (data.error) {
			return c.render(
				<div class="app">
					<main class="main-content">
						<div class="empty-state">
							<h3>GIF Not Found</h3>
							<p>{data.message}</p>
							<a href="/" class="btn btn-primary">
								Return to Home
							</a>
						</div>
					</main>
				</div>,
			);
		}

		// Check Ownership
		const authorDid = data.uri ? data.uri.split("/")[2] : "";
		if (authorDid !== did) {
			return c.text("Unauthorized", 403);
		}

		// Fetch profile for avatar
		let avatarUrl: string | undefined;
		try {
			const profileRes = await fetch(
				new URL("/oauth/profile", c.req.url).toString(),
				{
					headers: { Cookie: c.req.header("Cookie") || "" },
				},
			);
			const profileData = (await profileRes.json()) as ProfileData & {
				error?: string;
			};
			if (!profileData.error) {
				avatarUrl = profileData.avatar;
			}
		} catch (err) {
			console.error("Failed to fetch Profile:", err);
		}

		const gif = {
			uri: data.uri as string,
			cid: data.cid as string,
			rkey: rkey,
			title: data.title as string | undefined,
			alt: data.alt as string | undefined,
			tags: (data.tags as string[]) || [],
			file: data.file as BlobRef,
			createdAt: data.createdAt as string,
			authorDid: authorDid,
		};

		return c.render(
			<EditPage isLoggedIn={true} gif={gif} avatarUrl={avatarUrl} />,
		);
	} catch (err) {
		console.error("Failed to load GIF for editing:", err);
		return c.text("Internal Server Error", 500);
	}
});

export default app;
