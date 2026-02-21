import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { TelegramProvider, useTelegram } from "@/context/TelegramContext";
import {
  setupTelegramMock,
  teardownTelegramMock,
} from "@/__tests__/mocks/telegram";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// DO NOT mock TelegramContext here -- we are testing the real implementation
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) => (
  <TelegramProvider>{children}</TelegramProvider>
);

describe("TelegramContext", () => {
  afterEach(() => {
    teardownTelegramMock();
  });

  it("defaults to non-Telegram state when no WebApp is present", () => {
    const { result } = renderHook(() => useTelegram(), { wrapper });

    expect(result.current.isTelegram).toBe(false);
    expect(result.current.webApp).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.startParam).toBeNull();
  });

  it("detects Telegram WebApp and calls ready() and expand()", async () => {
    const { webApp } = setupTelegramMock({
      user: {
        id: 42,
        first_name: "Ghost",
        last_name: "User",
        username: "ghostuser",
        language_code: "en",
      },
      startParam: "ref_abc123",
    });

    const { result } = renderHook(() => useTelegram(), { wrapper });

    // The useEffect fires asynchronously; wait for it
    await act(async () => {
      // Allow the effect to run
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isTelegram).toBe(true);
    expect(result.current.webApp).toBeTruthy();
    expect(webApp.ready).toHaveBeenCalled();
    expect(webApp.expand).toHaveBeenCalled();

    // User data
    expect(result.current.user).toEqual({
      id: 42,
      first_name: "Ghost",
      last_name: "User",
      username: "ghostuser",
      language_code: "en",
    });

    // Start param
    expect(result.current.startParam).toBe("ref_abc123");
  });

  it("handles missing user data gracefully", async () => {
    setupTelegramMock({
      // No user provided
    });

    const { result } = renderHook(() => useTelegram(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isTelegram).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.startParam).toBeNull();
  });

  it("populates startParam from the mock", async () => {
    setupTelegramMock({
      startParam: "deposit_xyz",
    });

    const { result } = renderHook(() => useTelegram(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.startParam).toBe("deposit_xyz");
  });
});
