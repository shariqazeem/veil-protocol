/**
 * Veil Strategist — Telegram Bot (Strategy Planning + Guided Execution)
 *
 * AI strategy planning interface for confidential Bitcoin accumulation on Starknet.
 * Plans strategies in Telegram, then sends users to the web app with a
 * pre-filled deep link for self-custody execution via Argent/Braavos wallet.
 *
 * Flow:
 *   1. User describes strategy (amount, style) in natural language
 *   2. Bot analyzes live pool conditions and plans optimal deposits
 *   3. User taps "Execute on Veil" → web app opens with strategy pre-filled
 *   4. User connects wallet in web app → confirms → deposits execute
 *
 * Usage:
 *   npx tsx bot.ts
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
 *   WEB_APP_URL         - Frontend URL (default: http://localhost:3000)
 *   RELAYER_API_URL     - Relayer API base (default: WEB_APP_URL/api/relayer)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { RpcProvider, Contract, type Abi } from "starknet";
import "dotenv/config";

import {
  parseTargetUsdc,
  generateAgentLog,
  generateStrategy,
  detectStrategyType,
  computePoolHealth,
  type PoolState,
  type AgentPlan,
} from "./strategyEngine.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentManifest {
  network?: string;
  contracts?: Record<string, string>;
}

function loadDeploymentManifest(): DeploymentManifest {
  try {
    const manifestPath = path.resolve(__dirname, "deployment.json");
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  } catch { /* fall through */ }
  return {};
}

const manifest = loadDeploymentManifest();
const addresses = manifest.contracts ?? {};
const network = manifest.network ?? "sepolia";

const POOL_ADDRESS =
  process.env.POOL_ADDRESS ?? addresses.shieldedPool ?? "";

const USDC_ADDRESS =
  process.env.USDC_ADDRESS ?? addresses.usdc ?? "";

const RPC_URL =
  process.env.STARKNET_RPC_URL ??
  (network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_BASE = process.env.WEB_APP_URL ?? "http://localhost:3000";
const RELAYER_API = process.env.RELAYER_API_URL ?? `${WEB_APP_BASE}/api/relayer`;
const BOT_WEBHOOK_PORT = parseInt(process.env.BOT_WEBHOOK_PORT ?? "3002", 10);
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET ?? "";

const EXPLORER_BASE =
  network === "mainnet"
    ? "https://voyager.online"
    : "https://sepolia.voyager.online";

if (!BOT_TOKEN) {
  console.error("[bot] TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

if (!POOL_ADDRESS) {
  console.error("[bot] No pool address found — run deploy first or set POOL_ADDRESS");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Denominations (inlined)
// ---------------------------------------------------------------------------

const DENOMINATION_LABELS: Record<number, string> = {
  0: "$1", 1: "$10", 2: "$100", 3: "$1,000",
};

// ---------------------------------------------------------------------------
// GhostNote type (for stored notes from web app deposits)
// ---------------------------------------------------------------------------

interface GhostNote {
  secret: string;
  blinder: string;
  amount: string;
  denomination: number;
  commitment: string;
  zkCommitment: string;
  zkNullifier: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Pool Contract Reader
// ---------------------------------------------------------------------------

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
    name: "get_batch_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_leaf_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_anonymity_set",
    inputs: [{ name: "tier", type: "core::integer::u8" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_intent_count",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
];

async function getPoolState(): Promise<PoolState> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const pool = new Contract(POOL_ABI, POOL_ADDRESS, provider);

  const [pendingRaw, batchCount, leafCount, a0, a1, a2, a3] = await Promise.all([
    pool.get_pending_usdc(),
    pool.get_batch_count(),
    pool.get_leaf_count(),
    pool.get_anonymity_set(0),
    pool.get_anonymity_set(1),
    pool.get_anonymity_set(2),
    pool.get_anonymity_set(3),
  ]);

  const btcPrice = await fetchBtcPrice();

  return {
    pendingUsdc: Number(BigInt(pendingRaw.toString())) / 1_000_000,
    batchCount: Number(batchCount),
    leafCount: Number(leafCount),
    anonSets: { 0: Number(a0), 1: Number(a1), 2: Number(a2), 3: Number(a3) },
    btcPrice,
  };
}

// ---------------------------------------------------------------------------
// BTC Price (triple fallback)
// ---------------------------------------------------------------------------

async function fetchBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) return data.bitcoin.usd;
    }
  } catch { /* next */ }

  try {
    const res = await fetch(
      "https://api.coincap.io/v2/assets/bitcoin",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.priceUsd) return parseFloat(data.data.priceUsd);
    }
  } catch { /* next */ }

  try {
    const res = await fetch(
      "https://blockchain.info/ticker",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.USD?.last) return data.USD.last;
    }
  } catch { /* all failed */ }

  return 0;
}

// ---------------------------------------------------------------------------
// HTML Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function privacyLabel(anonSet: number): string {
  if (anonSet >= 20) return "Maximum";
  if (anonSet >= 10) return "Strong";
  if (anonSet >= 5) return "Good";
  if (anonSet >= 3) return "Moderate";
  return "Low";
}

