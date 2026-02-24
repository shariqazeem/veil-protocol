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

// Lazy-load the Cartridge connector only on the client to avoid WASM
// being pulled into the server-side bundle (Next.js SSR/prerender).
// No session policies — Cartridge opens its own approval modal for each
// transaction, giving normal gas fees (session keys use executeFromOutside
// which inflates gas 50x).
async function createCartridgeConnector() {
  const { ControllerConnector } = await import("@cartridge/connector");
  return new ControllerConnector({
    rpcUrl: RPC_URL,
  });
}

export function StarknetProvider({ children }: { children: ReactNode }) {
  const [connectors, setConnectors] = useState<Connector[]>([argent(), braavos()]);

  useEffect(() => {
    createCartridgeConnector().then((c) => {
      setConnectors([c as unknown as Connector, argent(), braavos()]);
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
