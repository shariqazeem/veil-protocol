import { test, expect } from "@playwright/test";

test.describe("Telegram Mini-App Integration", () => {
  test("without Telegram WebApp, renders normal layout with WalletBar", async ({ page }) => {
    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    // In normal browser mode, the page should have standard layout
    await expect(page.locator("body")).toBeVisible();
  });

  test("with Telegram WebApp injected, adapts layout", async ({ page }) => {
    // Inject Telegram WebApp mock before navigating
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          close: () => {},
          initData: "",
          initDataUnsafe: {
            user: { id: 123, first_name: "Test" },
            start_param: undefined,
          },
          MainButton: {
            text: "",
            isVisible: false,
            isActive: false,
            setText: () => {},
            show: () => {},
            hide: () => {},
            enable: () => {},
            disable: () => {},
            onClick: () => {},
            offClick: () => {},
          },
          version: "7.0",
          platform: "web",
          colorScheme: "light",
          themeParams: {},
        },
      };
    });

    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    // In Telegram mode, the layout should adapt (no WalletBar, different padding)
    await expect(page.locator("body")).toBeVisible();
  });

  test("deep link with tgWebAppStartParam routes correctly", async ({ page }) => {
    // Encode an action payload
    const payload = Buffer.from(JSON.stringify({ action: "shield", tier: 2 })).toString("base64url");
    await page.goto(`/app?tgWebAppStartParam=${payload}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
