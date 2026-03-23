import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/client";
import { gifs } from "../../db/schema";
import { cfResizeUrl, r2Key } from "../../lib/r2";
import { getFeed, getLikeCount } from "../../lib/search";
import { Layout } from "./layout";

const web = new Hono();

function gifOriginalUrl(author: string, rkey: string): string {
	const { env } = require("../../env");
	return `${env.R2_PUBLIC_URL}/${r2Key(author, rkey, "original.gif")}`;
}

web.get("/", async (c) => {
	const results = await getFeed(db, 20);
	return c.html(
		<Layout>
			<h1>jjalcloud</h1>
			<div id="feed">
				{results.map((gif) => (
					<a href={`/gif/${gif.author}/${gif.rkey}`} key={gif.uri}>
						<img
							src={cfResizeUrl(gifOriginalUrl(gif.author, gif.rkey), 220)}
							alt={gif.alt ?? gif.title ?? ""}
							loading="lazy"
						/>
					</a>
				))}
			</div>
		</Layout>,
	);
});

web.get("/gif/:author/:rkey", async (c) => {
	const { author, rkey } = c.req.param();
	const uri = `at://${author}/com.jjalcloud.feed.gif/${rkey}`;
	const gif = await db.query.gifs.findFirst({ where: eq(gifs.uri, uri), with: { tags: true } });
	if (!gif) return c.notFound();
	const likeCount = await getLikeCount(db, uri);
	return c.html(
		<Layout title={gif.title ?? "GIF"}>
			<article>
				<img src={cfResizeUrl(gifOriginalUrl(gif.author, gif.rkey), 480)} alt={gif.alt ?? ""} />
				<h2>{gif.title}</h2>
				{gif.alt && <p>{gif.alt}</p>}
				<div>
					{gif.tags?.map((t) => (
						<span key={t.name}>#{t.name} </span>
					))}
				</div>
				<p>Likes: {likeCount}</p>
			</article>
		</Layout>,
	);
});

web.get("/profile/:did", async (c) => {
	const did = c.req.param("did");
	const results = await db.query.gifs.findMany({
		where: eq(gifs.author, did),
		orderBy: [desc(gifs.createdAt)],
		limit: 50,
	});
	return c.html(
		<Layout title={did}>
			<h1>{did}</h1>
			<div id="feed">
				{results.map((gif) => (
					<a href={`/gif/${gif.author}/${gif.rkey}`} key={gif.uri}>
						<img
							src={cfResizeUrl(gifOriginalUrl(gif.author, gif.rkey), 220)}
							alt={gif.alt ?? ""}
							loading="lazy"
						/>
					</a>
				))}
			</div>
		</Layout>,
	);
});

export { web };
