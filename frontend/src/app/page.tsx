"use client";

import { useState, useEffect } from "react";
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

// ── Typewriter Effect ──
function TypewriterText({ text, delay = 900, speed = 40 }: { text: string; delay?: number; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setShowCursor(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [text, delay, speed]);

  return (
    <span>
      {displayed}
      {showCursor && <span className={`typewriter-cursor ${done ? "" : ""}`}>|</span>}
    </span>
  );
}

// ── Floating Particle Orbs ──
const ORBS = [
  { size: 4, color: "rgba(255,90,0,0.6)", x: "15%", y: "20%", dur: 6, delay: 0, shadow: "0 0 12px rgba(255,90,0,0.3)" },
  { size: 3, color: "rgba(167,139,250,0.5)", x: "80%", y: "15%", dur: 7, delay: 1.5, shadow: "0 0 10px rgba(167,139,250,0.25)" },
  { size: 5, color: "rgba(52,211,153,0.5)", x: "70%", y: "70%", dur: 5.5, delay: 0.8, shadow: "0 0 14px rgba(52,211,153,0.3)" },
  { size: 3, color: "rgba(255,90,0,0.4)", x: "25%", y: "75%", dur: 8, delay: 2, shadow: "0 0 10px rgba(255,90,0,0.2)" },
  { size: 6, color: "rgba(167,139,250,0.4)", x: "50%", y: "40%", dur: 6.5, delay: 0.5, shadow: "0 0 16px rgba(167,139,250,0.2)" },
  { size: 4, color: "rgba(52,211,153,0.4)", x: "90%", y: "50%", dur: 7.5, delay: 3, shadow: "0 0 12px rgba(52,211,153,0.2)" },
  { size: 3, color: "rgba(255,90,0,0.3)", x: "40%", y: "85%", dur: 5, delay: 1, shadow: "0 0 8px rgba(255,90,0,0.15)" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08080C] overflow-hidden relative">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 pointer-events-none animated-mesh-bg" />

      {/* Floating particle orbs */}
      <div className="fixed inset-0 pointer-events-none">
        {ORBS.map((orb, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: orb.size,
              height: orb.size,
              backgroundColor: orb.color,
              left: orb.x,
              top: orb.y,
              boxShadow: orb.shadow,
              animationDuration: `${orb.dur}s`,
              animationDelay: `${orb.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 bg-[#08080C]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-[#FAFAFA]">
            Veil<span className="text-[#FF5A00]"> Protocol</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://theveilprotocol-docs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
            >
              Docs
            </a>
            <Link href="/app">
              <motion.button
                className="btn-shimmer px-5 py-2.5 bg-[#FF5A00] text-white rounded-full text-[13px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 shadow-[0_0_20px_rgba(255,90,0,0.2)]"
                whileHover={{ y: -1, boxShadow: "0 0 30px rgba(255, 90, 0, 0.35)" }}
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
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6 backdrop-blur-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                <span className="text-xs text-[#A1A1AA] font-medium">Live on Starknet</span>
              </span>
              <span className="w-px h-3 bg-white/10" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-[#34D399]" />
                <span className="text-xs text-[#34D399] font-medium">STARK-Verified</span>
              </span>
              <span className="w-px h-3 bg-white/10" />
              <span className="inline-flex items-center gap-1.5">
                <Bitcoin size={10} strokeWidth={2} className="text-[#FF5A00]" />
                <span className="text-xs text-[#FF5A00] font-medium">BTC Settlement</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[32px] sm:text-[56px] font-black tracking-tight text-[#FAFAFA] leading-[1.08] mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Confidential Bitcoin
            </motion.span>
            <br />
            <span className="text-[#FF5A00] drop-shadow-[0_0_30px_rgba(255,90,0,0.3)]">
              <TypewriterText text="Accumulation Infrastructure" delay={900} speed={40} />
            </span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-[#A1A1AA] max-w-xl mx-auto mb-4 leading-relaxed"
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
            <span className="text-[12px] text-[#52525B]">No public order book exposure</span>
            <span className="w-1 h-1 rounded-full bg-[#3F3F46]" />
            <span className="text-[12px] text-[#52525B]">No on-chain position signaling</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="/app">
              <motion.button
                className="btn-shimmer px-8 py-4 bg-[#FF5A00] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 shadow-[0_0_40px_rgba(255,90,0,0.25)]"
                whileHover={{ y: -2, boxShadow: "0 0 60px rgba(255, 90, 0, 0.4)" }}
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
              className="px-6 py-4 text-[#A1A1AA] hover:text-[#FAFAFA] text-[15px] font-medium transition-colors"
            >
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* The Problem — slide from LEFT */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.04)_0%,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={16} strokeWidth={1.5} className="text-[#EF4444]" />
                <h2 className="text-[15px] font-bold text-[#FAFAFA]">The Problem</h2>
              </div>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed mb-6">
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
                    <div className="text-xs font-[family-name:var(--font-geist-mono)] text-[#EF4444]/40 mb-1">0{i + 1}</div>
                    <h3 className="text-[13px] font-semibold text-[#FAFAFA] mb-1.5">{item.title}</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution — slide from RIGHT */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.04)_0%,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <Shield size={16} strokeWidth={1.5} className="text-[#34D399]" />
                <h2 className="text-[15px] font-bold text-[#FAFAFA]">The Solution</h2>
              </div>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed mb-4">
                Confidential tranche-based accumulation using STARK proofs. Capital enters standardized privacy pools. Batch execution hides individual intent. Zero-knowledge proofs enable unlinkable exits.
              </p>
              <p className="text-[12px] text-[#52525B] leading-relaxed">
                Built natively on Starknet&apos;s Cairo VM with Garaga on-chain ZK verification. No trusted setup. No off-chain dependencies for proof validity. The first treasury-grade Bitcoin accumulation layer built on quantum-secure STARK infrastructure.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works — scale-in cards */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-[#52525B]">
              Protocol Flow
            </span>
            <h2 className="text-[20px] sm:text-[28px] font-black tracking-tight text-[#FAFAFA] mt-3">
              Four Phases of Confidential Accumulation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                title: "Allocate",
                desc: "Deposit USDC into standardized tranches ($1/$10/$100). A Pedersen commitment conceals your identity. Optional Bitcoin wallet attestation.",
                color: "#FF5A00",
                glow: "rgba(255,90,0,0.06)",
              },
              {
                icon: Layers,
                title: "Batch Execute",
                desc: "All deposits aggregate into a single USDC-to-BTC conversion via AVNU. Individual intent is hidden within the batch.",
                color: "#34D399",
                glow: "rgba(52,211,153,0.06)",
              },
              {
                icon: Fingerprint,
                title: "Verify",
                desc: "Zero-knowledge proof generated entirely in-browser via Noir circuits. Garaga verifier validates on-chain. Secrets never leave your device.",
                color: "#A78BFA",
                glow: "rgba(167,139,250,0.06)",
              },
              {
                icon: Eye,
                title: "Exit",
                desc: "Claim BTC on Starknet or settle to native Bitcoin via intent bridge. No cryptographic link to the original allocation.",
                color: "#FAFAFA",
                glow: "rgba(255,255,255,0.03)",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-5 text-center relative overflow-hidden"
                style={{ perspective: 800 }}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ rotateX: -5, rotateY: 5, boxShadow: `0 8px 30px ${step.glow}` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(ellipse at top, ${step.glow} 0%, transparent 70%)` }}
                />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                    <step.icon size={18} strokeWidth={1.5} style={{ color: step.color }} />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[#52525B] font-tabular">
                      0{i + 1}
                    </span>
                    <h3 className="text-[14px] font-bold text-[#FAFAFA]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Starknet */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,90,0,0.04)_0%,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <Server size={16} strokeWidth={1.5} className="text-[#FF5A00]" />
                <h2 className="text-[15px] font-bold text-[#FAFAFA]">Why Starknet</h2>
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
                    <div className="text-xs font-[family-name:var(--font-geist-mono)] text-[#FF5A00]/40 mb-1">0{i + 1}</div>
                    <h3 className="text-[13px] font-semibold text-[#FAFAFA] mb-1.5">{item.title}</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Technical Architecture + Animated ZK Pipeline */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold text-[#52525B]">
              Technical Architecture
            </span>
          </div>
          <motion.div
            className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-[#16161E] border border-[#FF5A00]/10 p-4">
                <div className="text-xs font-semibold text-[#FF5A00] mb-3">Client</div>
                <div className="space-y-2">
                  {["noir_js witness generation", "bb.js proof generation", "Poseidon BN254 commitments", "Starknet + BTC wallets"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#FF5A00]" />
                      <span className="text-xs text-[#A1A1AA]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#16161E] border border-[#34D399]/10 p-4">
                <div className="text-xs font-semibold text-[#34D399] mb-3">On-Chain (Cairo)</div>
                <div className="space-y-2">
                  {["Pedersen commitment scheme", "Garaga UltraKeccakZKHonk verifier", "Merkle tree (depth 20)", "Intent escrow + oracle settlement"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#34D399]" />
                      <span className="text-xs text-[#A1A1AA]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#16161E] border border-white/[0.06] p-4">
                <div className="text-xs font-semibold text-[#A1A1AA] mb-3">Infrastructure</div>
                <div className="space-y-2">
                  {["AVNU DEX aggregation", "Gasless relayer abstraction", "Compliance view keys", "Bitcoin intent bridge"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#52525B]" />
                      <span className="text-xs text-[#A1A1AA]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Animated ZK Pipeline */}
            <div className="rounded-xl bg-[#34D399]/[0.06] border border-[#34D399]/15 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Fingerprint size={12} strokeWidth={1.5} className="text-[#34D399]" />
                <span className="text-xs font-semibold text-[#34D399]">ZK Proof Pipeline</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Noir Circuit", sub: "Poseidon BN254" },
                  { label: "noir_js", sub: "Witness (browser)" },
                  { label: "bb.js", sub: "Proof (browser)" },
                  { label: "Garaga", sub: "~2835 felt252" },
                  { label: "On-Chain", sub: "STARK verified" },
                ].map((step, i) => (
                  <motion.div
                    key={step.label}
                    className="flex items-center"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                  >
                    <div className="flex-1 rounded-lg bg-[#34D399]/[0.06] border border-[#34D399]/15 p-2 text-center">
                      <div className="text-xs font-semibold text-[#34D399]">{step.label}</div>
                      <div className="text-[11px] text-[#34D399]/50">{step.sub}</div>
                    </div>
                    {i < 4 && (
                      <div className="hidden sm:flex items-center px-1 flex-shrink-0">
                        <svg width="16" height="8" viewBox="0 0 16 8" className="overflow-visible">
                          <line
                            x1="0" y1="4" x2="16" y2="4"
                            stroke="rgba(52,211,153,0.4)"
                            strokeWidth="1.5"
                            strokeDasharray="1000"
                            className="animate-circuit-trace"
                          />
                          <motion.circle
                            cx="0"
                            cy="4"
                            r="2"
                            fill="#34D399"
                            initial={{ cx: 0 }}
                            whileInView={{ cx: [0, 16] }}
                            viewport={{ once: true }}
                            transition={{
                              duration: 1.5,
                              delay: i * 0.3 + 0.5,
                              ease: "easeInOut",
                              repeat: Infinity,
                              repeatDelay: 2,
                            }}
                          />
                        </svg>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Privacy Guarantees — 3D tilts + staggered */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-[#52525B]">
              Security Properties
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Building2,
                title: "Standardized Tranches",
                desc: "Fixed denominations create uniform anonymity sets. No amount-based correlation attacks.",
                color: "#FF5A00",
              },
              {
                icon: Lock,
                title: "MEV Protection",
                desc: "Individual orders hidden in batch execution. No front-running or sandwich extraction.",
                color: "#34D399",
              },
              {
                icon: ShieldCheck,
                title: "Compliance Ready",
                desc: "Optional view keys prove transaction history to auditors without breaking pool confidentiality.",
                color: "#A78BFA",
              },
              {
                icon: TrendingUp,
                title: "Best Execution",
                desc: "AVNU DEX aggregation across all Starknet liquidity sources. Optimal routing guaranteed.",
                color: "#FF5A00",
              },
              {
                icon: Bitcoin,
                title: "Native BTC Settlement",
                desc: "Intent-based Bitcoin bridge. Lock, solve, confirm. Trustless cross-chain settlement.",
                color: "#F59E0B",
              },
              {
                icon: Fingerprint,
                title: "On-Chain Verification",
                desc: "Noir circuits + Garaga verifier. Browser-generated proofs validated on-chain. No trusted server.",
                color: "#34D399",
              },
              {
                icon: Zap,
                title: "Gasless Withdrawal",
                desc: "Relayer-abstracted exits. No gas token required. Maximum operational privacy.",
                color: "#A78BFA",
              },
              {
                icon: Eye,
                title: "Timing Protection",
                desc: "Mandatory delay between batch and withdrawal prevents deposit-exit correlation attacks.",
                color: "#FAFAFA",
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-2xl bg-[#0F0F14] border border-white/[0.06] hover:border-white/[0.12] transition-colors relative overflow-hidden group"
                style={{ perspective: 800 }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{
                  rotateX: -5,
                  rotateY: 5,
                  boxShadow: `0 8px 30px ${feat.color}15`,
                }}
              >
                <feat.icon size={16} strokeWidth={1.5} style={{ color: feat.color }} className="mb-3" />
                <h4 className="text-[13px] font-semibold text-[#FAFAFA] mb-1">
                  {feat.title}
                </h4>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified On-Chain */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-8 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.04)_0%,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <Fingerprint size={16} strokeWidth={1.5} className="text-[#34D399]" />
                <h3 className="text-[15px] font-bold text-[#FAFAFA]">
                  Verified On-Chain
                </h3>
                <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-xs font-medium text-[#34D399]">
                  <CheckCircle size={10} strokeWidth={2} />
                  E2E Verified
                </span>
              </div>

              <p className="text-xs text-[#A1A1AA] leading-relaxed mb-5">
                Proofs generated in-browser using noir_js + bb.js WASM. Secrets never leave your device.
                The Garaga verifier validates each UltraKeccakZKHonk proof on-chain. Verify the contracts:
              </p>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA]"
                >
                  <Shield size={12} strokeWidth={1.5} />
                  Pool Contract
                  <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
                </a>
                <a
                  href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#34D399]/10 hover:bg-[#34D399]/15 border border-[#34D399]/20 transition-colors text-xs font-medium text-[#34D399]"
                >
                  <Fingerprint size={12} strokeWidth={1.5} />
                  Garaga ZK Verifier
                  <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack — random pop-in */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0F0F14] p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold text-[#52525B]">
                Technology Stack
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
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
              ].map((tech, i) => (
                <motion.span
                  key={tech}
                  className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[#A1A1AA] px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: Math.random() * 0.4 + i * 0.03 }}
                >
                  {tech}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32 relative">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[#FAFAFA] mb-4">
            Privacy is an institutional priority.
          </h2>
          <p className="text-[14px] text-[#A1A1AA] mb-8 max-w-lg mx-auto">
            Starknet is the Bitcoin DeFi layer. This is treasury-grade infrastructure.
          </p>
          <Link href="/app">
            <motion.button
              className="btn-shimmer px-8 py-4 bg-[#FF5A00] text-white rounded-2xl text-[15px] font-semibold tracking-tight cursor-pointer flex items-center gap-2 mx-auto shadow-[0_0_40px_rgba(255,90,0,0.25)]"
              whileHover={{ y: -2, boxShadow: "0 0 60px rgba(255, 90, 0, 0.4)" }}
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
      <footer className="text-center pb-10 px-4 relative">
        <div className="h-px bg-white/[0.06] max-w-lg mx-auto mb-8" />
        <div className="flex items-center justify-center gap-4 mb-2">
          {["Built on Starknet", "STARK-Verified ZK Proofs", "Bitcoin-Native Liquidity"].map((item) => (
            <span key={item} className="text-xs text-[#3F3F46] font-medium">
              {item}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#3F3F46]">
          Veil Protocol &middot; Confidential Bitcoin Accumulation Infrastructure
        </p>
        <p className="text-xs text-[#3F3F46] mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin
        </p>
      </footer>
    </div>
  );
}