function barChart(count: number, max: number = 20, width: number = 10): string {
  const filled = Math.round((Math.min(count, max) / max) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

// ---------------------------------------------------------------------------
// Deep Link + Approval Link
// ---------------------------------------------------------------------------

function buildDeepLink(userInput: string, target: number, plan: AgentPlan): string {
  const params = Buffer.from(JSON.stringify({
    input: userInput,
    target,
    steps: plan.strategy.steps.map(s => ({ tier: s.tier, label: s.label, delaySeconds: s.delaySeconds })),
  })).toString("base64url");
  return `${WEB_APP_BASE}/app?strategy=${params}`;
}

function buildShieldLink(tier: number): string {
  return `${WEB_APP_BASE}/app?action=shield&tier=${tier}`;
}

function buildUnveilLink(noteIdx: number): string {
  return `${WEB_APP_BASE}/app?action=unveil&noteIdx=${noteIdx}`;
}

function buildMiniAppParams(action: string, params: Record<string, string>): string {
  return Buffer.from(JSON.stringify({ action, ...params })).toString("base64url");
}

function buildMiniAppUrl(action: string, params: Record<string, string> = {}): string {
  const startParam = buildMiniAppParams(action, params);
  return `${WEB_APP_BASE}/app?tgWebAppStartParam=${startParam}`;
}

// ---------------------------------------------------------------------------
// User State (file-backed persistence — survives restarts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

interface NotificationPrefs {
  batch: boolean;     // batch execution alerts
  intent: boolean;    // intent bridge events
  anon: boolean;      // anonymity set milestones (5, 10, 20)
  price: boolean;     // BTC >5% moves
  personal: boolean;  // user's own deposit batch status
}

const DEFAULT_PREFS: NotificationPrefs = {
  batch: true, intent: true, anon: true, price: true, personal: true,
};

interface UserState {
  starknetAddress: string | null;
  notes: GhostNote[];
  notifyPrefs?: NotificationPrefs;
}

const STATE_FILE = path.resolve(__dirname, "data", "bot-state.json");

/** Persisted state structure */
interface PersistedState {
  users: Record<string, { starknetAddress: string | null; notes: GhostNote[]; notifyPrefs?: NotificationPrefs }>;
  alertSubscribers?: number[];
}

function loadPersistedState(): Map<number, UserState> {
  const map = new Map<number, UserState>();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw: PersistedState = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      for (const [chatId, data] of Object.entries(raw.users ?? {})) {
        map.set(Number(chatId), {
          starknetAddress: data.starknetAddress,
          notes: data.notes ?? [],
          notifyPrefs: data.notifyPrefs,
        });
      }
      // Migrate old alertSubscribers
      if (raw.alertSubscribers) {
        for (const chatId of raw.alertSubscribers) {
          const existing = map.get(chatId);
          if (existing && !existing.notifyPrefs) {
            existing.notifyPrefs = { ...DEFAULT_PREFS };
          } else if (!existing) {
            map.set(chatId, { starknetAddress: null, notes: [], notifyPrefs: { ...DEFAULT_PREFS } });
          }
        }
      }
      console.log(`[bot] Loaded state: ${map.size} users, ${[...map.values()].reduce((s, u) => s + u.notes.length, 0)} notes`);
    }
  } catch (err) {
    console.error("[bot] Failed to load state:", err);
  }
  return map;
}

