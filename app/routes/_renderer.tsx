import { reactRenderer } from "@hono/react-renderer";

export default reactRenderer(({ children, title }) => {
	return (
		<html lang="ko">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{import.meta.env.PROD ? (
					<>
						<link rel="stylesheet" href="/static/assets/style.css" />
						<script type="module" src="/static/client.js" />
					</>
				) : (
					<>
						<link rel="stylesheet" href="/app/style.css" />
						<script type="module" src="/app/client.ts" />
					</>
				)}
				{title ? <title>{title} - jjalcloud</title> : <title>jjalcloud</title>}
			</head>
			<body>
				<nav>
					<a href="/">jjalcloud</a>
				</nav>
				<main>{children}</main>
			</body>
		</html>
	);
});
