import { expect, test } from "@playwright/test";

test.describe("oauth authenticated smoke", () => {
	test("reused storageState grants upload access", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("link", { name: "Upload" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);

		await page.goto("/upload");
		await expect(page).toHaveURL(/\/upload$/);
		await expect(
			page.getByRole("heading", { name: "Upload to the Cloud" }),
		).toBeVisible();
	});
});
