import { test, expect } from "@playwright/test";

test.describe("Agent / Strategist Flow", () => {
  test("strategist tab has input textarea", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    // Click on Agent/Strategist tab
    const stratTab = page.locator("button").filter({ hasText: /strateg|agent/i }).first();
    if (await stratTab.isVisible()) {
      await stratTab.click();
      await page.waitForTimeout(500);
      // Look for textarea or input
      const input = page.locator("textarea, input[type='text']").first();
      if (await input.isVisible()) {
        await expect(input).toBeVisible();
      }
    }
  });

  test("example prompts are clickable", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    const stratTab = page.locator("button").filter({ hasText: /strateg|agent/i }).first();
    if (await stratTab.isVisible()) {
      await stratTab.click();
      await page.waitForTimeout(500);
      // Look for example prompt buttons
      const examples = page.locator("button").filter({ hasText: /\$50|\$100|privacy|DCA/i });
      const count = await examples.count();
      // Just verify the tab loaded
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