function persistState(): void {
  try {
    const obj: PersistedState = { users: {} };
    for (const [chatId, state] of users.entries()) {
      obj.users[String(chatId)] = {
        starknetAddress: state.starknetAddress,
        notes: state.notes,
        notifyPrefs: state.notifyPrefs,
      };
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[bot] Failed to persist state:", err);
  }
}

const users = loadPersistedState();

function getUser(chatId: number): UserState {
  if (!users.has(chatId)) {
    users.set(chatId, { starknetAddress: null, notes: [] });
  }
  return users.get(chatId)!;
}

/** Get all chat IDs that have notifications enabled for a given type */
function getSubscribers(type: keyof NotificationPrefs): number[] {
  const result: number[] = [];
  for (const [chatId, state] of users.entries()) {
    if (state.notifyPrefs?.[type]) result.push(chatId);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Relayer API Client (info only — execution happens in web app)
// ---------------------------------------------------------------------------

async function getRelayerInfo(): Promise<{ relayerAddress: string | null; relayer: string }> {
  try {
    const res = await fetch(`${RELAYER_API}/info`);
    return await res.json();
  } catch {
    return { relayerAddress: null, relayer: "offline" };
  }
}

// ---------------------------------------------------------------------------
// Alerts State
// ---------------------------------------------------------------------------

let lastBatchCount = -1;
let lastBtcPrice = 0;
let lastIntentCount = -1;
let lastAnonSets: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
const ANON_THRESHOLDS = [5, 10, 20];

// ---------------------------------------------------------------------------
// Bot Setup
// ---------------------------------------------------------------------------

const bot = new Bot(BOT_TOKEN);

// /start
bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp("Launch Mini-App", `${WEB_APP_BASE}/app`)
    .row()
    .text("Plan $10 Strategy", "quick_dca_10")
    .text("Plan $50 Strategy", "quick_dca_50")
    .row()
    .text("Pool Status", "pool_status")
    .text("BTC Price", "btc_price")
    .row()
    .url("Open in Browser", `${WEB_APP_BASE}/app`);

  await ctx.reply(
    `<b>Veil Strategist</b>\n` +
    `<i>AI-powered confidential Bitcoin accumulation on Starknet</i>\n\n` +
    `<b>How it works:</b>\n` +
    `1. Tell me your strategy (amount, style)\n` +
    `2. I analyze live pool conditions and plan optimal deposits\n` +
    `3. Tap <b>"Execute on Veil"</b> to deposit via your own wallet\n\n` +
    `<b>Try it:</b>\n` +
    `<code>/strategy $50 max privacy</code>\n` +
    `<code>/dca 10 daily 5 deposits</code>\n` +
    `<code>accumulate $30 in BTC</code>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

// /connect <address> — optional wallet linking for on-chain tracking
bot.command("connect", async (ctx) => {
  const address = ctx.match?.trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    await ctx.reply(
      `<b>Connect Wallet (Optional)</b>\n\n` +
      `Link your Starknet wallet address to track deposits on-chain:\n` +
      `<code>/connect 0x04a1...</code>\n\n` +
      `<i>This is optional — you can plan strategies and execute via the web app without linking here.</i>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const user = getUser(ctx.chat.id);
  user.starknetAddress = address;
  persistState();

  await ctx.reply(
    `<b>Wallet Linked</b>\n\n` +
    `Address: <code>${address.slice(0, 14)}...${address.slice(-8)}</code>\n\n` +
    `You can now track your deposits. Try <code>/strategy $50 max privacy</code> to plan a strategy.`,
    { parse_mode: "HTML" },
  );
});

// /approve — informational, approvals handled in web app
bot.command("approve", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp("Open Mini-App", `${WEB_APP_BASE}/app`)
    .row()
    .url("Open in Browser", `${WEB_APP_BASE}/app`);

  await ctx.reply(
    `<b>USDC Approvals</b>\n\n` +
    `Approvals are handled automatically in the web app when you execute a strategy.\n\n` +
    `<b>How it works:</b>\n` +
    `1. Plan a strategy here in Telegram\n` +
    `2. Tap <b>"Execute on Veil"</b>\n` +
    `3. Connect your wallet in the app\n` +
    `4. Your wallet will prompt for approval + deposit in one step\n\n` +
    `<i>No setup needed here — everything happens in the app with your own wallet.</i>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

// /wallet — show wallet status
bot.command("wallet", async (ctx) => {
  const user = getUser(ctx.chat.id);

  if (!user.starknetAddress) {
    await ctx.reply(
      `No wallet connected. Use <code>/connect 0x...</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const noteCount = user.notes.length;
  const totalDeposited = user.notes.reduce((sum, n) => sum + Number(n.amount) / 1_000_000, 0);

  await ctx.reply(
    `<b>Wallet Status</b>\n\n` +
    `<b>Address:</b> <code>${user.starknetAddress.slice(0, 14)}...${user.starknetAddress.slice(-8)}</code>\n` +
    `<b>Notes stored:</b> ${noteCount}\n` +
    `<b>Total deposited:</b> $${totalDeposited.toLocaleString()} USDC\n\n` +
    (noteCount > 0 ? `Use <code>/notes</code> to export your private notes for withdrawal.` : `No deposits yet. Try <code>/strategy $10</code>`),
    { parse_mode: "HTML" },
  );
});

// /notes — show note summary (never expose secrets in Telegram)
bot.command("notes", async (ctx) => {
  const user = getUser(ctx.chat.id);

  if (user.notes.length === 0) {
    await ctx.reply("No notes stored. Make a deposit first.");
    return;
  }

  const noteSummary = user.notes.map((n, i) => (
    `  ${i + 1}. ${DENOMINATION_LABELS[n.denomination]} — <code>${n.commitment.slice(0, 14)}...</code> (${new Date(n.timestamp).toLocaleDateString()})`
  )).join("\n");

  const totalUsdc = user.notes.reduce((s, n) => s + Number(n.amount) / 1e6, 0);

  const keyboard = new InlineKeyboard()
    .webApp("Open Mini-App", `${WEB_APP_BASE}/app`)
    .row()
    .url("Export Notes (Browser)", `${WEB_APP_BASE}/app`)
    .text("Download as File", "download_notes");

  await ctx.reply(
    `<b>YOUR NOTES</b>\n\n` +
    `<b>Count:</b> ${user.notes.length}\n` +
    `<b>Total:</b> $${totalUsdc.toLocaleString()} USDC\n\n` +
    noteSummary + `\n\n` +
    `<i>For security, private keys are never shown in chat.\n` +
    `Use the web app or download as an encrypted file.</i>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

// /help
bot.command("help", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp("Launch Mini-App", `${WEB_APP_BASE}/app`)
    .row()
    .text("Plan $10 Strategy", "quick_dca_10")
    .text("Plan $50 Strategy", "quick_dca_50")
    .row()
    .url("Open in Browser", `${WEB_APP_BASE}/app`);

  await ctx.reply(
    `<b>Veil Strategist — Help</b>\n\n` +
    `<b>How it works:</b>\n` +
    `1. Tell me your strategy — I plan it with live pool data\n` +
    `2. Tap <b>"Execute on Veil"</b> to open the web app\n` +
    `3. Connect your wallet and confirm to execute\n\n` +
    `<b>Strategy planning:</b>\n` +
    `<code>/strategy &lt;text&gt;</code> — Plan a deposit strategy\n` +
    `<code>/dca</code> — DCA plan builder\n\n` +
    `<b>Analytics:</b>\n` +
    `<code>/status</code> — Pool state\n` +
    `<code>/portfolio</code> — Protocol analytics\n` +
    `<code>/price</code> — BTC price + rates\n\n` +
    `<b>Notifications:</b>\n` +
    `<code>/notify</code> — Granular notification toggles\n` +
    `<code>/notify all</code> — Enable all alerts\n` +
    `<code>/notify off</code> — Disable all alerts\n` +
    `<code>/alerts on/off</code> — Quick toggle (legacy)\n\n` +
    `<b>Wallet:</b>\n` +
    `<code>/connect &lt;address&gt;</code> — Link wallet (optional)\n` +
    `<code>/wallet</code> — Connection status\n` +
    `<code>/notes</code> — Export private notes\n\n` +
    `<i>Or just type naturally: "accumulate $50 in BTC"</i>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

// /status
bot.command("status", async (ctx) => {
  await ctx.reply("<code>Fetching pool state...</code>", { parse_mode: "HTML" });

  try {
    const state = await getPoolState();
    const csi = computeCSIFromState(state);
    const health = computePoolHealth(state);
    const priceStr = state.btcPrice > 0 ? `$${state.btcPrice.toLocaleString()}` : "unavailable";

    await ctx.reply(
      `<b>VEIL PROTOCOL STATUS</b>\n\n` +
      `<b>BTC Price:</b>  ${priceStr}\n` +
      `<b>Pending:</b>    $${state.pendingUsdc.toFixed(2)} USDC\n` +
      `<b>Commitments:</b> ${state.leafCount}\n` +
      `<b>Batches:</b>    ${state.batchCount}\n\n` +
      `<b>Anonymity Sets:</b>\n` +
      `  $1     ${barChart(state.anonSets[0])} ${state.anonSets[0]} [${privacyLabel(state.anonSets[0])}]\n` +
      `  $10    ${barChart(state.anonSets[1])} ${state.anonSets[1]} [${privacyLabel(state.anonSets[1])}]\n` +
      `  $100   ${barChart(state.anonSets[2])} ${state.anonSets[2]} [${privacyLabel(state.anonSets[2])}]\n` +
      `  $1,000 ${barChart(state.anonSets[3])} ${state.anonSets[3]} [${privacyLabel(state.anonSets[3])}]\n\n` +
      `<b>CSI:</b> ${csi}  |  <b>Health:</b> ${health.rating} (${health.score}/100)\n` +
      `<b>Network:</b> Starknet ${network === "mainnet" ? "Mainnet" : "Sepolia"}`,
      { parse_mode: "HTML" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error: ${escapeHtml(msg.slice(0, 200))}`);
  }
});

// /price
bot.command("price", async (ctx) => {
  try {
    const btcPrice = await fetchBtcPrice();
    if (btcPrice <= 0) {
      await ctx.reply("BTC price unavailable — try again.");
      return;
    }
    await ctx.reply(
      `<b>BITCOIN PRICE</b>\n\n` +
      `<code>$${btcPrice.toLocaleString()}</code> USD\n\n` +
      `<b>Conversion rates:</b>\n` +
      `  $1     \u2192 ${(1 / btcPrice).toFixed(8)} BTC\n` +
      `  $10    \u2192 ${(10 / btcPrice).toFixed(6)} BTC\n` +
      `  $100   \u2192 ${(100 / btcPrice).toFixed(6)} BTC\n` +
      `  $1,000 \u2192 ${(1000 / btcPrice).toFixed(5)} BTC`,
      { parse_mode: "HTML" },
    );
  } catch {
    await ctx.reply("Failed to fetch BTC price.");
  }
});

// /pool
bot.command("pool", async (ctx) => {
  await ctx.reply("<code>Analyzing pool...</code>", { parse_mode: "HTML" });
  try {
    const state = await getPoolState();
    const csi = computeCSIFromState(state);
    const totalAnon = Object.values(state.anonSets).reduce((s, v) => s + v, 0);
    const activeTiers = Object.values(state.anonSets).filter(v => v > 0).length;
    const keyboard = new InlineKeyboard()
      .url("View on Voyager", `${EXPLORER_BASE}/contract/${POOL_ADDRESS}`)
      .url("Open Web App", `${WEB_APP_BASE}/app`);
    await ctx.reply(
      `<b>POOL ANALYTICS</b>\n\n` +
      `<b>Protocol Metrics:</b>\n` +
      `  Total commitments: ${state.leafCount}\n` +
      `  Active participants: ${totalAnon}\n` +
      `  Active tiers: ${activeTiers}/4\n` +
      `  Batches executed: ${state.batchCount}\n` +
      `  Pending USDC: $${state.pendingUsdc.toFixed(2)}\n\n` +
      `<b>CSI:</b> ${csi}\n` +
      `  ${csi >= 30 ? "Excellent" : csi >= 15 ? "Strong" : csi >= 5 ? "Growing" : "Early stage"} protocol coverage`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error: ${escapeHtml(msg.slice(0, 200))}`);
  }
});

// /portfolio
bot.command("portfolio", async (ctx) => {
  await ctx.reply("<code>Loading...</code>", { parse_mode: "HTML" });
  try {
    const state = await getPoolState();
    const health = computePoolHealth(state);
    const csi = computeCSIFromState(state);
    const totalAnon = Object.values(state.anonSets).reduce((s, v) => s + v, 0);
    const priceStr = state.btcPrice > 0 ? `$${state.btcPrice.toLocaleString()}` : "N/A";
    const keyboard = new InlineKeyboard()
      .text("Quick DCA $10", "quick_dca_10")
      .text("Quick DCA $50", "quick_dca_50")
      .row()
      .url("Open Terminal", `${WEB_APP_BASE}/app`);
    const lines = [
      `<b>PROTOCOL PORTFOLIO</b>`,
      ``,
      `<b>Anonymity Sets:</b>`,
      `  $1     ${barChart(state.anonSets[0])} ${String(state.anonSets[0]).padStart(3)} [${privacyLabel(state.anonSets[0])}]`,
      `  $10    ${barChart(state.anonSets[1])} ${String(state.anonSets[1]).padStart(3)} [${privacyLabel(state.anonSets[1])}]`,
      `  $100   ${barChart(state.anonSets[2])} ${String(state.anonSets[2]).padStart(3)} [${privacyLabel(state.anonSets[2])}]`,
      `  $1,000 ${barChart(state.anonSets[3])} ${String(state.anonSets[3]).padStart(3)} [${privacyLabel(state.anonSets[3])}]`,
      ``,
      `<b>BTC:</b> ${priceStr}`,
      state.btcPrice > 0 ? `  $1     \u2192 ${(1 / state.btcPrice).toFixed(8)} BTC` : ``,
      state.btcPrice > 0 ? `  $10    \u2192 ${(10 / state.btcPrice).toFixed(6)} BTC` : ``,
      state.btcPrice > 0 ? `  $100   \u2192 ${(100 / state.btcPrice).toFixed(5)} BTC` : ``,
      state.btcPrice > 0 ? `  $1,000 \u2192 ${(1000 / state.btcPrice).toFixed(4)} BTC` : ``,
      ``,
      `<b>Health:</b> ${health.rating} (${health.score}/100)`,
      `${health.recommendation}`,
      ``,
      `<b>CSI:</b> ${csi} | <b>Participants:</b> ${totalAnon}`,
    ];
    await ctx.reply(lines.filter(l => l !== ``).join("\n"), { parse_mode: "HTML", reply_markup: keyboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error: ${escapeHtml(msg.slice(0, 200))}`);
  }
});

// /alerts — legacy redirect to /notify
bot.command("alerts", async (ctx) => {
  const arg = ctx.match?.trim().toLowerCase();
  const chatId = ctx.chat.id;
  const user = getUser(chatId);

  if (arg === "on") {
    user.notifyPrefs = { ...DEFAULT_PREFS };
    persistState();
    await ctx.reply(
      `<b>All notifications enabled</b>\n\n` +
      `Use <code>/notify</code> for granular control.`,
      { parse_mode: "HTML" },
    );
  } else if (arg === "off") {
    user.notifyPrefs = undefined;
    persistState();
    await ctx.reply("All notifications disabled.");
  } else {
    await ctx.reply(
      `Use <code>/notify</code> for granular notification control.`,
      { parse_mode: "HTML" },
    );
  }
});

// /notify — granular notification toggle
bot.command("notify", async (ctx) => {
  const arg = ctx.match?.trim().toLowerCase();
  const chatId = ctx.chat.id;
  const user = getUser(chatId);

  if (arg === "all") {
    user.notifyPrefs = { ...DEFAULT_PREFS };
    persistState();
    await ctx.reply(`<b>All notifications enabled</b>`, { parse_mode: "HTML" });
    return;
  }
  if (arg === "off") {
    user.notifyPrefs = undefined;
    persistState();
    await ctx.reply("All notifications disabled.");
    return;
  }

  // Toggle individual types
  const toggleTypes: (keyof NotificationPrefs)[] = ["batch", "intent", "anon", "price", "personal"];
  if (arg && toggleTypes.includes(arg as keyof NotificationPrefs)) {
    if (!user.notifyPrefs) user.notifyPrefs = { ...DEFAULT_PREFS };
    const key = arg as keyof NotificationPrefs;
    user.notifyPrefs[key] = !user.notifyPrefs[key];
    persistState();
    await ctx.reply(
      `<b>${key}</b> notifications: ${user.notifyPrefs[key] ? "ON" : "OFF"}`,
      { parse_mode: "HTML" },
    );
    return;
  }

  // Show current prefs as toggle buttons
  const prefs = user.notifyPrefs ?? { batch: false, intent: false, anon: false, price: false, personal: false };
  const keyboard = new InlineKeyboard()
    .text(`${prefs.batch ? "✓" : "○"} Batch`, "toggle_notify_batch")
    .text(`${prefs.intent ? "✓" : "○"} Intent`, "toggle_notify_intent")
    .row()
    .text(`${prefs.anon ? "✓" : "○"} Anon Sets`, "toggle_notify_anon")
    .text(`${prefs.price ? "✓" : "○"} BTC Price`, "toggle_notify_price")
    .row()
    .text(`${prefs.personal ? "✓" : "○"} My Deposits`, "toggle_notify_personal")
    .row()
    .text("Enable All", "notify_all")
    .text("Disable All", "notify_off");

  await ctx.reply(
    `<b>Notification Preferences</b>\n\n` +
    `Toggle individual alert types:`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

// /dca
bot.command("dca", async (ctx) => {
  const userInput = ctx.match?.trim();
  if (!userInput) {
    const keyboard = new InlineKeyboard()
      .text("$1/day", "dca_1_daily")
      .text("$10/day", "dca_10_daily")
      .row()
      .text("$50/week", "dca_50_weekly")
      .text("$100/week", "dca_100_weekly");
    await ctx.reply(
      `<b>DCA PLAN BUILDER</b>\n\n` +
      `Select a preset or specify custom:\n` +
      `<code>/dca 10 daily 5 deposits</code>\n\n` +
      `Presets:`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
    return;
  }
  await runStrategyFlow(ctx.chat.id, ctx, `DCA ${userInput}`);
});

// /strategy
bot.command("strategy", async (ctx) => {
  const userInput = ctx.match?.trim();
  if (!userInput) {
    const keyboard = new InlineKeyboard()
      .text("$10", "strategy_amt_10")
      .text("$50", "strategy_amt_50")
      .text("$100", "strategy_amt_100")
      .row()
      .text("$200", "strategy_amt_200")
      .text("$500", "strategy_amt_500")
      .text("$1,000", "strategy_amt_1000");
    await ctx.reply(
      `<b>STRATEGY BUILDER</b>\n\nSelect amount or type directly:\n<code>/strategy $50 max privacy</code>`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
    return;
  }
  await runStrategyFlow(ctx.chat.id, ctx, userInput);
});

// ---------------------------------------------------------------------------
// Core Strategy Flow — plans strategy and links to web app for execution
// ---------------------------------------------------------------------------

async function runStrategyFlow(
  chatId: number,
  ctx: { chat: { id: number }; api: Bot["api"]; reply: (text: string, opts?: Record<string, unknown>) => Promise<{ message_id: number }> },
  userInput: string,
) {
  const target = parseTargetUsdc(userInput);
  if (!target || target <= 0) {
    await ctx.reply(
      `Could not parse an amount. Try:\n<code>/strategy $50</code> or <code>accumulate 100 dollars</code>`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const thinkingMsg = await ctx.reply(
    `<b>VEIL STRATEGIST</b>\n\n<code>[OBSERVE]</code> Initializing analysis...`,
    { parse_mode: "HTML" },
  );

  try {
    const poolState = await getPoolState();
    const btcPrice = poolState.btcPrice;

    if (btcPrice <= 0) {
      await ctx.api.editMessageText(chatId, thinkingMsg.message_id, "BTC price unavailable. Try again.");
      return;
    }

    // Generate logs and stream
    const logs = generateAgentLog(target, poolState, btcPrice, userInput);
    const plan = generateStrategy(target, poolState, btcPrice, userInput);

    let logText = `<b>VEIL STRATEGIST</b>\n\n`;
    for (let i = 0; i < logs.length; i += 3) {
      const batch = logs.slice(i, i + 3);
      for (const log of batch) {
        logText += `<code>[${log.type.toUpperCase().padEnd(7)}]</code> ${escapeHtml(log.message)}\n`;
      }
      try {
        await ctx.api.editMessageText(chatId, thinkingMsg.message_id, logText, { parse_mode: "HTML" });
      } catch { /* ignore */ }
      await sleep(700);
    }

    const s = plan.strategy;
    const strategyType = detectStrategyType(userInput, target);

    // Build keyboard — primary action links to web app
    const miniAppUrl = buildDeepLink(userInput, target, plan);
    const keyboard = new InlineKeyboard()
      .webApp("Execute in Mini-App", miniAppUrl)
      .row();

    // Per-step shield links for each unique tier
    const uniqueTiers = [...new Set(s.steps.map(step => step.tier))];
    for (const tier of uniqueTiers) {
      const count = s.steps.filter(step => step.tier === tier).length;
      keyboard.url(
        `Shield ${DENOMINATION_LABELS[tier]}${count > 1 ? ` x${count}` : ""}`,
        buildShieldLink(tier),
      );
    }
    keyboard.row()
      .url("Open in Browser", miniAppUrl)
      .text("Try Different Strategy", "strategy_select");

    const summaryLines = [
      `<b>STRATEGY READY</b>`,
      ``,
      `<b>Type:</b> ${strategyType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`,
      `<b>Total:</b> $${s.totalUsdc} USDC \u2192 ${s.steps.length}x ${s.steps[0]?.label ?? "?"} deposits`,
      `<b>Est. BTC:</b> ${s.estimatedBtc}`,
      `<b>Privacy:</b> ${s.privacyScore}`,
      `<b>CSI Impact:</b> ${s.csiImpact}`,
      ``,
      `Tap <b>"Execute in Mini-App"</b> to open inside Telegram.`,
      `Or use <b>"Open in Browser"</b> for full desktop experience.`,
    ];

    await ctx.reply(summaryLines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await ctx.api.editMessageText(chatId, thinkingMsg.message_id, `Analysis failed: ${escapeHtml(msg.slice(0, 200))}`);
    } catch {
      await ctx.reply(`Analysis failed: ${escapeHtml(msg.slice(0, 200))}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Callback Query Handlers
// ---------------------------------------------------------------------------

bot.callbackQuery("quick_dca_10", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $10 over 3 deposits");
});

bot.callbackQuery("quick_dca_50", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $50 over 5 deposits");
});

bot.callbackQuery("pool_status", async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const state = await getPoolState();
    const health = computePoolHealth(state);
    const csi = computeCSIFromState(state);
    await ctx.reply(
      `<b>Pool Status</b>\n\n` +
      `$1:     ${barChart(state.anonSets[0])} ${state.anonSets[0]}\n` +
      `$10:    ${barChart(state.anonSets[1])} ${state.anonSets[1]}\n` +
      `$100:   ${barChart(state.anonSets[2])} ${state.anonSets[2]}\n` +
      `$1,000: ${barChart(state.anonSets[3])} ${state.anonSets[3]}\n\n` +
      `Health: ${health.rating} | CSI: ${csi}`,
      { parse_mode: "HTML" },
    );
  } catch { await ctx.reply("Failed to fetch pool status."); }
});

bot.callbackQuery("btc_price", async (ctx) => {
  await ctx.answerCallbackQuery();
  const price = await fetchBtcPrice();
  await ctx.reply(
    price > 0 ? `<b>BTC:</b> <code>$${price.toLocaleString()}</code>` : "Price unavailable",
    { parse_mode: "HTML" },
  );
});

bot.callbackQuery("dca_1_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $1 daily 7 deposits");
});
bot.callbackQuery("dca_10_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $10 daily 5 deposits");
});
bot.callbackQuery("dca_50_weekly", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $50 weekly 4 deposits");
});
bot.callbackQuery("dca_100_weekly", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, "DCA $100 weekly 4 deposits");
});

bot.callbackQuery(/^strategy_amt_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const amount = ctx.match[1];
  const keyboard = new InlineKeyboard()
    .text("Max Privacy", `exec_${amount}_privacy`)
    .text("Efficient", `exec_${amount}_efficient`)
    .row()
    .text("Stealth DCA", `exec_${amount}_dca`)
    .text("Balanced", `exec_${amount}_balanced`);
  await ctx.reply(
    `<b>$${amount} \u2014 Select Strategy</b>\n\n` +
    `<b>Max Privacy:</b> Strongest anonymity set\n` +
    `<b>Efficient:</b> Single fast transaction\n` +
    `<b>Stealth DCA:</b> Spread across tiers\n` +
    `<b>Balanced:</b> Optimal mix`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

bot.callbackQuery(/^exec_(\d+)_(privacy|efficient|dca|balanced)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const amount = ctx.match[1];
  const strategyMap: Record<string, string> = {
    privacy: "max privacy",
    efficient: "quick efficient",
    dca: "DCA spread over 5 deposits",
    balanced: "balanced",
  };
  if (!ctx.chat) return;
  await runStrategyFlow(ctx.chat.id, ctx as any, `$${amount} ${strategyMap[ctx.match[2]]}`);
});

bot.callbackQuery("strategy_select", async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text("$10", "strategy_amt_10")
    .text("$50", "strategy_amt_50")
    .text("$100", "strategy_amt_100")
    .row()
    .text("$200", "strategy_amt_200")
    .text("$500", "strategy_amt_500")
    .text("$1,000", "strategy_amt_1000");
  await ctx.reply(`<b>Select amount:</b>`, { parse_mode: "HTML", reply_markup: keyboard });
});

bot.callbackQuery("check_approval", async (ctx) => {
  await ctx.answerCallbackQuery("Checking...");
  const info = await getRelayerInfo();
  await ctx.reply(
    `<b>Relayer:</b> ${info.relayer}\n` +
    `<b>Address:</b> <code>${info.relayerAddress ?? "N/A"}</code>\n\n` +
    `<i>Approval can only be verified on-chain. Try a small deposit to test.</i>`,
    { parse_mode: "HTML" },
  );
});

bot.callbackQuery("alerts_on", async (ctx) => {
  await ctx.answerCallbackQuery("Alerts enabled!");
  const user = getUser(ctx.chat!.id);
  user.notifyPrefs = { ...DEFAULT_PREFS };
  persistState();
  await ctx.reply("All notifications enabled.", { parse_mode: "HTML" });
});
bot.callbackQuery("alerts_off", async (ctx) => {
  await ctx.answerCallbackQuery("Alerts disabled.");
  const user = getUser(ctx.chat!.id);
  user.notifyPrefs = undefined;
  persistState();
  await ctx.reply("All notifications disabled.");
});

// Notification toggle callbacks
bot.callbackQuery(/^toggle_notify_(batch|intent|anon|price|personal)$/, async (ctx) => {
  const type = ctx.match[1] as keyof NotificationPrefs;
  const user = getUser(ctx.chat!.id);
  if (!user.notifyPrefs) user.notifyPrefs = { ...DEFAULT_PREFS };
  user.notifyPrefs[type] = !user.notifyPrefs[type];
  persistState();
  await ctx.answerCallbackQuery(`${type}: ${user.notifyPrefs[type] ? "ON" : "OFF"}`);

  // Rebuild keyboard with updated state
  const prefs = user.notifyPrefs;
  const keyboard = new InlineKeyboard()
    .text(`${prefs.batch ? "✓" : "○"} Batch`, "toggle_notify_batch")
    .text(`${prefs.intent ? "✓" : "○"} Intent`, "toggle_notify_intent")
    .row()
    .text(`${prefs.anon ? "✓" : "○"} Anon Sets`, "toggle_notify_anon")
    .text(`${prefs.price ? "✓" : "○"} BTC Price`, "toggle_notify_price")
    .row()
    .text(`${prefs.personal ? "✓" : "○"} My Deposits`, "toggle_notify_personal")
    .row()
    .text("Enable All", "notify_all")
    .text("Disable All", "notify_off");

  try {
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
  } catch { /* ignore if can't edit */ }
});

bot.callbackQuery("notify_all", async (ctx) => {
  const user = getUser(ctx.chat!.id);
  user.notifyPrefs = { ...DEFAULT_PREFS };
  persistState();
  await ctx.answerCallbackQuery("All notifications enabled!");
  const prefs = user.notifyPrefs;
  const keyboard = new InlineKeyboard()
    .text(`${prefs.batch ? "✓" : "○"} Batch`, "toggle_notify_batch")
    .text(`${prefs.intent ? "✓" : "○"} Intent`, "toggle_notify_intent")
    .row()
    .text(`${prefs.anon ? "✓" : "○"} Anon Sets`, "toggle_notify_anon")
    .text(`${prefs.price ? "✓" : "○"} BTC Price`, "toggle_notify_price")
    .row()
    .text(`${prefs.personal ? "✓" : "○"} My Deposits`, "toggle_notify_personal")
    .row()
    .text("Enable All", "notify_all")
    .text("Disable All", "notify_off");
  try { await ctx.editMessageReplyMarkup({ reply_markup: keyboard }); } catch { /* ignore */ }
});

bot.callbackQuery("notify_off", async (ctx) => {
  const user = getUser(ctx.chat!.id);
  user.notifyPrefs = undefined;
  persistState();
  await ctx.answerCallbackQuery("All notifications disabled!");
  const keyboard = new InlineKeyboard()
    .text(`○ Batch`, "toggle_notify_batch")
    .text(`○ Intent`, "toggle_notify_intent")
    .row()
    .text(`○ Anon Sets`, "toggle_notify_anon")
    .text(`○ BTC Price`, "toggle_notify_price")
    .row()
    .text(`○ My Deposits`, "toggle_notify_personal")
    .row()
    .text("Enable All", "notify_all")
    .text("Disable All", "notify_off");
  try { await ctx.editMessageReplyMarkup({ reply_markup: keyboard }); } catch { /* ignore */ }
});

bot.callbackQuery("export_notes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = getUser(ctx.chat!.id);
  if (user.notes.length === 0) {
    await ctx.reply("No notes to export.");
    return;
  }
  // Send as a file attachment instead of raw text in chat
  const noteData = JSON.stringify(user.notes, null, 2);
  const buffer = Buffer.from(noteData, "utf-8");
  await ctx.replyWithDocument(
    new InputFile(buffer, `veil-notes-${Date.now()}.json`),
    { caption: "Your private notes. Store securely and delete this message." },
  );
});

