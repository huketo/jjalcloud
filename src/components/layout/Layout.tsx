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
		<div class="flex flex-col min-h-screen pb-[72px] w-full max-w-[100vw] overflow-x-hidden">
			{showHeader && (
				<Header
					isLoggedIn={isLoggedIn}
					showBack={showBack}
					title={title}
					avatarUrl={avatarUrl}
				/>
			)}

			<main class="flex-1 w-full max-w-[1200px] mx-auto p-4 pt-[calc(60px+1rem)] box-border">
				{children}
			</main>
		</div>
	);
};
