import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { oauthClient } from "../../auth/client";
import { db } from "../../db/client";
import { users } from "../../db/schema";

const app = new Hono();

app.get("/login", async (c) => {
	const handle = c.req.query("handle");
	if (!handle) return c.text("handle required", 400);

	const { url } = await oauthClient.authorize({
		target: { type: "account", identifier: handle as any },
	});
	return c.redirect(url.toString());
});

app.get("/callback", async (c) => {
	const params = new URLSearchParams(c.req.url.split("?")[1]);
	const { session } = await oauthClient.callback(params);
	const did = session.sub;
	const handle = (session as any).info?.handle ?? did;

	await db
		.insert(users)
		.values({ did, handle, lastLoginAt: new Date() })
		.onConflictDoUpdate({
			target: users.did,
			set: { handle, lastLoginAt: new Date() },
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

app.get("/logout", (c) => {
	deleteCookie(c, "did", { path: "/" });
	return c.redirect("/");
});

app.get("/client-metadata.json", (c) => {
	return c.json(oauthClient.metadata);
});

export default app;
