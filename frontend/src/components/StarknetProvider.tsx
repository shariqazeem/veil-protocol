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
import addresses from "@/contracts/addresses.json";
import type { Connector } from "@starknet-react/core";

const chains = [isMainnet ? mainnet : sepolia];

const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

function rpc() {
  return {
    nodeUrl: RPC_URL,
  };
}

// Lazy-load the Cartridge connector only on the client to avoid WASM
// being pulled into the server-side bundle (Next.js SSR/prerender).
async function createCartridgeConnector() {
  const { ControllerConnector } = await import("@cartridge/connector");
  return new ControllerConnector({
    rpcUrl: RPC_URL,
    policies: {
      contracts: {
        [addresses.contracts.usdc]: {
          methods: [
            { entrypoint: "approve" },
            { entrypoint: "transfer" },
            { entrypoint: "balance_of" },
          ],
        },
        [addresses.contracts.shieldedPool]: {
          methods: [
            { entrypoint: "deposit_private" },
            { entrypoint: "withdraw_private" },
            { entrypoint: "withdraw_with_btc_intent" },
            { entrypoint: "get_leaf_count" },
            { entrypoint: "get_leaf" },
            { entrypoint: "get_current_batch_id" },
            { entrypoint: "get_anonymity_set" },
            { entrypoint: "get_intent" },
            { entrypoint: "get_intent_count" },
          ],
        },
        [STRK_ADDRESS]: {
          methods: [
            { entrypoint: "transfer" },
          ],
        },
      },
    },
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
