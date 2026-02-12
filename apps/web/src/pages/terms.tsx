import type { FC } from "hono/jsx";
import { Layout } from "../components";

interface TermsPageProps {
	isLoggedIn: boolean;
	avatarUrl?: string;
}

export const TermsPage: FC<TermsPageProps> = ({ isLoggedIn, avatarUrl }) => {
	return (
		<Layout isLoggedIn={isLoggedIn} showSearch={false} avatarUrl={avatarUrl}>
			<div class="max-w-3xl mx-auto py-8 md:py-12">
				<header class="mb-8 pb-6 border-b border-border-light">
					<h1 class="text-3xl font-bold text-text mb-2">Terms of Service</h1>
					<p class="text-sm text-text-secondary">
						Last updated: February 12, 2026
					</p>
				</header>

				<div class="space-y-6 text-text-secondary leading-relaxed">
					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							1. Acceptance of Terms
						</h2>
						<p>
							By using jjalcloud, you agree to these Terms of Service and any
							applicable policies. If you do not agree, please stop using the
							service.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							2. Account and Access
						</h2>
						<p>
							You are responsible for maintaining access to your Bluesky and AT
							Protocol account. You must provide accurate information and comply
							with the rules of the underlying network.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">3. User Content</h2>
						<p>
							You retain ownership of content you upload. You grant jjalcloud a
							limited right to store, display, and process your content to
							operate the service.
						</p>
						<p>
							Do not upload illegal, infringing, or harmful content. We may
							remove content or restrict access when required by law or policy.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							4. Service Availability
						</h2>
						<p>
							jjalcloud is provided on an "as is" and "as available" basis. We
							do not guarantee uninterrupted availability, error-free operation,
							or permanent retention of all content.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">
							5. Limitation of Liability
						</h2>
						<p>
							To the maximum extent permitted by law, jjalcloud and its
							maintainers are not liable for indirect, incidental, or
							consequential damages resulting from your use of the service.
						</p>
					</section>

					<section class="space-y-2">
						<h2 class="text-lg font-semibold text-text">6. Changes to Terms</h2>
						<p>
							We may update these terms as the service evolves. Continued use of
							the service after updates means you accept the revised terms.
						</p>
					</section>
				</div>
			</div>
		</Layout>
	);
};

export default TermsPage;
