import type { BlobRef } from "@atproto/lexicon";
import { gifs as gifsTable } from "@jjalcloud/common/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";
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
app.route("/api/like", likeRoutes);

// Global Feed API (Load More / Infinite Scroll)
app.get("/api/feed", async (c) => {
	const cursor = c.req.query("cursor");
	const limitParam = c.req.query("limit");
	const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10), 50) : 12;
	const db = drizzle(c.env.jjalcloud_db);

	try {
		const query = db
			.select()
			.from(gifsTable)
			.orderBy(desc(gifsTable.createdAt))
			.limit(limit);

		const results = cursor
			? await db
					.select()
					.from(gifsTable)
					.where(lt(gifsTable.createdAt, new Date(cursor)))
					.orderBy(desc(gifsTable.createdAt))
					.limit(limit)
					.all()
			: await query.all();

		// Fetch profiles for authors
		const uniqueDids = [...new Set(results.map((g) => g.author))];
		const profiles = new Map();

		await Promise.all(
			uniqueDids.map(async (did) => {
				const profile = await fetchProfile(did, db);
				if (profile) profiles.set(did, profile);
			}),
		);

		const gifs = results.map((g) => {
			const profile = profiles.get(g.author);
			// Parse file blob if needed, but for now assuming we construct URL correctly
			// Need to reconstruct the structure expected by frontend
			// g.file is stored as specific object in D1 (JSON)
			// But types/gif.ts expects `file: BlobRef`.
			// The `gifs` table `file` column is JSON. Cast it.

			return {
				uri: g.uri,
				cid: g.cid,
				rkey: g.uri.split("/").pop() || "",
				title: g.title,
				alt: g.alt,
				tags: g.tags ? JSON.parse(g.tags) : [],
				file: g.file,
				width: g.width ?? undefined,
				height: g.height ?? undefined,
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
	if (isLoggedIn && did) {
		const db = drizzle(c.env.jjalcloud_db);
		const profileData = await fetchProfile(did, db);
		if (profileData) {
			avatarUrl = profileData.avatar;
		}
	}

	// Fetch Global Feed
	try {
		const db = drizzle(c.env.jjalcloud_db);
		const results = await db
			.select()
			.from(gifsTable)
			.orderBy(desc(gifsTable.createdAt))
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
				width: g.width ?? undefined,
				height: g.height ?? undefined,
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

	try {
		// Use Direct DB Access instead of internal fetch
		const db = drizzle(c.env.jjalcloud_db);

		// 1. Find GIF by RKey (Suffix Match)
		const foundGifs = await db
			.select()
			.from(gifsTable)
			.where(sql`${gifsTable.uri} LIKE ${`%${rkey}`}`)
			.limit(1)
			.all();

		if (!foundGifs || foundGifs.length === 0) {
			return c.render(
				<div class="app">
					<main class="main-content">
						<div class="empty-state">
							<h3 class="empty-state-title">GIF Not Found</h3>
							<p class="empty-state-text">
								Could not identify GIF with ID: {rkey}
							</p>
							<a href="/" class="btn btn-primary">
								Return to Home
							</a>
						</div>
					</main>
				</div>,
			);
		}

		const g = foundGifs[0];

		// 2. Fetch Author Profile
		const authorProfile = await fetchProfile(g.author);

		// 3. Construct View Model
		const gif = {
			uri: g.uri,
			cid: g.cid,
			rkey: rkey,
			title: g.title ?? undefined,
			alt: g.alt ?? undefined,
			tags: g.tags ? JSON.parse(g.tags as string) : [],
			file: g.file as BlobRef,
			width: g.width ?? undefined,
			height: g.height ?? undefined,
			createdAt: g.createdAt.toISOString(),
			authorDid: g.author,
			authorHandle: authorProfile?.handle || "unknown",
			authorAvatar: authorProfile?.avatar,
			authorDisplayName: authorProfile?.displayName,
			likeCount: 0, // Todo: fetch from likes table
			isLiked: false, // Todo: check if logged in user liked
			commentCount: 0,
		};

		// Fetch profile for avatar (Navbar)
		let avatarUrl: string | undefined;
		if (isLoggedIn && did) {
			const profileData = await fetchProfile(did, db);
			if (profileData) {
				avatarUrl = profileData.avatar;
			}
		}

		return c.render(
			<DetailPage
				isLoggedIn={isLoggedIn}
				isOwner={did === g.author}
				gif={gif}
				relatedGifs={[]}
				avatarUrl={avatarUrl}
			/>,
		);
	} catch (err) {
		console.error("Failed to render GIF page:", err);
		return c.render(
			<div class="app">
				<main class="main-content">
					<div class="empty-state">
						<h3 class="empty-state-title">An error occurred</h3>
						<p class="empty-state-text">Failed to load GIF: {String(err)}</p>
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
		const db = drizzle(c.env.jjalcloud_db);
		const profileData = await fetchProfile(did, db);

		if (profileData?.handle) {
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
	if (isLoggedIn && currentDid) {
		try {
			const db = drizzle(c.env.jjalcloud_db);
			const profileData = await fetchProfile(currentDid, db);

			if (
				profileData &&
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

				// Fetch GIFs for own profile (Direct DB)
				const userGifs = await db
					.select()
					.from(gifsTable)
					.where(eq(gifsTable.author, currentDid))
					.orderBy(desc(gifsTable.createdAt))
					.all();

				gifs = userGifs.map((g) => ({
					uri: g.uri,
					cid: g.cid,
					rkey: g.uri.split("/").pop() || "",
					title: g.title ?? undefined,
					alt: g.alt ?? undefined,
					tags: g.tags ? JSON.parse(g.tags as string) : [],
					file: g.file as BlobRef,
					width: g.width ?? undefined,
					height: g.height ?? undefined,
					createdAt: g.createdAt.toISOString(),
					authorDid: g.author,
					authorHandle: profile.handle,
					authorAvatar: profile.avatar,
					likeCount: 0,
					isLiked: false,
				}));
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
		const db = drizzle(c.env.jjalcloud_db);
		const profileData = await fetchProfile(did, db);
		if (profileData) {
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
		const db = drizzle(c.env.jjalcloud_db);

		// 1. Fetch GIF (Direct DB)
		const foundGifs = await db
			.select()
			.from(gifsTable)
			.where(sql`${gifsTable.uri} LIKE ${`%${rkey}`}`)
			.limit(1)
			.all();

		if (!foundGifs || foundGifs.length === 0) {
			return c.render(
				<div class="app">
					<main class="main-content">
						<div class="empty-state">
							<h3>GIF Not Found</h3>
							<p>Could not find GIF</p>
							<a href="/" class="btn btn-primary">
								Return to Home
							</a>
						</div>
					</main>
				</div>,
			);
		}

		const data = foundGifs[0];

		// Check Ownership
		const authorDid = data.author;
		if (authorDid !== did) {
			return c.text("Unauthorized", 403);
		}

		// Fetch profile for avatar
		let avatarUrl: string | undefined;
		try {
			const profileData = await fetchProfile(did, db);
			if (profileData) {
				avatarUrl = profileData.avatar;
			}
		} catch (err) {
			console.error("Failed to fetch Profile:", err);
		}

		const gif = {
			uri: data.uri,
			cid: data.cid,
			rkey: rkey,
			title: data.title ?? undefined,
			alt: data.alt ?? undefined,
			tags: data.tags ? JSON.parse(data.tags as string) : [],
			file: data.file as BlobRef,
			width: data.width ?? undefined,
			height: data.height ?? undefined,
			createdAt: data.createdAt.toISOString(),
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
