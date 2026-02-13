"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Eye, Layers, Lock, Users, Zap, Bitcoin, ArrowRight, Clock, ShieldCheck, Fingerprint, ExternalLink, CheckCircle } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const steps = [
  {
    icon: Shield,
    title: "Shield",
    desc: "Deposit a fixed USDC denomination. A Pedersen commitment hides your identity. Your Bitcoin wallet signs the commitment hash.",
    color: "var(--accent-orange)",
  },
  {
    icon: Layers,
    title: "Batch",
    desc: "A keeper aggregates all deposits into a single USDC-to-WBTC swap. Individual intent is hidden within the batch.",
    color: "var(--accent-green)",
  },
  {
    icon: Eye,
    title: "Unveil",
    desc: "A zero-knowledge proof verifies your deposit without revealing secrets. Withdraw WBTC to any address, optionally via a gasless relayer.",
    color: "var(--text-primary)",
  },
];

const features = [
  {
    icon: Lock,
    title: "Deposit Unlinkability",
    desc: "Fixed denominations make all deposits in a tier indistinguishable.",
  },
  {
    icon: Users,
    title: "Anonymity Sets",
    desc: "Your deposit hides among others. More users = exponentially stronger privacy.",
  },
  {
    icon: Zap,
    title: "Gasless Withdrawals",
    desc: "Relayer-powered withdrawals eliminate gas-based deanonymization.",
  },
  {
    icon: Clock,
    title: "Timing Protection",
    desc: "60-second minimum delay blocks deposit-and-immediately-withdraw attacks.",
  },
  {
    icon: Bitcoin,
    title: "Bitcoin Identity Binding",
    desc: "BTC wallet cryptographically signs each deposit commitment on-chain.",
  },
  {
    icon: Fingerprint,
    title: "Zero-Knowledge Proofs",
    desc: "Noir ZK circuits + Garaga on-chain verifier. Secrets never appear in calldata.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Escape Hatch",
    desc: "Optional view keys let users prove transaction history to regulators.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Ghost<span className="text-[var(--accent-orange)]">Sats</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://ghostsats-docs.vercel.app"
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
                Launch App
                <ArrowRight size={14} strokeWidth={2} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-32 px-4 sm:px-6">
        {/* Gradient orb */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,90,0,0.3) 0%, rgba(255,90,0,0) 70%)",
          }}
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
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">Live on Starknet Sepolia</span>
              </span>
              <span className="w-px h-3 bg-[var(--border-subtle)]" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">ZK Proofs Verified On-Chain</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[36px] sm:text-[56px] font-black tracking-tight text-[var(--text-primary)] leading-[1.1] mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            Bitcoin&apos;s
            <br />
            <span className="text-[var(--accent-orange)]">Privacy Layer</span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            Private USDC-to-WBTC execution on Starknet. Real ZK proofs verified on-chain by Garaga. Secrets never touch calldata. Gasless withdrawals break every link.
          </motion.p>

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
                Start Shielding
              </motion.button>
            </Link>
            <a
              href="https://github.com/shariqazeem/ghostsats"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[15px] font-medium transition-colors"
            >
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              How It Works
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="glass-card p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={20} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
                    0{i + 1}
                  </span>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Privacy Guarantees
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <feat.icon size={16} strokeWidth={1.5} className="text-[var(--text-tertiary)] mb-3" />
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

      {/* Verified On-Chain — The Differentiator */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Verified On-Chain
            </span>
          </div>

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
                Real ZK Proof Verification
              </h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-[10px] font-medium text-emerald-400">
                <CheckCircle size={10} strokeWidth={2} />
                E2E Verified
              </span>
            </div>

            {/* ZK Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-0 mb-6">
              {[
                { label: "Noir Circuit", sub: "Poseidon BN254", icon: "01" },
                { label: "nargo execute", sub: "Witness gen", icon: "02" },
                { label: "bb prove", sub: "UltraKeccakZKHonk", icon: "03" },
                { label: "garaga calldata", sub: "2835 felt252 values", icon: "04" },
                { label: "On-Chain Verify", sub: "Garaga Verifier", icon: "05" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-800/20 p-2.5 text-center">
                    <div className="text-[9px] font-[family-name:var(--font-geist-mono)] text-emerald-400/40 mb-0.5">{step.icon}</div>
                    <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400">{step.label}</div>
                    <div className="text-[9px] text-emerald-400/50">{step.sub}</div>
                  </div>
                  {i < 4 && (
                    <span className="hidden sm:block text-[var(--text-quaternary)] text-[10px] px-1 flex-shrink-0">&rarr;</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-5">
              Not a mock. Not off-chain. Every withdrawal generates a real UltraKeccakZKHonk proof that the
              Garaga verifier validates on-chain. The proof (~2835 felt252 calldata elements) cryptographically
              proves deposit knowledge without revealing the secret or blinder. Verify it yourself:
            </p>

            {/* Contract Links */}
            <div className="flex flex-wrap gap-2">
              <a
                href="https://sepolia.starkscan.co/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Shield size={12} strokeWidth={1.5} />
                ShieldedPool on Starkscan
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a
                href="https://sepolia.starkscan.co/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/20 transition-colors text-[11px] font-medium text-emerald-400"
              >
                <Fingerprint size={12} strokeWidth={1.5} />
                Garaga ZK Verifier on Starkscan
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack Bar */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Built With
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
                "Avnu DEX",
                "Next.js 16",
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
            Privacy is not optional.
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
            Every deposit strengthens the anonymity set for everyone. Join the privacy pool.
          </p>
          <Link href="/app">
            <motion.button
              className="px-8 py-4 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 mx-auto"
              whileHover={{ y: -2, boxShadow: "0 0 40px -5px rgba(255, 90, 0, 0.35)" }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
            >
              <Shield size={16} strokeWidth={1.5} />
              Launch App
              <ArrowRight size={14} strokeWidth={2} />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4">
        <div className="h-px bg-[var(--border-subtle)] max-w-lg mx-auto mb-8" />
        <p className="text-[11px] text-[var(--text-tertiary)] tracking-widest uppercase">
          GhostSats &middot; Re&#123;define&#125; Hackathon 2026
        </p>
        <p className="text-[10px] text-[var(--text-quaternary)] mt-1">
          ZK Proofs &middot; Pedersen Commitments &middot; Merkle Proofs &middot; Nullifier Set &middot; Bitcoin Identity
        </p>
      </footer>
    </div>
  );
}
