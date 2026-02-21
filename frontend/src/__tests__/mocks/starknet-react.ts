/**
 * Mock for @starknet-react/core hooks.
 *
 * Usage in tests:
 *   vi.mock("@starknet-react/core", () => mockStarknetReact({ isConnected: true }));
 */
import { vi } from "vitest";

export interface MockStarknetOptions {
  isConnected?: boolean;
  address?: string;
  readContractData?: any;
  sendAsyncResult?: any;
}

export function mockStarknetReact(options: MockStarknetOptions = {}) {
  const address = options.address ?? "0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5";

  return {
    useAccount: vi.fn().mockReturnValue({
      address: options.isConnected ? address : undefined,
      isConnected: options.isConnected ?? false,
      account: options.isConnected ? { address, signMessage: vi.fn() } : undefined,
      status: options.isConnected ? "connected" : "disconnected",
    }),
    useReadContract: vi.fn().mockReturnValue({
      data: options.readContractData ?? undefined,
      isLoading: false,
      error: null,
    }),
    useSendTransaction: vi.fn().mockReturnValue({
      sendAsync: vi.fn().mockResolvedValue(
        options.sendAsyncResult ?? { transaction_hash: "0xMOCK_TX" }
      ),
      isPending: false,
      error: null,
    }),
    useConnect: vi.fn().mockReturnValue({
      connect: vi.fn(),
      connectors: [
        { id: "braavos", name: "Braavos" },
        { id: "argentX", name: "ArgentX" },
      ],
      isPending: false,
    }),
    useDisconnect: vi.fn().mockReturnValue({
      disconnect: vi.fn(),
    }),
    useNetwork: vi.fn().mockReturnValue({
      chain: { id: BigInt(0x534e5f5345504f4c4941) },
    }),
    useProvider: vi.fn().mockReturnValue({
      provider: {
        nodeUrl: "https://mock-rpc.test",
        waitForTransaction: vi.fn().mockResolvedValue({ execution_status: "SUCCEEDED" }),
      },
    }),
    // Re-export the real starknet-react components as pass-through
    StarknetConfig: ({ children }: any) => children,
  };
}
