import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ title, children }) => {
	return (
		<html lang="ko">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title ? `${title} - jjalcloud` : "jjalcloud"}</title>
			</head>
			<body>
				<nav>
					<a href="/">jjalcloud</a>
				</nav>
				<main>{children}</main>
			</body>
		</html>
	);
};
