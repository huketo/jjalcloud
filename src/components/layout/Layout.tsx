import type { FC, Child } from "hono/jsx";
import { Header } from "./Header";

type NavTab = "home" | "explore" | "upload" | "saved" | "profile";

interface LayoutProps {
	children: Child;
	isLoggedIn?: boolean;
	activeTab?: NavTab;
	showHeader?: boolean;
	showSearch?: boolean;
	showBack?: boolean;
	title?: string;
	avatarUrl?: string;
}

export const Layout: FC<LayoutProps> = ({
	children,
	isLoggedIn = false,
	showHeader = true,
	showSearch = false,
	showBack = false,
	title,
	avatarUrl,
}) => {
	return (
		<div class="app">
			{showHeader && (
				<Header
					isLoggedIn={isLoggedIn}
					showSearch={showSearch}
					showBack={showBack}
					title={title}
					avatarUrl={avatarUrl}
				/>
			)}

			<main class="main-content">{children}</main>
		</div>
	);
};