bot.callbackQuery("show_commitments", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = getUser(ctx.chat!.id);
  if (user.notes.length === 0) {
    await ctx.reply("No notes stored.");
    return;
  }
  const commitments = user.notes.map((n, i) =>
    `${i + 1}. ${DENOMINATION_LABELS[n.denomination]} — <code>${n.commitment}</code>`
  ).join("\n");
  await ctx.reply(
    `<b>Commitment IDs</b>\n\n${commitments}\n\n<i>These are public identifiers — safe to share.</i>`,
    { parse_mode: "HTML" },
  );
});

bot.callbackQuery("download_notes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = getUser(ctx.chat!.id);
  if (user.notes.length === 0) {
    await ctx.reply("No notes to download.");
    return;
  }
  const noteData = JSON.stringify(user.notes, null, 2);
  const buffer = Buffer.from(noteData, "utf-8");
  await ctx.replyWithDocument(
    new InputFile(buffer, `veil-notes-${Date.now()}.json`),
    { caption: "Your private notes. Store securely and delete this message." },
  );
});

// Plain text handler
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  if (text.startsWith("/")) {
    await ctx.reply(`Unknown command. Try <code>/help</code>`, { parse_mode: "HTML" });
    return;
  }

  const lower = text.toLowerCase();

  // Recommendation queries
  if (/what\s+should|recommend|suggest|help\s+me|advise/i.test(lower)) {
    try {
      const state = await getPoolState();
      const health = computePoolHealth(state);
      const keyboard = new InlineKeyboard()
        .text("Quick DCA $10", "quick_dca_10")
        .text("Quick DCA $50", "quick_dca_50");
      await ctx.reply(
        `<b>RECOMMENDATION</b>\n\n` +
        `<b>Pool health:</b> ${health.rating} (${health.score}/100)\n` +
        `<b>BTC:</b> $${state.btcPrice.toLocaleString()}\n\n` +
        `${health.recommendation}\n\n` +
        (health.score < 50
          ? `Suggestion: <b>DCA $10</b> targeting weakest tier for maximum privacy impact.`
          : `Pool is ${health.rating.toLowerCase()}. <b>Balanced $50</b> gives strong coverage.`),
        { parse_mode: "HTML", reply_markup: keyboard },
      );
    } catch {
      await ctx.reply("Try <code>/strategy $50 balanced</code>", { parse_mode: "HTML" });
    }
    return;
  }

  // Try to parse as strategy
  const target = parseTargetUsdc(text);
  if (target && target > 0) {
    await ctx.reply(`<i>Interpreting as strategy request...</i>`, { parse_mode: "HTML" });
    await runStrategyFlow(ctx.chat.id, ctx, text);
  } else {
    const keyboard = new InlineKeyboard()
      .text("Plan $10 Strategy", "quick_dca_10")
      .text("Plan $50 Strategy", "quick_dca_50");
    await ctx.reply(
      `Tell me your strategy \u2014 I'll plan it and link you to the app:\n\n` +
      `<code>$50 max privacy</code>\n` +
      `<code>DCA $100 over 5 deposits</code>\n` +
      `<code>what should I do?</code>`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  }
});

