---
layout: home

hero:
  name: Veil Protocol
  text: Bitcoin's Privacy Layer
  tagline: Gasless private USDC-to-WBTC execution on Starknet. ZK proofs verified on-chain. Secrets never touch calldata.
  actions:
    - theme: brand
      text: How It Works
      link: /guide/how-it-works
    - theme: alt
      text: ZK Integration
      link: /technical/zk-integration
    - theme: alt
      text: Launch App
      link: https://theveilprotocol.vercel.app/app

features:
  - icon: 🔐
    title: ZK Proofs Verified On-Chain
    details: Noir circuit → Barretenberg prover → Garaga UltraKeccakZKHonk verifier. 2835 felt252 calldata elements. Real verification, not mock.
  - icon: ⚡
    title: Gasless Withdrawals
    details: Relayer submits your withdrawal tx. You never sign. No gas payment = no on-chain footprint linking you to the deposit.
  - icon: 🌊
    title: Anonymity Sets
    details: Fixed denominations (100 / 1K / 10K USDC) make all deposits in a tier indistinguishable. More users = exponentially stronger privacy.
  - icon: ₿
    title: Bitcoin Identity Binding
    details: Dual wallet — Starknet (Argent/Braavos) + Bitcoin (Xverse). BTC wallet cryptographically signs each deposit commitment.
  - icon: 🛡️
    title: No Secrets in Calldata
    details: Pedersen commitments (Stark field) + Poseidon BN254 ZK commitments. Secret and blinder never appear on-chain.
  - icon: ✅
    title: Compliance Escape Hatch
    details: Optional view keys + exportable JSON proofs let users prove transaction history to regulators when needed.
---
