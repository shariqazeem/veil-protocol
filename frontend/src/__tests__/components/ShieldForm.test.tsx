import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mockStarknetReact } from "../mocks/starknet-react";

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock("@starknet-react/core", () => mockStarknetReact({ isConnected: false }));

vi.mock("@/hooks/useSmartSend", () => ({
  useSmartSend: () => ({
    sendAsync: vi.fn().mockResolvedValue({ transaction_hash: "0xMOCK" }),
    isGasless: false,
  }),
}));

vi.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    bitcoinAddress: null,
    connectBitcoin: vi.fn(),
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
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
}));

vi.mock("@/utils/privacy", () => ({
  DENOMINATIONS: {
    0: 1_000_000,
    1: 10_000_000,
    2: 100_000_000,
    3: 1_000_000_000,
  },
  DENOMINATION_LABELS: ["$1", "$10", "$100", "$1,000"],
  generatePrivateNote: vi.fn().mockReturnValue({
    secret: "0x1",
    blinder: "0x2",
    commitment: "0xCOMMIT",
    denomination: 1,
    amount: "10000000",
    claimed: false,
    timestamp: Date.now(),
    batchId: 0,
    leafIndex: 0,
    zkCommitment: "0xZK",
    zkNullifier: "0xNULL",
  }),
  saveNote: vi.fn(),
}));

vi.mock("@/utils/bitcoin", () => ({
  signCommitment: vi.fn().mockResolvedValue("0xSIG"),
  computeBtcIdentityHash: vi.fn().mockReturnValue("0xHASH"),
}));

vi.mock("@/utils/network", () => ({
  EXPLORER_TX: "https://voyager.online/tx/",
  isMainnet: false,
  NETWORK_LABEL: "Sepolia",
}));

import ShieldForm from "@/components/ShieldForm";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShieldForm", () => {
  it("renders the tier selector", () => {
    render(<ShieldForm />);

    // Should show "Select Capital Tier" label
    expect(screen.getByText("Select Capital Tier")).toBeInTheDocument();
  });

  it("renders tier buttons for $10, $100, $1,000", () => {
    render(<ShieldForm />);

    // The component filters out tier 0 ($1) — shows tiers 1-3
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("$1,000")).toBeInTheDocument();
  });

  it("shows connect prompt when wallet is not connected", () => {
    render(<ShieldForm />);

    expect(
      screen.getByText("Connect your Starknet wallet to begin"),
    ).toBeInTheDocument();
  });

  it("disables the shield button when wallet is not connected", () => {
    render(<ShieldForm />);

    const shieldButton = screen.getByText("Shield Capital");
    expect(shieldButton.closest("button")).toBeDisabled();
  });

  it("renders the privacy message about fixed tiers", () => {
    render(<ShieldForm />);

    expect(
      screen.getByText("Fixed tiers make all deposits indistinguishable"),
    ).toBeInTheDocument();
  });
});
