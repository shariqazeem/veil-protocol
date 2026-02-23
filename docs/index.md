---
layout: home

hero:
  name: Veil Protocol
  text: Privacy Infrastructure on Starknet
  tagline: Private USDC-to-BTC execution on Starknet mainnet with on-chain ZK proofs, an AI Privacy Agent, x402 micropayments, and a Telegram bot. Gasless. Unlinkable. Verifiable.
  actions:
    - theme: brand
      text: How It Works
      link: /guide/how-it-works
    - theme: alt
      text: AI Strategist
      link: /guide/ai-strategist
    - theme: alt
      text: Launch App
      link: https://theveilprotocol.vercel.app/app

features:
  - icon: "\uD83D\uDD10"
    title: ZK Proofs Verified On-Chain
    details: Noir circuit compiled to UltraKeccakZKHonk proof via bb.js WASM, verified on-chain by Garaga. 2,835 felt252 calldata elements. In-browser proving -- secrets never leave your device.
  - icon: "\uD83E\uDDE0"
    title: AI Privacy Agent + x402
    details: "Natural language privacy analysis: \"How private am I?\" returns per-deposit scoring. Premium features gated by x402 micropayments (0.005 STRK). Five strategy types with projected privacy impact."
  - icon: "\u26A1"
    title: Gasless Withdrawals
    details: Relayer submits your withdrawal transaction. You never sign. No gas payment means no on-chain footprint linking you to the original deposit.
  - icon: "\uD83D\uDCF1"
    title: Telegram Bot
    details: "@VeilStrategistBot -- plan and execute accumulation strategies directly from Telegram. Live BTC price, pool analytics, and deep-link execution to the web app."
  - icon: "\uD83C\uDF0A"
    title: Anonymity Sets
    details: "Fixed denominations ($1 / $10 / $100 / $1,000 USDC) make all deposits in a tier indistinguishable. More participants per tier means exponentially stronger privacy."
  - icon: "\u20BF"
    title: Bitcoin Identity Binding
    details: Dual wallet -- Starknet (Argent/Braavos) + Bitcoin (Xverse). Your BTC wallet cryptographically signs each deposit commitment. Intent settlement bridges to native Bitcoin.
---
