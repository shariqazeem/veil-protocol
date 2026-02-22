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
// AVNU API types & helpers
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
  routeInfo?: Record<string, string>;
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
 * Use AVNU build API to get the exact multi_route_swap calldata,
 * then extract the routes array portion.
 *
 * multi_route_swap calldata layout (11 header felts + routes):
 *   [0]  sell_token
 *   [1-2] sell_amount (u256: low, high)
 *   [3]  buy_token
 *   [4-5] buy_amount (u256)
 *   [6-7] min_amount (u256)
 *   [8]  beneficiary
 *   [9]  integrator_fee_bps
 *   [10] integrator_fee_recipient
 *   [11+] routes_len + route data (already serialized for on-chain Route struct)
 */
async function fetchRouteFeltsFromBuild(
  quoteId: string,
  takerAddress: string,
): Promise<string[] | null> {
  const res = await fetch(`${AVNU_API_BASE}/swap/v2/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      takerAddress,
      slippage: SLIPPAGE_BPS / 10_000,
    }),
  });

  if (!res.ok) {
    console.error(`[execute-batch] AVNU build error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const calls = data.calls ?? [];
  const swapCall = calls.find((c: { entrypoint: string }) => c.entrypoint === "multi_route_swap");
  if (!swapCall) {
    console.error("[execute-batch] No multi_route_swap call in AVNU build response");
    return null;
  }

  // Extract routes portion (everything from index 11 onwards)
  const calldata: string[] = swapCall.calldata;
  return calldata.slice(11);
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

    if (isMainnet) {
      // ---- Mainnet: use AVNU build API for exact route calldata ----
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

      // Use AVNU build API to get exact serialized route data
      const routeFelts = await fetchRouteFeltsFromBuild(quote.quoteId, POOL_ADDRESS);
      if (!routeFelts || routeFelts.length === 0) {
        return NextResponse.json({ success: false, error: "Failed to build AVNU swap routes" }, { status: 502 });
      }

      const buyAmount = BigInt(quote.buyAmount);
      const minOut = (buyAmount * BigInt(10_000 - SLIPPAGE_BPS)) / BigInt(10_000);
      btcPrice = await getBtcPrice().catch(() => undefined);

      console.log(`[execute-batch] Expected WBTC: ${buyAmount}, min out: ${minOut}, route felts: ${routeFelts.length}`);

      // Build execute_batch calldata manually: min_wbtc_out (u256) + route felts
      const minOutHex = "0x" + minOut.toString(16);
      const rawCalldata = [minOutHex, "0x0", ...routeFelts];

      const calls = [
        {
          contractAddress: POOL_ADDRESS,
          entrypoint: "execute_batch",
          calldata: rawCalldata,
        },
      ];

      const result = await account.execute(calls);
      await provider.waitForTransaction(result.transaction_hash);

      return NextResponse.json({
        success: true,
        txHash: result.transaction_hash,
        btcPrice,
      });
    } else {
      // ---- Testnet: update mock router rate, empty routes ----
      try {
        btcPrice = await updateMockRouterRate(account);
      } catch (err) {
        console.warn("[execute-batch] Rate update failed, using existing rate:", err);
      }

      const calls = [
        {
          contractAddress: POOL_ADDRESS,
          entrypoint: "execute_batch",
          calldata: CallData.compile({
            min_wbtc_out: { low: 1n, high: 0n },
            routes: [],
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
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relayer/execute-batch] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