// ---------------------------------------------------------------------------
// Background Alert Polling (enhanced)
// ---------------------------------------------------------------------------

async function pollForAlerts() {
  const hasAnySubscriber = [...users.values()].some(u => u.notifyPrefs);
  if (!hasAnySubscriber) return;

  try {
    const state = await getPoolState();

    // Batch alerts
    if (lastBatchCount >= 0 && state.batchCount > lastBatchCount) {
      const msg = `<b>New Batch Executed</b>\nBatch #${state.batchCount} completed. USDC converted to BTC via AVNU.`;
      for (const chatId of getSubscribers("batch")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      // Personal alerts — users who deposited in the last 30 min
      const recentThreshold = Date.now() - 30 * 60 * 1000;
      for (const [chatId, userState] of users.entries()) {
        if (!userState.notifyPrefs?.personal) continue;
        const recentNote = userState.notes.find(n => n.timestamp > recentThreshold);
        if (recentNote) {
          const msg = `<b>Your Deposit Batch Executed</b>\nBatch containing your recent deposit has been converted to BTC.`;
          try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
        }
      }
    }
    lastBatchCount = state.batchCount;

    // Anonymity milestone alerts (5, 10, 20)
    for (let tier = 0; tier <= 3; tier++) {
      const current = state.anonSets[tier] ?? 0;
      const prev = lastAnonSets[tier] ?? 0;
      for (const threshold of ANON_THRESHOLDS) {
        if (current >= threshold && prev < threshold) {
          const msg = `<b>Anonymity Milestone</b>\n${DENOMINATION_LABELS[tier]} tier reached <b>${threshold}</b> participants!`;
          for (const chatId of getSubscribers("anon")) {
            try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
          }
        }
      }
    }
    lastAnonSets = { ...state.anonSets };

    // BTC price alerts (>5% move)
    if (lastBtcPrice > 0 && state.btcPrice > 0) {
      const change = Math.abs(state.btcPrice - lastBtcPrice) / lastBtcPrice;
      if (change >= 0.05) {
        const direction = state.btcPrice > lastBtcPrice ? "up" : "down";
        const msg = `<b>BTC Price Alert</b>\nBTC moved ${direction} ${(change * 100).toFixed(1)}%\n$${lastBtcPrice.toLocaleString()} \u2192 $${state.btcPrice.toLocaleString()}`;
        for (const chatId of getSubscribers("price")) {
          try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
        }
      }
    }
    if (state.btcPrice > 0) lastBtcPrice = state.btcPrice;

    // Intent tracking
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const pool = new Contract(POOL_ABI, POOL_ADDRESS, provider);
      const intentCount = Number(await pool.get_intent_count());
      if (lastIntentCount >= 0 && intentCount > lastIntentCount) {
        const newCount = intentCount - lastIntentCount;
        const msg = `<b>New Intent${newCount > 1 ? "s" : ""}</b>\n${newCount} new BTC settlement intent${newCount > 1 ? "s" : ""} created.`;
        for (const chatId of getSubscribers("intent")) {
          try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
        }
      }
      lastIntentCount = intentCount;
    } catch { /* intent count not available */ }
  } catch { /* silent */ }
}

