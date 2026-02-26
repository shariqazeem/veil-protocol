"use client";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  argent,
  braavos,
} from "@starknet-react/core";
import { ReactNode, useEffect, useState } from "react";
import { isMainnet, RPC_URL } from "@/utils/network";
import type { Connector } from "@starknet-react/core";

const chains = [isMainnet ? mainnet : sepolia];

function rpc() {
  return {
    nodeUrl: RPC_URL,
  };
}

export function StarknetProvider({ children }: { children: ReactNode }) {
  const [connectors, setConnectors] = useState<Connector[]>([argent(), braavos()]);

  useEffect(() => {
    // Cartridge connector is loaded from a SEPARATE module so webpack
    // doesn't trace the 3.1MB WASM into this chunk.
    import("@/utils/cartridgeLoader").then(({ loadCartridgeConnector }) => {
      loadCartridgeConnector().then((c) => {
        setConnectors([c as unknown as Connector, argent(), braavos()]);
      });
    });
  }, []);

  return (
    <StarknetConfig
      chains={chains}
      provider={jsonRpcProvider({ rpc })}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
