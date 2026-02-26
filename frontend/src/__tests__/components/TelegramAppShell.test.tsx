import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the component
// ---------------------------------------------------------------------------

const mockUseTelegram = vi.fn().mockReturnValue({
  isTelegram: false,
  webApp: null,
  user: null,
  startParam: null,
});

vi.mock("@/context/TelegramContext", () => ({
  useTelegram: (...args: any[]) => mockUseTelegram(...args),
}));

vi.mock("@/components/WalletBar", () => ({
  default: () => <div data-testid="wallet-bar">WalletBar</div>,
}));

// Mock next/dynamic to eagerly render the dynamically-imported component
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<any>, _opts?: any) => {
    let Comp: any = null;
    // Resolve the loader synchronously for test purposes
    const promise = loader();
    promise.then((m: any) => { Comp = m.default || m; });
    // Return a wrapper that renders the resolved component
    return function DynamicMock(props: any) {
      // If the mock resolved synchronously (vi.mock hoisting), Comp is set
      if (Comp) return <Comp {...props} />;
      return null;
    };
  },
}));

import TelegramAppShell from "@/components/TelegramAppShell";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TelegramAppShell", () => {
  beforeEach(() => {
    mockUseTelegram.mockReturnValue({
      isTelegram: false,
      webApp: null,
      user: null,
      startParam: null,
    });
  });

  it("renders WalletBar and footer in browser mode", () => {
    render(
      <TelegramAppShell>
        <div>App Content</div>
      </TelegramAppShell>,
    );

    // WalletBar should be present
    expect(screen.getByTestId("wallet-bar")).toBeInTheDocument();

    // Footer text
    expect(screen.getByText(/Veil Protocol/)).toBeInTheDocument();

    // Children should be rendered
    expect(screen.getByText("App Content")).toBeInTheDocument();
  });

  it("does NOT render WalletBar or footer in Telegram mode", () => {
    mockUseTelegram.mockReturnValue({
      isTelegram: true,
      webApp: {},
      user: { id: 123, first_name: "Test" },
      startParam: null,
    });

    render(
      <TelegramAppShell>
        <div>App Content</div>
      </TelegramAppShell>,
    );

    // WalletBar should NOT be present
    expect(screen.queryByTestId("wallet-bar")).not.toBeInTheDocument();

    // Footer should NOT be present
    expect(screen.queryByText(/Veil Protocol/)).not.toBeInTheDocument();

    // Children should still render
    expect(screen.getByText("App Content")).toBeInTheDocument();
  });

  it("renders children in both modes", () => {
    // Browser mode
    const { unmount } = render(
      <TelegramAppShell>
        <div>Child A</div>
      </TelegramAppShell>,
    );
    expect(screen.getByText("Child A")).toBeInTheDocument();
    unmount();

    // Telegram mode
    mockUseTelegram.mockReturnValue({
      isTelegram: true,
      webApp: {},
      user: null,
      startParam: null,
    });
    render(
      <TelegramAppShell>
        <div>Child B</div>
      </TelegramAppShell>,
    );
    expect(screen.getByText("Child B")).toBeInTheDocument();
  });
});
