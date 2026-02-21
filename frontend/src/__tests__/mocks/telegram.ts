/**
 * Telegram WebApp mock for testing.
 */
import { vi } from "vitest";

export interface TelegramMockOptions {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  startParam?: string;
  initData?: string;
}

export function setupTelegramMock(options: TelegramMockOptions = {}) {
  const mainButton = {
    text: "",
    isVisible: false,
    isActive: false,
    setText: vi.fn(function (this: any, text: string) { this.text = text; }),
    show: vi.fn(function (this: any) { this.isVisible = true; }),
    hide: vi.fn(function (this: any) { this.isVisible = false; }),
    enable: vi.fn(function (this: any) { this.isActive = true; }),
    disable: vi.fn(function (this: any) { this.isActive = false; }),
    onClick: vi.fn(),
    offClick: vi.fn(),
  };

  const webApp = {
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    initData: options.initData ?? "",
    initDataUnsafe: {
      user: options.user,
      start_param: options.startParam,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "mock_hash",
    },
    MainButton: mainButton,
    version: "7.0",
    platform: "web",
    colorScheme: "light" as const,
    themeParams: {},
  };

  (window as any).Telegram = { WebApp: webApp };

  return { webApp, mainButton };
}

export function teardownTelegramMock() {
  delete (window as any).Telegram;
}
