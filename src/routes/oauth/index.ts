import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { oauthClient } from "../../auth/client";
import { db } from "../../db/client";
import { users } from "../../db/schema";

const oauth = new Hono();

oauth.get("/login", async (c) => {
	const handle = c.req.query("handle");
	if (!handle) return c.text("handle required", 400);

	const { url } = await oauthClient.authorize({
		target: { type: "account", identifier: handle },
	});
	return c.redirect(url.toString());
});

oauth.get("/callback", async (c) => {
	const params = new URLSearchParams(c.req.url.split("?")[1]);
	const { session } = await oauthClient.callback(params);
	const did = session.sub;

	await db
		.insert(users)
		.values({ did, handle: did, lastLoginAt: new Date() })
		.onConflictDoUpdate({
			target: users.did,
			set: { lastLoginAt: new Date() },
		});

	setCookie(c, "did", did, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		maxAge: 60 * 60 * 24 * 7,
		path: "/",
	});

	return c.redirect("/");
});

oauth.get("/logout", (c) => {
	deleteCookie(c, "did", { path: "/" });
	return c.redirect("/");
});

oauth.get("/client-metadata.json", (c) => {
	return c.json(oauthClient.metadata);
});

export { oauth };
