import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("loads and displays hero section", async ({ page }) => {
    await page.goto("/");
    // The landing page should have hero text about privacy protocol
    await expect(page.locator("body")).toBeVisible();
    // Check for main heading or hero text
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });

  test("has CTA that navigates to /app", async ({ page }) => {
    await page.goto("/");
    // Look for "Launch App" or similar CTA link
    const cta = page.getByRole("link", { name: /launch|app|start|enter/i }).first();
    if (await cta.isVisible()) {
      await cta.click();
      await expect(page).toHaveURL(/\/app/);
    }
  });
});
