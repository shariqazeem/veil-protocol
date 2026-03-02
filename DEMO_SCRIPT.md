# VEIL PROTOCOL — 3 MINUTE DEMO SCRIPT

## PRE-RECORDING CHECKLIST

Before you hit record, do all of this:

- [ ] Ready Wallet has ~$50 USDC + some STRK for gas
- [ ] Cartridge Controller account exists (social login)
- [ ] Browser: open theveilprotocol.vercel.app/app (clean tab, no other tabs visible)
- [ ] Start the app logged OUT (no wallet connected)
- [ ] Telegram Desktop open on Mac, search for your bot: @VeilStrategistBot
- [ ] Screen recording at 1080p, notifications OFF on Mac
- [ ] Phone ready with this script open

## BEFORE RECORDING — START THE TELEGRAM BOT

Open terminal and run:
```
cd ~/projects/ghost-sats/scripts
```
Edit .env — change WEB_APP_URL:
```
WEB_APP_URL=https://theveilprotocol.vercel.app
```
Then start the bot:
```
npx tsx bot.ts
```
You should see: "Veil Strategist is online"
Keep this terminal running in background.

---

## THE SCRIPT

Read this naturally. Don't read word-for-word — use your own words
around these points. Stay calm and confident.

---

### PART 1: INTRO (0:00 — 0:15)

> "Hey — this is Veil Protocol.
>
> It's a privacy-first DeFi app on Starknet using zero-knowledge
> proofs. The problem: when you hold or move crypto, your entire
> financial history is public. Anyone can trace your wallet.
> Veil fixes this — you shield your tokens privately and unveil
> them from a completely different wallet, with zero on-chain link.
>
> Let me show you with real money on mainnet."

---

### PART 2: CONNECT CARTRIDGE + FUND IT (0:15 — 0:40)

**[Click wallet pill top-right → Connect Cartridge Controller
via social login (email/Google)]**

> "I'm connecting with Cartridge Controller — social login,
> no seed phrase. Easiest way to onboard new users to Starknet."

**[Show connected. Wallet is empty.]**

> "My Cartridge wallet is empty. Let me fund it live."

**[Disconnect Cartridge → Connect Ready Wallet (Argent/Braavos)
→ Portfolio tab → Send → Select USDC → Paste Cartridge address
→ Send ~$12 USDC. Also send some STRK for gas.]**

> "Switching to my main wallet — Ready Wallet. I'll send some
> USDC and STRK to Cartridge using the built-in send feature.
> This shows the Portfolio tab — token balances with logos,
> send flow, all powered by Starkzap SDK."

**[TX confirms → Disconnect Ready → Reconnect Cartridge
→ Portfolio shows ~$12 USDC]**

> "Done. Cartridge has funds. Now — the privacy magic."

---

### PART 3: SHIELD $10 FROM CARTRIDGE (0:40 — 1:10)

**[Shield tab → Select Tier 0 ($10) → Click Shield]**

> "Shielding 10 dollars into the privacy pool. A zero-knowledge
> proof is being generated right in my browser — client-side.
> This proof lets me deposit into a shared anonymity pool.
> The more people in the pool, the stronger everyone's privacy.
>
> Gas is paid in USDC through AVNU's paymaster — completely
> gasless, no STRK needed for Cartridge users."

**[TX confirms — CUT the wait time in editing]**

> "Shielded. My 10 dollars is inside the ZK privacy pool.
> I get a private note — like a secret receipt only I can
> use to withdraw."

---

### PART 4: EXPORT NOTE + UNVEIL FROM DIFFERENT WALLET (1:10 — 1:50)

**THIS IS THE KEY MOMENT — shows real privacy in action.**

**[Unveil tab → Show the note → Click Export / Copy Note]**

> "Here's where it gets powerful. I'm exporting this private
> note — and I'm going to import it into a COMPLETELY DIFFERENT
> wallet. This is the whole point of Veil.
>
> The deposit wallet and the withdrawal wallet have absolutely
> zero connection on-chain. Nobody can trace that these two
> wallets belong to the same person."

