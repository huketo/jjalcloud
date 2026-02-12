import { expect, test } from "@playwright/test";
import { seedSessionCookie } from "./helpers/auth";

test.describe("authenticated UI flows", () => {
	test("shows logged-in navigation on home", async ({ context, page }) => {
		await seedSessionCookie(context);
		await page.goto("/");

		await expect(page.getByRole("link", { name: "Upload" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
	});

	test("allows upload page access when session cookie exists", async ({
		context,
		page,
	}) => {
		await seedSessionCookie(context);
		await page.goto("/upload");

		await expect(page).toHaveURL(/\/upload$/);
		await expect(
			page.getByRole("heading", { name: "Upload to the Cloud" }),
		).toBeVisible();
		await expect(page.locator("#upload-form-root")).toBeVisible();
	});

	test("redirects to login when session cookie is missing", async ({
		page,
	}) => {
		await page.goto("/upload");

		await expect(page).toHaveURL(/\/login$/);
		await expect(
			page.getByRole("heading", { name: "Sign in with Bluesky" }),
		).toBeVisible();
	});
});
