import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the component
// ---------------------------------------------------------------------------

const mockUseAccount = vi.fn().mockReturnValue({
  isConnected: false,
  address: undefined,
});

vi.mock("@starknet-react/core", () => ({
  useAccount: (...args: any[]) => mockUseAccount(...args),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) => {
        return ({ children, ...props }: any) => {
          const {
            initial,
            animate,
            exit,
            transition,
            whileHover,
            whileTap,
            variants,
            layout,
            layoutId,
            ...htmlProps
          } = props;
          const Tag = typeof tag === "string" ? tag : "div";
          return <Tag {...htmlProps}>{children}</Tag>;
        };
      },
    },
  ),
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({ start: vi.fn() }),
  useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
}));

vi.mock("@/utils/network", () => ({
  isMainnet: false,
}));

import OnboardingBanner from "@/components/OnboardingBanner";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OnboardingBanner", () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    });
  });

  it("renders banner with title and 4 step labels when not connected", () => {
    render(<OnboardingBanner />);

    expect(
      screen.getByText("AI-Powered Privacy Protocol"),
    ).toBeInTheDocument();

    // 4 step labels
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("AI Plan")).toBeInTheDocument();
    expect(screen.getByText("x402 Intel")).toBeInTheDocument();
    expect(screen.getByText("Shield")).toBeInTheDocument();
  });

  it("returns null when wallet is connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234",
    });

    const { container } = render(<OnboardingBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("dismisses the banner when X button is clicked", async () => {
    const user = userEvent.setup();

    render(<OnboardingBanner />);

    // Banner should be visible
    expect(
      screen.getByText("AI-Powered Privacy Protocol"),
    ).toBeInTheDocument();

    // The X button contains a lucide X icon; find the button by its role
    const dismissButton = screen.getByRole("button");
    await user.click(dismissButton);

    // After dismiss, the title should no longer be in the document
    expect(
      screen.queryByText("AI-Powered Privacy Protocol"),
    ).not.toBeInTheDocument();
  });

  it("shows testnet faucet link when not on mainnet", () => {
    render(<OnboardingBanner />);

    expect(screen.getByText(/Get testnet gas/)).toBeInTheDocument();
  });
});
