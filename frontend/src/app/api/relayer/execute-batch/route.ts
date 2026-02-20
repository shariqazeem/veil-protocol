import { NextRequest, NextResponse } from "next/server";
import { CallData, Contract, type Abi } from "starknet";
import { POOL_ADDRESS, USDC_ADDRESS, WBTC_ADDRESS, AVNU_API_BASE, getRelayerAccount, getProvider, rateLimit } from "../shared";
import addresses from "@/contracts/addresses.json";

const ROUTER_ADDRESS = addresses.contracts.avnuRouter;
const isMainnet = addresses.network === "mainnet";

// Slippage: 1% mainnet, 5% testnet
const SLIPPAGE_BPS = isMainnet ? 100 : 500;

const POOL_ABI: Abi = [
  {
    type: "function",
    name: "get_pending_usdc",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "execute_batch",
    inputs: [
      { name: "min_wbtc_out", type: "core::integer::u256" },
      {
        name: "routes",
        type: "core::array::Array::<ghost_sats::avnu_interface::Route>",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
];

// ---------------------------------------------------------------------------
// AVNU API types & helpers (ported from scripts/keeper.ts)
// ---------------------------------------------------------------------------

interface AvnuQuote {
  quoteId: string;
  sellTokenAddress: string;
  sellAmount: string;
  buyTokenAddress: string;
  buyAmount: string;
  routes: AvnuRoute[];
}

interface AvnuRoute {
  name: string;
  address: string;
  percent: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
  routes: AvnuSubRoute[];
}

interface AvnuSubRoute {
  name: string;
  address: string;
  percent: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
  additionalSwapParams: string[];
}

async function fetchAvnuQuote(
  sellAmount: bigint,
  takerAddress: string,
): Promise<AvnuQuote | null> {
  const params = new URLSearchParams({
    sellTokenAddress: USDC_ADDRESS,
    buyTokenAddress: WBTC_ADDRESS,
    sellAmount: `0x${sellAmount.toString(16)}`,
    takerAddress,
    size: "1",
    integratorName: "VeilProtocol",
  });

  const url = `${AVNU_API_BASE}/swap/v2/quotes?${params}`;
  console.log(`[execute-batch] Fetching AVNU quote for ${sellAmount} USDC...`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[execute-batch] AVNU API error: ${res.status} ${res.statusText}`);
    return null;
  }

  const quotes: AvnuQuote[] = await res.json();
  if (!quotes || quotes.length === 0) {
    console.error("[execute-batch] No AVNU quotes available");
    return null;
  }

  return quotes[0];
}

/**
 * Convert AVNU API route data into on-chain Route struct format.
 * Route = { token_from, token_to, exchange_address, percent, additional_swap_params }
 */
function buildOnChainRoutes(quote: AvnuQuote): object[] {
  const routes: object[] = [];
  for (const route of quote.routes) {
    for (const sub of route.routes) {
      routes.push({
        token_from: sub.sellTokenAddress,
        token_to: sub.buyTokenAddress,
        exchange_address: sub.address,
        percent: Math.floor(sub.percent * 100),
        additional_swap_params: sub.additionalSwapParams ?? [],
      });
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// BTC price (for testnet mock router rate)
// ---------------------------------------------------------------------------

async function getBtcPrice(): Promise<number> {
  const resp = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { next: { revalidate: 60 } },
  );
  if (!resp.ok) throw new Error("Failed to fetch BTC price");
  const data = await resp.json();
  return data.bitcoin.usd;
}

async function updateMockRouterRate(account: ReturnType<typeof getRelayerAccount>) {
  if (!account || isMainnet) return undefined;

  const btcPrice = await getBtcPrice();
  const denominator = Math.round(btcPrice);

  console.log(`[execute-batch] Live BTC price: $${btcPrice} → rate 100/${denominator}`);

  const setRateCall = {
    contractAddress: ROUTER_ADDRESS,
    entrypoint: "set_rate",
    calldata: CallData.compile({
      rate_numerator: { low: 100, high: 0 },
      rate_denominator: { low: denominator, high: 0 },
    }),
  };

  const provider = getProvider();
  const result = await account.execute([setRateCall]);
  await provider.waitForTransaction(result.transaction_hash);
  console.log(`[execute-batch] Rate updated: tx ${result.transaction_hash}`);

  return btcPrice;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rateLimited = rateLimit(req.headers.get("x-forwarded-for") ?? "unknown");
  if (rateLimited) return rateLimited;

  try {
    const account = getRelayerAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Relayer not configured — batch execution requires owner key" },
        { status: 503 },
      );
    }

    const provider = getProvider();
    let btcPrice: number | undefined;
    let minOut = 0n;
    let onChainRoutes: object[] = [];

    if (isMainnet) {
      // ---- Mainnet: use AVNU for real swap routes ----
      const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });
      const pendingRaw = await pool.get_pending_usdc();
      const pendingUsdc = BigInt(pendingRaw.toString());

      if (pendingUsdc === 0n) {
        return NextResponse.json({ success: false, error: "No pending USDC to convert" }, { status: 400 });
      }

      console.log(`[execute-batch] Mainnet: ${pendingUsdc} pending USDC, fetching AVNU quote...`);

      // Retry up to 3 times
      let quote: AvnuQuote | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        quote = await fetchAvnuQuote(pendingUsdc, POOL_ADDRESS);
        if (quote) break;
        if (attempt < 3) {
          const delay = attempt * 3_000;
          console.log(`[execute-batch] Retry ${attempt}/3 in ${delay / 1000}s...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      if (!quote) {
        return NextResponse.json({ success: false, error: "No AVNU quote available — try again later" }, { status: 502 });
      }

      const buyAmount = BigInt(quote.buyAmount);
      minOut = (buyAmount * BigInt(10_000 - SLIPPAGE_BPS)) / BigInt(10_000);
      onChainRoutes = buildOnChainRoutes(quote);

      btcPrice = await getBtcPrice().catch(() => undefined);
      console.log(`[execute-batch] Expected WBTC: ${buyAmount}, min out: ${minOut} (${SLIPPAGE_BPS / 100}% slippage), ${onChainRoutes.length} hop(s)`);
    } else {
      // ---- Testnet: update mock router rate, empty routes ----
      try {
        btcPrice = await updateMockRouterRate(account);
      } catch (err) {
        console.warn("[execute-batch] Rate update failed, using existing rate:", err);
      }
      // Contract requires min_wbtc_out > 0
      minOut = 1n;
    }

    // Execute batch
    const calls = [
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "execute_batch",
        calldata: CallData.compile({
          min_wbtc_out: { low: minOut, high: 0n },
          routes: onChainRoutes,
        }),
      },
    ];

    const result = await account.execute(calls);
    await provider.waitForTransaction(result.transaction_hash);

    return NextResponse.json({
      success: true,
      txHash: result.transaction_hash,
      btcPrice,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relayer/execute-batch] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
