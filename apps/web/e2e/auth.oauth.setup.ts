import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as setup } from "@playwright/test";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.resolve(CURRENT_DIR, ".auth/user.json");

setup("capture oauth storage state", async ({ page }) => {
	if (existsSync(authFile)) {
		return;
	}

	if (process.env.E2E_OAUTH_BOOTSTRAP !== "1") {
		throw new Error(
			`Missing OAuth storage state at ${authFile}. Run \`pnpm --filter web test:e2e:oauth:setup\` first.`,
		);
	}

	await page.goto("/login");

	const testHandle = process.env.E2E_BSKY_HANDLE;
	if (testHandle) {
		await page.getByLabel("Bluesky Handle").fill(testHandle);
	}

	await page.getByRole("button", { name: "Continue with Bluesky" }).click();

	await page.waitForURL("http://127.0.0.1:5173/", { timeout: 240000 });
	await expect(page.getByRole("link", { name: "Upload" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);

	mkdirSync(path.dirname(authFile), { recursive: true });
	await page.context().storageState({ path: authFile });
});
