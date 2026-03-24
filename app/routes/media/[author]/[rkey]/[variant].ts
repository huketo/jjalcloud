import { Hono } from "hono";
import { env } from "../../../../env";
import { convertToVideo } from "../../../../indexer/media";
import { existsInR2, r2Key } from "../../../../lib/r2";

const app = new Hono();

app.get("/", async (c) => {
	const author = c.req.param("author") ?? "";
	const rkey = c.req.param("rkey") ?? "";
	const variant = c.req.param("variant") ?? "";

	if (variant !== "mp4" && variant !== "tinymp4" && variant !== "webm") {
		return c.text("invalid variant", 400);
	}

	const key = r2Key(author, rkey, variant);
	if (await existsInR2(key)) {
		return c.redirect(`${env.R2_PUBLIC_URL}/${key}`);
	}

	try {
		const url = await convertToVideo(author, rkey, variant);
		return c.redirect(url);
	} catch {
		const originalKey = r2Key(author, rkey, "original.gif");
		return c.redirect(`${env.R2_PUBLIC_URL}/${originalKey}`);
	}
});

export default app;
