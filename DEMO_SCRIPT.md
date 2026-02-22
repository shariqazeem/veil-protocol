# Veil Protocol -- 3-Minute Demo Video Script

## Setup Before Recording
- Open https://theveilprotocol.vercel.app in Chrome
- Have Argent X wallet ready (Starknet mainnet, funded with USDC)
- Open a second tab with Voyager explorer (mainnet)
- Clear browser console
- Screen: 1920x1080, browser at ~90% zoom

---

## Script (3:00)

### [0:00--0:20] Hook + Problem (20s)

**Voiceover:** "Every DeFi transaction is public. When you deposit or withdraw from a protocol, everyone can see -- your strategy, your timing, your position. But it's worse than that -- you have no idea *how private* you actually are. Privacy pools exist, but they don't tell you if your anonymity set is strong enough, if your timing exposes you, or when it's safe to withdraw. Until now."

**Screen:** Landing page of Veil Protocol. Slow scroll through the hero.

### [0:20--0:45] Solution Overview (25s)

**Voiceover:** "Veil Protocol is privacy infrastructure on Starknet with a built-in AI Privacy Agent. You deposit into shielded pools. Withdrawals use real zero-knowledge proofs generated in your browser. And the Privacy Agent analyzes your on-chain privacy posture in real-time -- scoring your deposits, detecting threats, and recommending when to withdraw."

**Screen:** Click "Open Terminal" -> show the app dashboard with stats cards and pool overview.

### [0:45--1:20] Live Demo -- Shield (35s)

**Voiceover:** "Let me show you. I connect my Starknet wallet on mainnet."

**Screen:** Connect Argent X. Show connected state in header.

**Voiceover:** "I'll shield 1 USDC into the privacy pool. The app generates a Pedersen commitment and a Poseidon BN254 commitment entirely client-side -- only cryptographic hashes go on-chain."

**Screen:** Go to Shield tab. Select $1 tier. Click "Shield 1 USDC". Show step-by-step: commitment generation -> on-chain deposit. Wait for success toast.

**Voiceover:** "Done. My deposit is in the shielded pool. The anonymity set just grew -- my deposit is indistinguishable from every other $1 deposit."

### [1:20--2:10] AI Privacy Agent (50s)

**Voiceover:** "Now the key differentiator -- the AI Privacy Agent. I'll ask it: 'How private am I?'"

**Screen:** Go to Agent tab. Show the Privacy Chat interface. Type "how private am I?" and send.

**Voiceover:** "The agent loads my deposits from local storage, sends them to the scoring engine, and returns a detailed privacy analysis. Here's my privacy score -- broken down by anonymity set strength, time elapsed since deposit, deposits that happened after mine, and timing safety."

**Screen:** Show the privacy score card with animated score bar and per-factor breakdown. Show severity colors (green/yellow/red).

**Voiceover:** "I can also ask 'check pool health' -- the agent returns live on-chain data for all four tiers: anonymity set sizes, active tier count, overall health rating, and improvement suggestions."

**Screen:** Type "check pool health". Show the pool health card with tier grid and metrics.

**Voiceover:** "And for strategies: '$50 max privacy' generates a structured deposit plan with projected privacy impact."

**Screen:** Type "$50 max privacy". Show strategy response.

### [2:10--2:35] x402 Premium + Unveil (25s)

**Voiceover:** "Premium features use x402 micropayments. A deep privacy audit costs 0.005 STRK -- settled on-chain. The Deposit Strategist tab offers premium analysis gated behind the same x402 protocol."

**Screen:** Switch to Deposit Strategist tab. Show x402 payment flow for premium analysis.

**Voiceover:** "And when you're ready to withdraw -- the Unveil tab generates a real ZK proof in your browser. The Garaga verifier validates it on-chain. Your WBTC arrives with zero connection to your original deposit."

**Screen:** Quick flash of Unveil tab showing the ZK pipeline progress steps.

### [2:35--3:00] Technical Depth + Close (25s)

**Voiceover:** "Under the hood: Cairo smart contracts with 52 passing tests. 90 frontend tests covering all API routes and components. A Noir ZK circuit verified by Garaga on mainnet. Browser-side proof generation. A gasless relayer. AI privacy scoring with four-dimension analysis. And x402 micropayments for sustainable protocol economics -- all deployed on Starknet mainnet with real assets."

**Screen:** Quick montage: terminal showing test results (142 total), Voyager showing mainnet contracts, the Privacy Agent chat interface.

**Voiceover:** "Veil Protocol. Privacy infrastructure with AI-powered analytics. Built for the Re{define} Hackathon on Starknet."

**Screen:** Landing page with logo. GitHub link. End.

---

## Recording Tips
- Use OBS Studio or QuickTime for screen recording
- Record voiceover separately for clean audio
- Keep mouse movements smooth and deliberate
- The AI chat responses are instant (no LLM latency -- deterministic engine)
- If ZK proof takes >30s, speed up that section in editing
- Export at 1080p, upload to YouTube as unlisted
