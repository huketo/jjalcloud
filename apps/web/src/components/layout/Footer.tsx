import type { FC } from "hono/jsx";

interface FooterProps {
	isLoggedIn?: boolean;
}

interface SitemapLink {
	href: string;
	label: string;
}

export const Footer: FC<FooterProps> = ({ isLoggedIn = false }) => {
	const sitemapLinks: SitemapLink[] = [
		{ href: "/", label: "Home" },
		{ href: "/upload", label: "Upload" },
		{
			href: isLoggedIn ? "/profile" : "/login",
			label: isLoggedIn ? "Profile" : "Login",
		},
		{ href: "/terms", label: "Terms of Service" },
		{ href: "/privacy", label: "Privacy Policy" },
	];

	return (
		<footer class="w-full border-t border-border-light bg-bg-surface/80 backdrop-blur-md mt-10">
			<div class="max-w-[1200px] mx-auto px-4 py-8">
				<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div class="space-y-2">
						<p class="text-lg font-bold text-brand-primary">jjalcloud</p>
						<p class="text-sm text-text-secondary max-w-xl leading-relaxed">
							A decentralized GIF sharing platform built on AT Protocol.
						</p>
					</div>

					<nav aria-label="Footer sitemap" class="space-y-2">
						<p class="text-sm font-semibold text-text">Sitemap</p>
						<div class="flex flex-wrap gap-x-4 gap-y-2">
							{sitemapLinks.map((link) => (
								<a
									key={link.href}
									href={link.href}
									class="text-sm text-text-secondary no-underline hover:text-brand-primary hover:underline transition-colors"
								>
									{link.label}
								</a>
							))}
						</div>
					</nav>
				</div>

				<div class="mt-6 pt-4 border-t border-border-light text-xs text-text-muted">
					{new Date().getFullYear()} jjalcloud. All rights reserved.
				</div>
			</div>
		</footer>
	);
};

export default Footer;
