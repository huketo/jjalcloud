import type { FC } from "hono/jsx";
import { Layout } from "../components";

interface PrivacyPageProps {
	isLoggedIn: boolean;
	avatarUrl?: string;
}

export const PrivacyPage: FC<PrivacyPageProps> = ({
	isLoggedIn,
	avatarUrl,
}) => {
	return (
		<Layout isLoggedIn={isLoggedIn} showSearch={false} avatarUrl={avatarUrl}>
			<div class="max-w-3xl mx-auto py-8 md:py-12">
				<header class="mb-8 pb-6 border-b border-border-light">
					<h1 class="text-3xl font-bold text-text mb-2">Privacy Policy</h1>
					<p class="text-sm text-text-secondary">
						Last updated: February 12, 2026
					</p>
				</header>

				<div class="space-y-6 text-text-secondary leading-relaxed">
					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							1. Information We Collect
						</h2>
						<p>
							When you sign in and use jjalcloud, we may process account
							identifiers, profile information, uploaded content metadata, and
							basic technical logs needed to keep the service running.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							2. How We Use Information
						</h2>
						<p>
							We use data to authenticate users, serve content, operate
							indexing/search features, improve reliability, and protect the
							service against abuse.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							3. Data Storage and Sharing
						</h2>
						<p>
							Because jjalcloud is built on AT Protocol, some content and
							metadata may be stored or distributed through decentralized
							infrastructure. We do not sell your personal information.
						</p>
						<p>
							We may disclose information when legally required or to protect
							the security and integrity of the platform.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							4. Cookies and Sessions
						</h2>
						<p>
							We use essential session cookies for sign-in state and service
							security. These cookies are necessary for core functionality.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">5. Your Rights</h2>
						<p>
							You can manage content through your account and AT Protocol tools.
							Depending on your jurisdiction, you may have rights to request
							access, correction, or deletion of certain personal data.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">6. Policy Updates</h2>
						<p>
							We may update this Privacy Policy to reflect product or legal
							requirements. Material changes will be posted on this page with a
							revised date.
						</p>
					</section>
				</div>
			</div>
		</Layout>
	);
};

export default PrivacyPage;
