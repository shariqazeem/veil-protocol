/**
 * MSW (Mock Service Worker) request handlers for API route testing.
 */
import { http, HttpResponse } from "msw";

export const handlers = [
  // CoinGecko BTC price
  http.get("https://api.coingecko.com/api/v3/simple/price", () => {
    return HttpResponse.json({ bitcoin: { usd: 97000 } });
  }),

  // CoinCap fallback
  http.get("https://api.coincap.io/v2/assets/bitcoin", () => {
    return HttpResponse.json({ data: { priceUsd: "97000" } });
  }),

  // AVNU quote
  http.get("https://sepolia.api.avnu.fi/swap/v2/quotes", () => {
    return HttpResponse.json([
      {
        quoteId: "mock-quote-id",
        sellTokenAddress: "0xUSCD",
        sellAmount: "100000000",
        buyTokenAddress: "0xWBTC",
        buyAmount: "100000",
        routes: [
          {
            name: "MockDex",
            address: "0xDEX",
            percent: 100,
            sellTokenAddress: "0xUSDC",
            buyTokenAddress: "0xWBTC",
            routes: [
              {
                name: "MockPool",
                address: "0xPOOL",
                percent: 100,
                sellTokenAddress: "0xUSDC",
                buyTokenAddress: "0xWBTC",
                additionalSwapParams: [],
              },
            ],
          },
        ],
      },
    ]);
  }),

  // AVNU build
  http.post("https://sepolia.api.avnu.fi/swap/v2/build", () => {
    return HttpResponse.json({
      calldata: ["0x1", "0x2", "0x3"],
    });
  }),

  // Relayer info
  http.get("/api/relayer/info", () => {
    return HttpResponse.json({
      pool: "0xPOOL",
      fee_bps: 200,
      relayer: "online",
      relayerAddress: "0xRELAYER",
      rpc: "https://mock-rpc.test",
    });
  }),

  // Agent status
  http.get("/api/agent/status", () => {
    return HttpResponse.json({
      pool: {
        pending_usdc: "50000000",
        batch_count: 3,
        leaf_count: 12,
        total_volume: "500000000",
        batches_executed: 2,
      },
      anon_sets: { 0: 5, 1: 3, 2: 2, 3: 1 },
    });
  }),
];