setInterval(pollForAlerts, 60_000);

// ---------------------------------------------------------------------------
// Webhook HTTP Server — receives events from keeper/solver
// ---------------------------------------------------------------------------

async function handleWebhookNotify(body: { type: string; data: Record<string, unknown> }) {
  const { type, data } = body;

  switch (type) {
    case "batch_executed": {
      const usdcIn = data.usdc_in ? `$${(Number(data.usdc_in) / 1_000_000).toFixed(2)}` : "";
      const wbtcOut = data.wbtc_out ? `${(Number(data.wbtc_out) / 1e8).toFixed(8)} BTC` : "";
      const txHash = data.tx_hash ? String(data.tx_hash) : "";
      const txLink = txHash ? `\n<a href="${EXPLORER_BASE}/tx/${txHash}">View on Voyager</a>` : "";
      const msg = `<b>Batch Executed</b>\n${usdcIn ? `USDC in: ${usdcIn}\n` : ""}${wbtcOut ? `BTC out: ${wbtcOut}\n` : ""}${txLink}`;
      for (const chatId of getSubscribers("batch")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      break;
    }
    case "intent_created": {
      const amount = data.amount ? `${(Number(data.amount) / 1e8).toFixed(6)} BTC` : "";
      const msg = `<b>New Intent Created</b>\n${amount ? `Amount: ${amount}\n` : ""}Status: CREATED`;
      for (const chatId of getSubscribers("intent")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      break;
    }
    case "intent_claimed": {
      const intentId = data.intent_id ?? "?";
      const solver = data.solver ? String(data.solver).slice(0, 14) + "..." : "";
      const msg = `<b>Intent #${intentId} Claimed</b>\n${solver ? `Solver: <code>${solver}</code>\n` : ""}A solver is sending BTC...`;
      for (const chatId of getSubscribers("intent")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      break;
    }
    case "intent_settled": {
      const intentId = data.intent_id ?? "?";
      const amount = data.amount ? `${(Number(data.amount) / 1e8).toFixed(6)} BTC` : "";
      const msg = `<b>Intent #${intentId} Settled</b>\n${amount ? `Amount: ${amount}\n` : ""}BTC payment confirmed!`;
      for (const chatId of getSubscribers("intent")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      break;
    }
    case "intent_expired": {
      const intentId = data.intent_id ?? "?";
      const msg = `<b>Intent #${intentId} Expired</b>\nNo solver filled the intent. Funds refunded.`;
      for (const chatId of getSubscribers("intent")) {
        try { await bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }); } catch { /* ignore */ }
      }
      break;
    }
  }
}

function startWebhookServer() {
  const server = http.createServer(async (req, res) => {
    // Health check
    if (req.method === "GET" && req.url === "/health") {
      const subscriberCount = [...users.values()].filter(u => u.notifyPrefs).length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", subscribers: subscriberCount }));
      return;
    }

    // Webhook notify
    if (req.method === "POST" && req.url === "/notify") {
      // Auth check
      const authHeader = req.headers.authorization;
      if (BOT_WEBHOOK_SECRET && authHeader !== `Bearer ${BOT_WEBHOOK_SECRET}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          await handleWebhookNotify(parsed);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(BOT_WEBHOOK_PORT, () => {
    console.log(`[bot] Webhook server listening on :${BOT_WEBHOOK_PORT}`);
  });

  return server;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCSIFromState(state: PoolState): number {
  const values = Object.values(state.anonSets);
  return Math.max(...values, 0) * values.filter(a => a > 0).length;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

bot.catch((err) => {
  console.error("[bot] Error:", err.message ?? err);
});

console.log(`[bot] Veil Strategist starting (strategy planning mode)...`);
console.log(`[bot] Network: ${network}`);
console.log(`[bot] Pool: ${POOL_ADDRESS}`);
console.log(`[bot] Relayer API: ${RELAYER_API}`);
console.log(`[bot] Web app: ${WEB_APP_BASE}`);
console.log(`[bot] Webhook port: ${BOT_WEBHOOK_PORT}`);

// Start webhook server alongside bot
startWebhookServer();

bot.start({
  onStart: () => console.log("[bot] Veil Strategist is online. Strategy planning + webhook ready."),
});
