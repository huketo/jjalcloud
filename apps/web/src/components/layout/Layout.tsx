import type { Child, FC } from "hono/jsx";
import { Footer } from "./Footer";
import { Header } from "./Header";

type NavTab = "home" | "explore" | "upload" | "saved" | "profile";

interface LayoutProps {
	children: Child;
	isLoggedIn?: boolean;
	activeTab?: NavTab;
	showHeader?: boolean;
	showSearch?: boolean;
	showBack?: boolean;
	showFooter?: boolean;
	title?: string;
	avatarUrl?: string;
}

export const Layout: FC<LayoutProps> = ({
	children,
	isLoggedIn = false,
	showHeader = true,
	showSearch = true,
	showBack = false,
	showFooter = true,
	title,
	avatarUrl,
}) => {
	return (
		<div class="flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden">
			{showHeader && (
				<Header
					isLoggedIn={isLoggedIn}
					showSearch={showSearch}
					showBack={showBack}
					title={title}
					avatarUrl={avatarUrl}
				/>
			)}

			<main class="flex-1 w-full max-w-[1200px] mx-auto p-4 pt-[calc(64px+1rem)] box-border">
				{children}
			</main>

			{showFooter && <Footer isLoggedIn={isLoggedIn} />}
		</div>
	);
};
