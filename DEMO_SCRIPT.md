# Veil Protocol — 3-Minute Demo Video Script

## Setup Before Recording
- Open https://theveilprotocol.vercel.app in Chrome
- Have Argent X wallet ready (Sepolia, funded with test USDC)
- Have Xverse wallet ready (Bitcoin testnet)
- Open a second tab with Voyager explorer
- Clear browser console
- Screen: 1920x1080, browser at ~90% zoom for clean capture

---

## Script (3:00)

### [0:00–0:20] Hook + Problem (20s)

**Voiceover:** "Every Bitcoin purchase in DeFi is public. If you're accumulating BTC — as an institution, a fund, or an individual — everyone can see your strategy, your timing, and your position size. Front-runners exploit this. Competitors monitor you. There's no privacy in Bitcoin DeFi today."

**Screen:** Landing page of Veil Protocol. Scroll slowly through the hero section.

### [0:20–0:40] Solution Overview (20s)

**Voiceover:** "Veil Protocol solves this. It's confidential Bitcoin accumulation infrastructure on Starknet. You deposit USDC into shielded tranches. Deposits batch into a single swap — your intent is hidden. When you withdraw, a zero-knowledge proof generated in your browser proves ownership without revealing your identity. Secrets never leave your device."

**Screen:** Click "Open Terminal" → show the app dashboard with stats cards and pool overview.

### [0:40–1:20] Live Demo — Shield (40s)

**Voiceover:** "Let me show you. I connect my Starknet wallet... and my Bitcoin wallet for cross-chain settlement."

**Screen:** Connect Argent X. Connect Xverse. Show both connected in the header.

**Voiceover:** "I'll shield 10 USDC. The app generates a Pedersen commitment and a Poseidon BN254 commitment client-side — only hashes go on-chain."

**Screen:** Go to Shield tab. Select $10 tier. Click "Shield 10 USDC". Show the step-by-step progress: commitment generation → Bitcoin wallet signing → on-chain deposit. Wait for success toast.

**Voiceover:** "Done. My deposit is in the shielded pool. The dashboard shows the anonymity set growing — my deposit is indistinguishable from everyone else's."

**Screen:** Show updated dashboard stats.

### [1:20–2:10] Live Demo — Unveil with ZK Proof (50s)

**Voiceover:** "Now the key innovation — withdrawal with a real zero-knowledge proof. Watch the three-step pipeline."

**Screen:** Go to Unveil tab. Show the note card with "Ready" status. Click "Claim WBTC".

**Voiceover:** "Step one: witness generation runs in the browser using noir_js WASM. Step two: the proof is generated using bb.js — this is a real UltraKeccakZKHonk proof, not a mock. Step three: the proof is converted to 2,835 Starknet-compatible calldata elements by the Garaga server."

**Screen:** Show the ZK pipeline progress (Witness → Proof → Calldata). Show the timer counting up during proof generation (~15-30 seconds).

**Voiceover:** "The proof is submitted on-chain. The Garaga verifier contract validates it cryptographically. My WBTC arrives — with zero connection to my original deposit."

**Screen:** Show success. Show WBTC received. Open Voyager in second tab — show the transaction with the PrivateWithdrawal event.

### [2:10–2:35] AI Agent + Telegram (25s)

**Voiceover:** "Veil also includes an AI Strategy Agent. I can type natural language — 'maximize privacy with 50 dollars' — and it generates a structured plan based on live pool analytics."

**Screen:** Go to Strategist tab. Type "maximize privacy $50". Show the strategy output with tier recommendations and privacy scores.

**Voiceover:** "The same engine powers our Telegram bot. Strategies generate deep links that open the app with pre-filled parameters."

**Screen:** Quick flash of Telegram bot (@VeilStrategistBot) showing /strategy command.

### [2:35–3:00] Technical Depth + Close (25s)

**Voiceover:** "Under the hood: Cairo smart contracts with 52 passing tests. A Noir ZK circuit verified on-chain by Garaga. Browser-side proof generation where secrets never leave your device. A gasless relayer for unlinkable withdrawals. And everything deployed on Starknet Sepolia with enforced ZK verification."

**Screen:** Quick montage: terminal showing `snforge test` with 52 passing, Voyager showing the deployed contracts, the docs site.

**Voiceover:** "Veil Protocol. Confidential Bitcoin accumulation. Built for the Re{define} Hackathon on Starknet."

**Screen:** Landing page with logo. GitHub link. End.

---

## Recording Tips
- Use OBS Studio or QuickTime for screen recording
- Record voiceover separately for clean audio (or use a good mic)
- Keep mouse movements smooth and deliberate
- If ZK proof takes too long (>30s), you can speed up that section in editing
- Export at 1080p, upload to YouTube as unlisted
