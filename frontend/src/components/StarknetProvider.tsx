"use client";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  argent,
  braavos,
} from "@starknet-react/core";
import { ReactNode } from "react";
import { isMainnet, RPC_URL } from "@/utils/network";

const chains = [isMainnet ? mainnet : sepolia];
const connectors = [argent(), braavos()];

function rpc() {
  return {
    nodeUrl: RPC_URL,
  };
}

export function StarknetProvider({ children }: { children: ReactNode }) {
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
