import { jsxRenderer } from "hono/jsx-renderer";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";
import type { OpenGraphMeta } from "./types";

const DEFAULT_DESCRIPTION =
	"AT Protocol based decentralized GIF sharing platform";

export const renderer = jsxRenderer(({ children }, c) => {
	const requestUrl = new URL(c.req.url);
	const defaultOpenGraph: OpenGraphMeta = {
		title: "jjalcloud",
		description: DEFAULT_DESCRIPTION,
		image: new URL("/title.png", requestUrl.origin).toString(),
		imageAlt: "jjalcloud preview image",
		url: requestUrl.toString(),
		type: "website",
	};
	const pageOpenGraph = c.get("openGraph");
	const openGraph = pageOpenGraph
		? { ...defaultOpenGraph, ...pageOpenGraph }
		: defaultOpenGraph;

	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="description" content={openGraph.description} />
				<title>{openGraph.title}</title>
				<meta property="og:title" content={openGraph.title} />
				<meta property="og:description" content={openGraph.description} />
				<meta property="og:type" content={openGraph.type || "website"} />
				<meta property="og:url" content={openGraph.url} />
				<meta property="og:image" content={openGraph.image} />
				<meta property="og:image:alt" content={openGraph.imageAlt} />
				<meta property="og:site_name" content="jjalcloud" />
				<ViteClient />
				<link
					href="https://unpkg.com/@csstools/normalize.css"
					rel="stylesheet"
				/>
				<Link href="/src/uno.css" rel="stylesheet" />
			</head>
			<body>
				{children}
				<div id="toast-root"></div>
				<Script src="/src/client.tsx" type="module" />
			</body>
		</html>
	);
});
