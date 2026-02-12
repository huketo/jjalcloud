import { expect, test } from "@playwright/test";

test.describe("public UI smoke", () => {
	test("renders home navigation and allows moving to login page", async ({
		page,
	}) => {
		await page.goto("/");

		await expect(page).toHaveTitle(/jjalcloud/i);
		await expect(page.getByRole("link", { name: "jjalcloud" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
		await expect(page.locator("#global-search")).toBeVisible();

		await page.getByRole("link", { name: "Login" }).click();
		await expect(page).toHaveURL(/\/login$/);
	});

	test("renders login form fields", async ({ page }) => {
		await page.goto("/login");

		await expect(
			page.getByRole("heading", { name: "Sign in with Bluesky" }),
		).toBeVisible();

		const handleInput = page.getByLabel("Bluesky Handle");
		await expect(handleInput).toBeVisible();
		await handleInput.fill("example.bsky.social");
		await expect(handleInput).toHaveValue("example.bsky.social");

		await expect(
			page.getByRole("button", { name: "Continue with Bluesky" }),
		).toBeVisible();
	});
});
