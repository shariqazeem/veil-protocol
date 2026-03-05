# VEIL PROTOCOL — 3 MINUTE DEMO SCRIPT

## PRE-RECORDING CHECKLIST

Before you hit record, do all of this:

- [ ] Ready Wallet has ~$50 USDC + some STRK for gas
- [ ] Cartridge Controller account exists (social login)
- [ ] Browser: open theveilprotocol.vercel.app (landing page — show it first!)
- [ ] Pre-load theveilprotocol.vercel.app/app in another tab (don't show yet)
- [ ] Start the app logged OUT (no wallet connected)
- [ ] Telegram Desktop open on Mac, search for your bot: @VeilStrategistBot
- [ ] Screen recording at 1080p, notifications OFF on Mac
- [ ] Phone ready with this script open
- [ ] Practice the full flow 2-3 times before recording

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
around these points. Stay calm and confident. Sound like you're
showing a friend, not presenting to investors.

**CRITICAL**: Target 2:50 recorded — leaves buffer under 3:00 limit.

---

### PART 1: HOOK + INTRO (0:00 — 0:20)

**[Start on landing page — show "Re{defining} Privacy on Starknet" hero]**

> "Every on-chain transaction is public. Your entire financial
> history is exposed — anyone can trace your wallet, link your
> identities, analyze your strategy.
>
> Veil Protocol re{defines} that. Real zero-knowledge privacy,
> deployed on Starknet mainnet with real money. Not a testnet
> demo — let me show you."

**[Scroll briefly past the "What We Re{define}" cards — let judges
see them flash by, then click "Launch App"]**

---

### PART 2: CONNECT + PORTFOLIO (0:20 — 0:45)

**[Click wallet pill top-right → Connect Cartridge Controller
via social login (email/passkey)]**

> "Connecting with Cartridge Controller — social login, no seed
> phrase, works on any device. This is powered by the new Starkzap
> SDK — wasn't possible a few weeks ago."

**[Show connected → Portfolio tab briefly — show token balances]**

> "Portfolio tab — 9 token balances with on-chain logos, send
> any token, STRK staking to top validators. All via Starkzap SDK."

**[If Cartridge wallet is pre-funded, skip funding step entirely.
If not: briefly show Send flow from another wallet — CUT the TX wait.]**

> "Now — the privacy magic."

---

### PART 3: SHIELD $10 (0:45 — 1:10)

**[Shield tab → Select $10 tier → Click Shield Capital]**

> "Shielding 10 dollars into the privacy pool. ZK proof generated
> right in my browser — secrets never leave this device. Gas paid
> in USDC through AVNU's paymaster — completely gasless."

**[TX confirms — CUT the wait time in editing]**

> "Shielded. My deposit is now indistinguishable from every other
> $10 deposit in the pool. I get a private note — the only key
> to withdraw these funds."

---

### PART 4: CROSS-WALLET UNVEIL — THE WOW MOMENT (1:10 — 1:50)

**THIS IS THE KEY MOMENT. Nail this and judges remember you.**

**[Unveil tab → Show the note → Click Export / Copy Note]**

> "Here's what re{defines} privacy. I'm exporting this private
> note — and importing it into a COMPLETELY DIFFERENT wallet."

**[Disconnect Cartridge → Connect Argent/Braavos → Unveil tab
→ Import/Paste the note → Click Unveil]**

> "Different wallet, different identity. The protocol verifies
> my ZK proof on-chain via Garaga — confirms I own this note
> — and releases the funds. Without revealing WHICH deposit
> the note came from.
>
> Two wallets. ZERO on-chain connection. That's not mixing,
> not tumbling — that's mathematically provable unlinkability."

**[TX confirms — CUT wait time → Show funds arrived]**

> "10 dollars moved. Zero trace. That's Veil."

---

### PART 5: AI STRATEGIST (1:50 — 2:15)

**[Stay on current wallet → Strategist tab]**

> "For larger amounts, manually picking tiers isn't optimal.
> Our AI Strategist re{defines} that."

**[Type: "shield 40 dollars with maximum privacy"]**

> "I describe what I want in plain English. The agent analyzes
> live pool conditions — anonymity set sizes, tier distributions —
> and generates an optimal multi-step deposit plan. Five strategy
> modes from stealth DCA to whale distribution."

**[Agent responds with plan — show the cards/steps]**

> "It splits across tiers for maximum anonymity. One-click execute."

**[If time: click execute and FAST FORWARD through TXs at 4x.
If tight on time: just show the plan and move on.]**

---

### PART 6: QUICK HITS — COMPLIANCE + TELEGRAM + x402 (2:15 — 2:40)

**[Compliance tab — flash briefly]**

> "Privacy doesn't mean lawlessness. This is an Association Set —
> same compliance model proposed by Vitalik Buterin. You can prove
> your funds are clean without revealing your transaction history."

**[Switch to Telegram Desktop → Show bot, type /status]**

> "Veil Strategist Bot — plan strategies right from Telegram.
> Pool analytics, AI-powered deposit plans, deep links to execute.
> The bot never touches your keys."

**[Back to web app → Strategist tab, mention x402]**

> "Premium analytics gated by x402 micropayments — fractions of
> a cent per query, settled on-chain. No subscriptions, no API keys."

---

### PART 7: CLOSING (2:40 — 2:55)

**[Show landing page briefly — the Re{define} cards visible]**

> "Veil Protocol. First Association Set Privacy Pool on Starknet.
> Real ZK proofs verified by Garaga on mainnet. Real money.
> 164 tests across three languages. Re{defining} privacy —
> where compliance and confidentiality aren't enemies,
> they're the same thing."

---

## EDITING CHECKLIST

1. Cut all TX wait times (10-20 sec each) — show "confirming"
   then jump to confirmed
2. Raw recording will be ~6-7 min — cuts bring it to ~2:50
3. Optional: subtle lo-fi background music (very low volume)
4. Title card at start: "Veil Protocol — Re{defining} Privacy on Starknet"
5. Text overlays during key moments:
   - "ZK proof: browser-side, secrets never leave your device" (during shield)
   - "ZERO on-chain link" (during cross-wallet unveil — make this BIG)
   - "MAINNET — real money" (show briefly)
   - "Gas paid in USDC via AVNU Paymaster" (during Cartridge TX)
   - "AI analyzes live pool conditions" (during strategist)
   - "164 tests (Cairo + Noir + Vitest)" (quick flash near end)
6. End card: "Re{defining} Privacy on Starknet" + GitHub URL

## TIMING SUMMARY

| Part | Duration | Content |
|------|----------|---------|
| 1. Hook + Intro | 0:00-0:20 | Landing page, Re{define} narrative |
| 2. Connect + Portfolio | 0:20-0:45 | Social login, Starkzap SDK |
| 3. Shield | 0:45-1:10 | $10 deposit, ZK proof, gasless |
| 4. Cross-Wallet Unveil | 1:10-1:50 | THE WOW MOMENT — two wallets, zero link |
| 5. AI Strategist | 1:50-2:15 | Natural language → optimal plan |
| 6. Quick Hits | 2:15-2:40 | Compliance, Telegram bot, x402 |
| 7. Close | 2:40-2:55 | Re{define} sign-off |

**Target: 2:50-2:55** (under 3:00 limit with buffer)

## IF SOMETHING BREAKS

- **TX fails?** Say "let me retry" naturally, cut the failed attempt
- **Bot not responding?** Skip Telegram section — you have 2:40 of solid content without it
- **Balances not loading?** Hit refresh button, say "fetching on-chain data"
- **Cartridge login fails?** Use Argent/Braavos for everything, mention social login verbally
- **Note export not working?** Copy the note manually from browser storage, paste it
- **Slow proof generation?** Pre-generate and have note ready, cut the wait in editing
