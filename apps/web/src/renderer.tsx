import { jsxRenderer } from "hono/jsx-renderer";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";

export const renderer = jsxRenderer(({ children }) => {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta
					name="description"
					content="AT Protocol based decentralized GIF sharing platform"
				/>
				<title>jjalcloud</title>
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
