import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OAUTH_AUTH_FILE = path.resolve(CURRENT_DIR, "e2e/.auth/user.json");
const enableOAuthProjects = process.env.E2E_OAUTH === "1";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://127.0.0.1:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: ["**/*.oauth.spec.ts", "**/*.oauth.setup.ts"],
			use: { ...devices["Desktop Chrome"] },
		},
		...(enableOAuthProjects
			? [
					{
						name: "oauth-setup",
						testMatch: ["**/*.oauth.setup.ts"],
						use: { ...devices["Desktop Chrome"] },
					},
					{
						name: "oauth-chromium",
						testMatch: ["**/*.oauth.spec.ts"],
						dependencies: ["oauth-setup"],
						use: {
							...devices["Desktop Chrome"],
							storageState: OAUTH_AUTH_FILE,
						},
					},
				]
			: []),
	],
	webServer: {
		command: "pnpm dev",
		url: "http://127.0.0.1:5173",
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});
