import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

const mockCheckAllNoteStatuses = vi.fn().mockResolvedValue([]);

vi.mock("@/utils/notesManager", () => ({
  checkAllNoteStatuses: (...args: any[]) => mockCheckAllNoteStatuses(...args),
}));

vi.mock("@/utils/network", () => ({
  EXPLORER_TX: "https://sepolia.voyager.online/tx/",
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

import TransactionHistory from "@/components/TransactionHistory";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides: Record<string, any> = {}) {
  return {
    commitment: "0xabc123def456" + Math.random().toString(16).slice(2, 8),
    amount: "10000000", // 10 USDC (6 decimals)
    batchId: 1,
    timestamp: Date.now(),
    claimed: false,
    secret: "0xsecret",
    nullifier: "0xnullifier",
    status: "READY" as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TransactionHistory", () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    });
    mockCheckAllNoteStatuses.mockResolvedValue([]);
  });

  it("returns null when no address is connected", () => {
    const { container } = render(<TransactionHistory />);
    expect(container.innerHTML).toBe("");
  });

  it("renders transaction entries when notes exist", async () => {
    const notes = [
      makeNote({
        commitment: "0xcommit_a",
        batchId: 1,
        status: "READY",
        timestamp: Date.now() - 120_000, // 2 minutes ago
      }),
      makeNote({
        commitment: "0xcommit_b",
        batchId: 2,
        status: "CLAIMED",
        claimed: true,
        timestamp: Date.now() - 3_600_000, // 1 hour ago
      }),
    ];

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234abcd",
    });
    mockCheckAllNoteStatuses.mockResolvedValue(notes);

    render(<TransactionHistory />);

    // Wait for the async loading to complete and entries to render
    await waitFor(() => {
      expect(screen.getByText("Capital Activity")).toBeInTheDocument();
    });

    // Should show transaction count
    expect(screen.getByText("2 transactions")).toBeInTheDocument();

    // Should show batch IDs
    expect(screen.getByText(/Batch #1/)).toBeInTheDocument();
    expect(screen.getByText(/Batch #2/)).toBeInTheDocument();

    // Entry labels: "Allocated" for active, "Exited" for claimed
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("Exited")).toBeInTheDocument();
  });

  it("formats 'Just now' for very recent timestamps", async () => {
    const recentNote = makeNote({
      commitment: "0xrecent",
      batchId: 5,
      status: "READY",
      timestamp: Date.now(), // right now
    });

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234abcd",
    });
    mockCheckAllNoteStatuses.mockResolvedValue([recentNote]);

    render(<TransactionHistory />);

    await waitFor(() => {
      expect(screen.getByText(/Just now/)).toBeInTheDocument();
    });
  });

  it("shows singular 'transaction' for one entry", async () => {
    const singleNote = makeNote({
      commitment: "0xsingle",
      batchId: 3,
      status: "PENDING",
      timestamp: Date.now() - 300_000, // 5 minutes ago
    });

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234abcd",
    });
    mockCheckAllNoteStatuses.mockResolvedValue([singleNote]);

    render(<TransactionHistory />);

    await waitFor(() => {
      expect(screen.getByText("1 transaction")).toBeInTheDocument();
    });
  });

  it("returns null when address is connected but no notes exist", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234abcd",
    });
    mockCheckAllNoteStatuses.mockResolvedValue([]);

    const { container } = render(<TransactionHistory />);

    // After loading resolves with empty array, component returns null
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });
});
