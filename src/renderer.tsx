import { jsxRenderer } from "hono/jsx-renderer";
import { Link, ViteClient } from "vite-ssr-components/hono";

export const renderer = jsxRenderer(({ children }) => {
	return (
		<html lang="ko">
			<head>
				<meta charset="UTF-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				/>
				<meta
					name="description"
					content="AT Protocol 기반 탈중앙화 GIF 공유 플랫폼"
				/>
				<title>jjalcloud</title>
				<ViteClient />
				<Link href="/src/style.css" rel="stylesheet" />
			</head>
			<body>{children}</body>
		</html>
	);
});
