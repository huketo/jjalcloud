import { expect, test } from "@playwright/test";

test.describe("open graph metadata", () => {
	test("home page renders default OG tags", async ({ page }) => {
		await page.goto("/");

		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
			"content",
			"jjalcloud",
		);
		await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
			"content",
			"website",
		);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			"content",
			"http://127.0.0.1:5173/title.png",
		);
		await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
			"content",
			"jjalcloud",
		);
	});

	test("login page exposes OG URL and description metadata", async ({
		page,
	}) => {
		await page.goto("/login");

		await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
			"content",
			/\/login$/,
		);
		await expect(
			page.locator('meta[property="og:description"]'),
		).toHaveAttribute(
			"content",
			"AT Protocol based decentralized GIF sharing platform",
		);
	});
});
