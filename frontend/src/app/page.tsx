"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  Layers,
  Lock,
  Zap,
  Bitcoin,
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ExternalLink,
  CheckCircle,
  TrendingUp,
  Building2,
  BarChart3,
  Server,
} from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { EXPLORER_CONTRACT } from "@/utils/network";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 backdrop-blur-md bg-[var(--bg-primary)]/80">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Veil<span className="text-[var(--accent-orange)]"> Protocol</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://theveilprotocol-docs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Docs
            </a>
            <Link href="/app">
              <motion.button
                className="px-5 py-2.5 bg-[var(--accent-orange)] text-white rounded-full text-[13px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -1, boxShadow: "0 0 30px -5px rgba(255, 90, 0, 0.3)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                Open Terminal
                <ArrowRight size={14} strokeWidth={2} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-28 px-4 sm:px-6">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,90,0,0.4) 0%, rgba(255,90,0,0) 70%)" }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] mb-6">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">Live on Starknet</span>
              </span>
              <span className="w-px h-3 bg-[var(--border-subtle)]" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">STARK-Verified</span>
              </span>
              <span className="w-px h-3 bg-[var(--border-subtle)]" />
              <span className="inline-flex items-center gap-1.5">
                <Bitcoin size={10} strokeWidth={2} className="text-[var(--accent-orange)]" />
                <span className="text-[11px] text-[var(--accent-orange)] font-medium">BTC Settlement</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[32px] sm:text-[56px] font-black tracking-tight text-[var(--text-primary)] leading-[1.08] mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            Confidential Bitcoin
            <br />
            <span className="text-[var(--accent-orange)]">Accumulation Infrastructure</span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-[var(--text-secondary)] max-w-xl mx-auto mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            Treasury-grade Bitcoin exposure layer built on Starknet&apos;s quantum-secure STARK proofs. Allocate capital confidentially. Exit without trace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8"
          >
            <span className="text-[12px] text-[var(--text-tertiary)]">No public order book exposure</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
            <span className="text-[12px] text-[var(--text-tertiary)]">No on-chain position signaling</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="/app">
              <motion.button
                className="px-8 py-4 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2"
                whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
              >
                <Shield size={16} strokeWidth={1.5} />
                Open Terminal
              </motion.button>
            </Link>
            <a
              href="https://github.com/shariqazeem/veil-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[15px] font-medium transition-colors"
            >
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: "radial-gradient(circle, #EF4444 0%, transparent 70%)" }}
            />
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} strokeWidth={1.5} className="text-red-400" />
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">The Problem</h2>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-6">
              Public Bitcoin accumulation exposes treasury strategy. Every on-chain purchase signals intent to the market.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Strategy Leakage",
                  desc: "On-chain buy orders reveal accumulation intent. Competitors front-run positions. Analysts reconstruct your strategy in real-time.",
                },
                {
                  title: "Position Correlation",
                  desc: "Unique transaction amounts create fingerprints. Even across wallets, accumulation patterns are reconstructable through amount analysis.",
                },
                {
                  title: "MEV Extraction",
                  desc: "Visible orders in the mempool enable sandwich attacks. Market makers extract value before your execution settles.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-red-400/50 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">{item.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 left-0 w-80 h-80 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
            />
            <div className="flex items-center gap-2 mb-6">
              <Shield size={16} strokeWidth={1.5} className="text-emerald-400" />
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">The Solution</h2>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
              Confidential tranche-based accumulation using STARK proofs. Capital enters standardized privacy pools. Batch execution hides individual intent. Zero-knowledge proofs enable unlinkable exits.
            </p>
            <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
              Built natively on Starknet&apos;s Cairo VM with Garaga on-chain ZK verification. No trusted setup. No off-chain dependencies for proof validity. The first treasury-grade Bitcoin accumulation layer built on quantum-secure STARK infrastructure.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Protocol Flow
            </span>
            <h2 className="text-[20px] sm:text-[28px] font-black tracking-tight text-[var(--text-primary)] mt-3">
              Four Phases of Confidential Accumulation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                title: "Allocate",
                desc: "Deposit USDC into standardized tranches ($1/$10/$100). A Pedersen commitment conceals your identity. Optional Bitcoin wallet attestation.",
                color: "var(--accent-orange)",
              },
              {
                icon: Layers,
                title: "Batch Execute",
                desc: "All deposits aggregate into a single USDC-to-BTC conversion via AVNU. Individual intent is hidden within the batch.",
                color: "var(--accent-green)",
              },
              {
                icon: Fingerprint,
                title: "Verify",
                desc: "Zero-knowledge proof generated entirely in-browser via Noir circuits. Garaga verifier validates on-chain. Secrets never leave your device.",
                color: "#10B981",
              },
              {
                icon: Eye,
                title: "Exit",
                desc: "Claim BTC on Starknet or settle to native Bitcoin via intent bridge. No cryptographic link to the original allocation.",
                color: "var(--text-primary)",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="glass-card p-5 text-center relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={18} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
                    0{i + 1}
                  </span>
                  <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Starknet */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Server size={16} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Why Starknet</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title: "Quantum-Secure STARKs",
                  desc: "STARK proofs require no trusted setup and are resistant to quantum computing attacks. Future-proof cryptographic guarantees for institutional capital.",
                },
                {
                  title: "Cairo-Native Implementation",
                  desc: "Entire protocol built in Cairo. Pedersen commitments, Merkle trees, and batch execution run natively on the Starknet VM. No EVM compatibility overhead.",
                },
                {
                  title: "Bitcoin DeFi Layer",
                  desc: "Sub-$0.01 transaction costs enable batch execution economics. Account abstraction enables gasless withdrawals. AVNU aggregation ensures best execution.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-orange)]/50 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">{item.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Technical Architecture */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Technical Architecture
            </span>
          </div>
          <motion.div
            className="glass-card p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-orange)] mb-3">Client</div>
                <div className="space-y-2">
                  {["noir_js witness generation", "bb.js proof generation", "Poseidon BN254 commitments", "Starknet + BTC wallets"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-orange)]" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-emerald-800/20 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-3">On-Chain (Cairo)</div>
                <div className="space-y-2">
                  {["Pedersen commitment scheme", "Garaga UltraKeccakZKHonk verifier", "Merkle tree (depth 20)", "Intent escrow + oracle settlement"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Infrastructure</div>
                <div className="space-y-2">
                  {["AVNU DEX aggregation", "Gasless relayer abstraction", "Compliance view keys", "Bitcoin intent bridge"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
                      <span className="text-[11px] text-[var(--text-secondary)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ZK Pipeline */}
            <div className="rounded-xl bg-emerald-950/10 border border-emerald-800/15 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">ZK Proof Pipeline</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Noir Circuit", sub: "Poseidon BN254" },
                  { label: "noir_js", sub: "Witness (browser)" },
                  { label: "bb.js", sub: "Proof (browser)" },
                  { label: "Garaga", sub: "~2835 felt252" },
                  { label: "On-Chain", sub: "STARK verified" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center">
                    <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-800/20 p-2 text-center">
                      <div className="text-[10px] font-semibold text-emerald-400">{step.label}</div>
                      <div className="text-[9px] text-emerald-400/50">{step.sub}</div>
                    </div>
                    {i < 4 && (
                      <span className="hidden sm:block text-[var(--text-quaternary)] text-[10px] px-1 flex-shrink-0">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Security Properties
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Building2,
                title: "Standardized Tranches",
                desc: "Fixed denominations create uniform anonymity sets. No amount-based correlation attacks.",
              },
              {
                icon: Lock,
                title: "MEV Protection",
                desc: "Individual orders hidden in batch execution. No front-running or sandwich extraction.",
              },
              {
                icon: ShieldCheck,
                title: "Compliance Ready",
                desc: "Optional view keys prove transaction history to auditors without breaking pool confidentiality.",
              },
              {
                icon: TrendingUp,
                title: "Best Execution",
                desc: "AVNU DEX aggregation across all Starknet liquidity sources. Optimal routing guaranteed.",
              },
              {
                icon: Bitcoin,
                title: "Native BTC Settlement",
                desc: "Intent-based Bitcoin bridge. Lock, solve, confirm. Trustless cross-chain settlement.",
              },
              {
                icon: Fingerprint,
                title: "On-Chain Verification",
                desc: "Noir circuits + Garaga verifier. Browser-generated proofs validated on-chain. No trusted server.",
              },
              {
                icon: Zap,
                title: "Gasless Withdrawal",
                desc: "Relayer-abstracted exits. No gas token required. Maximum operational privacy.",
              },
              {
                icon: Eye,
                title: "Timing Protection",
                desc: "Mandatory delay between batch and withdrawal prevents deposit-exit correlation attacks.",
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-colors"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <feat.icon size={16} strokeWidth={1.5} className="text-[var(--accent-orange)] mb-3" />
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
                  {feat.title}
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified On-Chain */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="glass-card p-6 sm:p-8 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none"
              style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
            />

            <div className="flex items-center gap-2 mb-5">
              <Fingerprint size={16} strokeWidth={1.5} className="text-emerald-400" />
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                Verified On-Chain
              </h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-[10px] font-medium text-emerald-400">
                <CheckCircle size={10} strokeWidth={2} />
                E2E Verified
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-5">
              Proofs generated in-browser using noir_js + bb.js WASM. Secrets never leave your device.
              The Garaga verifier validates each UltraKeccakZKHonk proof on-chain. Verify the contracts:
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Shield size={12} strokeWidth={1.5} />
                Pool Contract
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a
                href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/20 transition-colors text-[11px] font-medium text-emerald-400"
              >
                <Fingerprint size={12} strokeWidth={1.5} />
                Garaga ZK Verifier
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Technology Stack
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {[
                "Cairo 2.15",
                "Starknet",
                "Noir ZK",
                "Garaga",
                "Barretenberg",
                "Pedersen Hash",
                "Poseidon BN254",
                "Merkle Trees",
                "AVNU DEX",
                "Next.js",
                "sats-connect",
                "snforge",
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[var(--text-primary)] mb-4">
            Privacy is an institutional priority.
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
            Starknet is the Bitcoin DeFi layer. This is treasury-grade infrastructure.
          </p>
          <Link href="/app">
            <motion.button
              className="px-8 py-4 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 mx-auto"
              whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
            >
              <Shield size={16} strokeWidth={1.5} />
              Open Terminal
              <ArrowRight size={14} strokeWidth={2} />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4">
        <div className="h-px bg-[var(--border-subtle)] max-w-lg mx-auto mb-8" />
        <div className="flex items-center justify-center gap-4 mb-2">
          {["Built on Starknet", "STARK-Verified ZK Proofs", "Bitcoin-Native Liquidity"].map((item) => (
            <span key={item} className="text-[10px] text-[var(--text-quaternary)] font-medium">
              {item}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] tracking-widest uppercase">
          Veil Protocol &middot; Confidential Bitcoin Accumulation Infrastructure
        </p>
        <p className="text-[10px] text-[var(--text-quaternary)] mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin
        </p>
      </footer>
    </div>
  );
}
