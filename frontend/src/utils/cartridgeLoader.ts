/**
 * Separate module to load Cartridge Controller connector.
 *
 * This MUST live in its own file — NOT in StarknetProvider.tsx.
 * Webpack traces dynamic imports within the same module and includes
 * the 3.1MB WASM in the parent chunk. By isolating the import() here,
 * webpack creates a separate async chunk that only loads when called.
 */

import { RPC_URL } from "@/utils/network";

export async function loadCartridgeConnector() {
  const { ControllerConnector } = await import(
    /* webpackChunkName: "cartridge" */
    "@cartridge/connector"
  );
  return new ControllerConnector({
    rpcUrl: RPC_URL,
  });
}