**[Disconnect Cartridge → Connect Ready Wallet → Unveil tab
→ Import/Paste the note → Click Unveil]**

> "I switch to Ready Wallet — a totally separate identity.
> I paste the exported note and unveil it. The protocol
> verifies my ZK proof, confirms I own this note, and releases
> the funds — without revealing which deposit created it.
>
> That's real cryptographic privacy. Not mixing, not tumbling
> — true unlinkability powered by zero-knowledge proofs."

**[TX confirms — CUT wait time → Show $10 arrived in balance]**

> "10 dollars moved between two wallets. Zero trace. That's Veil."

---

### PART 5: AI STRATEGIST + SHIELD $40 (1:50 — 2:20)

**[Stay on Ready Wallet → Strategist tab]**

> "For larger amounts, we built an AI Strategist. Instead of
> manually picking tiers, I describe what I want in plain English."

**[Type: "shield 40 dollars with maximum privacy"]**

> "I say — shield 40 dollars, maximum privacy. The agent
> analyzes live pool conditions — anonymity set sizes, which
> tiers give the best privacy coverage — and builds an
> optimal multi-step plan."

**[Agent responds with plan → Click to execute]**

> "It recommends splitting across multiple tiers for better
> anonymity. I execute right here. Gas on Ready Wallet is
> under 65 cents per transaction — way cheaper than L1."

**[Execute shields → FAST FORWARD through multiple TXs]**

*[In editing: speed up 4x through the deposits, show each
confirming quickly]*

> "Each deposit generates a fresh ZK proof and grows the
> anonymity pool. And I can unveil all of them — each
> withdrawal is completely unlinkable to its deposit."

**[Unveil tab → Show multiple notes → Claim them
→ FAST FORWARD]**

---

### PART 6: TELEGRAM BOT (2:20 — 2:45)

**[Switch to Telegram Desktop on Mac → Open the bot chat]**

> "We also built a Telegram bot — the Veil Strategist.
> Users can plan everything from Telegram without opening
> the web app."

**[Type: /start → Show welcome message with buttons]**

> "Quick actions right here."

**[Type: /status → Show pool state with anonymity sets]**

> "Real-time pool analytics — anonymity set sizes, BTC price,
> protocol health — all live from Starknet."

**[Type: /strategy $50 max privacy → Show the response
with Execute button]**

> "I plan a strategy right in Telegram — 50 dollars, max
> privacy. The bot generates the same AI-powered plan and
> gives me a link to execute in the web app.
>
> The bot plans. Your wallet executes. It never touches
> your keys."

---

### PART 7: CLOSING (2:45 — 3:00)

**[Switch back to web app → Portfolio tab → Show balances
and the staking section briefly]**

> "Veil Protocol — privacy-preserving DeFi on Starknet.
> Real zero-knowledge proofs. Deployed on mainnet with real
> money. Gasless transactions. AI strategy planning.
> Full portfolio management with staking. All open source.
>
> Privacy isn't a feature — it's a right. Thanks for watching."

---

## EDITING CHECKLIST

1. Cut all TX wait times (10-20 sec each) — show "confirming"
   then jump to confirmed
2. Raw recording will be ~7 min — cuts bring it to 3
3. Optional: subtle lo-fi background music (very low volume)
4. Title card at start: "Veil Protocol — Privacy-First DeFi on Starknet"
5. Text overlays during key moments:
   - "ZK proof generated client-side" (during shield)
   - "ZERO on-chain link between wallets" (during cross-wallet unveil)
   - "Gas paid in USDC — no STRK needed" (during Cartridge TX)
   - "AI analyzes live pool conditions" (during strategist)
6. End card: GitHub URL + "Built for Re{define} Hackathon"

## IF SOMETHING BREAKS

- **TX fails?** Say "let me retry" naturally, cut the failed attempt
- **Bot not responding?** Skip Telegram, you have 2:45 of solid content
- **Balances not loading?** Hit refresh button, say "fetching on-chain data"
- **Cartridge gas too high?** Use Ready Wallet for everything, explain both wallets verbally
- **Note export not working?** Copy the note manually from browser storage, paste it
