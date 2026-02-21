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
  Brain,
  Sparkles,
} from "lucide-react";
import addresses from "@/contracts/addresses.json";
import { EXPLORER_CONTRACT } from "@/utils/network";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ── Typewriter ──
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
      {showCursor && <span className="typewriter-cursor">|</span>}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden relative">
      {/* Animated mesh gradient background */}
      <div className="fixed inset-0 pointer-events-none animated-mesh-bg" />
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-40" />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 bg-white/90 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            Veil<span className="text-violet-600"> Protocol</span>
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://theveilprotocol-docs.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Docs
            </a>
            <Link href="/app">
              <motion.button
                className="btn-shimmer px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold tracking-tight cursor-pointer flex items-center gap-2 shadow-lg"
                whileHover={{ y: -1, boxShadow: "0 20px 40px -8px rgba(0,0,0,0.2)" }}
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
        {/* Animated mesh orbs */}
        <motion.div
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 opacity-80"
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-100 border border-gray-200 mb-6">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-600 font-medium">Live on Mainnet</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={10} strokeWidth={2} className="text-emerald-600" />
                <span className="text-xs text-emerald-600 font-medium">STARK-Verified</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={10} strokeWidth={2} className="text-violet-600" />
                <span className="text-xs text-violet-600 font-medium">x402 Payments</span>
              </span>
            </div>
          </motion.div>

          <motion.h1
            className="text-[36px] sm:text-[64px] font-black tracking-tight text-gray-900 leading-[1.05] mb-5"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <span>Confidential Bitcoin</span>
            <br />
            <span className="text-gradient">
              <TypewriterText text="Accumulation Infrastructure" delay={900} speed={40} />
            </span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-gray-500 max-w-xl mx-auto mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Shield USDC. Batch-convert to BTC. Exit to native Bitcoin via intent settlement. All verified by zero-knowledge proofs on Starknet mainnet.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8"
          >
            <span className="text-[12px] text-gray-400">No public order book exposure</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">No on-chain position signaling</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="/app">
              <motion.button
                className="btn-shimmer px-8 py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-bold tracking-tight cursor-pointer flex items-center gap-2 shadow-xl"
                whileHover={{ y: -2, boxShadow: "0 20px 60px -12px rgba(0, 0, 0, 0.25)" }}
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
              className="px-6 py-4 text-gray-500 hover:text-gray-900 text-[15px] font-medium transition-colors"
            >
              View Source
            </a>
          </motion.div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="px-4 sm:px-6 pb-16 relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { icon: "🔒", value: "ZK Verified", label: "On-Chain Proofs" },
            { icon: "🤖", value: "5 Strategies", label: "AI Engine" },
            { icon: "⚡", value: "$0.01", label: "x402 Micropayments" },
            { icon: "₿", value: "Intent-Based", label: "BTC Settlement" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="bg-white rounded-2xl p-5 border-2 border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all text-center"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-lg font-extrabold text-gray-900 mb-0.5" style={{ fontFamily: "'Inter Tight', sans-serif" }}>{stat.value}</div>
              <div className="text-xs font-medium text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* The Problem */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-gray-200 bg-white p-6 sm:p-10 shadow-sm hover:shadow-xl transition-all"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                <BarChart3 size={18} strokeWidth={1.5} className="text-red-500" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>The Problem</h2>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
              Public Bitcoin accumulation exposes treasury strategy. Every on-chain purchase signals intent to the market.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { title: "Strategy Leakage", desc: "On-chain buy orders reveal accumulation intent. Competitors front-run positions." },
                { title: "Position Correlation", desc: "Unique transaction amounts create fingerprints. Accumulation patterns are reconstructable." },
                { title: "MEV Extraction", desc: "Visible orders in the mempool enable sandwich attacks. Value extracted before settlement." },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-xs font-mono text-red-300 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 p-6 sm:p-10 shadow-sm hover:shadow-xl transition-all"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                <Shield size={18} strokeWidth={1.5} className="text-emerald-600" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>The Solution</h2>
            </div>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-3">
              Confidential tranche-based accumulation using STARK proofs. Capital enters standardized privacy pools. Batch execution hides individual intent. ZK proofs enable unlinkable exits.
            </p>
            <p className="text-[12px] text-gray-400 leading-relaxed">
              Built natively on Starknet&apos;s Cairo VM with Garaga on-chain ZK verification. No trusted setup. The first treasury-grade Bitcoin accumulation layer on quantum-secure STARK infrastructure.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Protocol Flow */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Protocol Flow</span>
            <h2 className="text-[22px] sm:text-[30px] font-black tracking-tight text-gray-900 mt-3" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Four Phases of Confidential Accumulation
            </h2>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4"
          >
            {[
              {
                icon: Shield, title: "Allocate",
                desc: "Deposit USDC into standardized tranches ($1/$10/$100). A Pedersen commitment conceals your identity.",
                color: "#7C3AED", bg: "from-violet-50 to-white", border: "border-violet-100",
              },
              {
                icon: Layers, title: "Batch Execute",
                desc: "All deposits aggregate into a single USDC-to-BTC conversion via AVNU. Individual intent is hidden.",
                color: "#10B981", bg: "from-emerald-50 to-white", border: "border-emerald-100",
              },
              {
                icon: Fingerprint, title: "Verify",
                desc: "ZK proof generated in-browser via Noir circuits. Garaga verifier validates on-chain. Secrets stay on your device.",
                color: "#8B5CF6", bg: "from-purple-50 to-white", border: "border-purple-100",
              },
              {
                icon: Bitcoin, title: "BTC Exit",
                desc: "Intent settlement: lock escrow, solver sends native BTC, oracle confirms. Trustless cross-chain exit.",
                color: "#F59E0B", bg: "from-amber-50 to-white", border: "border-amber-100",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`rounded-2xl border-2 ${step.border} bg-gradient-to-br ${step.bg} p-5 text-center hover:shadow-xl transition-all`}
              >
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-sm"
                  style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={20} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs font-mono text-gray-300">0{i + 1}</span>
                  <h3 className="text-[14px] font-bold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why Starknet */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-gray-200 bg-white p-6 sm:p-10 shadow-sm hover:shadow-lg transition-all"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
                <Server size={18} strokeWidth={1.5} className="text-gray-700" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>Why Starknet</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { title: "Quantum-Secure STARKs", desc: "No trusted setup, quantum-resistant. Future-proof cryptographic guarantees." },
                { title: "Cairo-Native", desc: "Entire protocol built in Cairo. Pedersen, Merkle trees, batch execution — all native." },
                { title: "Bitcoin DeFi Layer", desc: "Intent-based settlement with escrow, solver, oracle. AVNU aggregation. Gasless via AA." },
              ].map((item, i) => (
                <div key={item.title}>
                  <div className="text-xs font-mono text-gray-300 mb-1">0{i + 1}</div>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Technical Architecture</span>
          </div>
          <motion.div
            className="rounded-3xl border-2 border-gray-200 bg-white p-6 sm:p-8 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { title: "Client", color: "violet", items: ["noir_js witness generation", "bb.js proof generation", "Poseidon BN254 commitments", "Starknet + BTC wallets"] },
                { title: "On-Chain (Cairo)", color: "emerald", items: ["Pedersen commitment scheme", "Garaga UltraKeccakZKHonk", "Merkle tree (depth 20)", "Intent escrow + oracle"] },
                { title: "Infrastructure", color: "gray", items: ["AVNU DEX aggregation", "Gasless relayer abstraction", "Intent escrow + solver", "x402 micropayment protocol"] },
              ].map((col) => (
                <div key={col.title} className={`rounded-xl bg-${col.color === "gray" ? "gray" : col.color}-50 border border-${col.color === "gray" ? "gray" : col.color}-100 p-4`}>
                  <div className={`text-xs font-bold text-${col.color === "gray" ? "gray-600" : col.color + "-600"} mb-3`}>{col.title}</div>
                  <div className="space-y-2">
                    {col.items.map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className={`w-1 h-1 rounded-full bg-${col.color === "gray" ? "gray-400" : col.color + "-500"}`} />
                        <span className="text-xs text-gray-600">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ZK Pipeline */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">ZK Proof Pipeline</span>
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
                    <div className="flex-1 rounded-lg bg-white border border-emerald-200 p-2 text-center shadow-sm">
                      <div className="text-xs font-bold text-emerald-700">{step.label}</div>
                      <div className="text-[10px] text-emerald-500">{step.sub}</div>
                    </div>
                    {i < 4 && (
                      <div className="hidden sm:flex items-center px-1 flex-shrink-0">
                        <ArrowRight size={12} strokeWidth={2} className="text-emerald-300" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Security Properties */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Security Properties</span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              { icon: Building2, title: "Standardized Tranches", desc: "Fixed denominations create uniform anonymity sets.", color: "#7C3AED" },
              { icon: Lock, title: "MEV Protection", desc: "Individual orders hidden in batch execution.", color: "#10B981" },
              { icon: ShieldCheck, title: "Compliance Ready", desc: "Optional view keys for auditors.", color: "#8B5CF6" },
              { icon: TrendingUp, title: "Best Execution", desc: "AVNU aggregation across all Starknet liquidity.", color: "#7C3AED" },
              { icon: Bitcoin, title: "Native BTC Settlement", desc: "Lock-solve-confirm escrow. Trustless cross-chain.", color: "#F59E0B" },
              { icon: Fingerprint, title: "On-Chain Verification", desc: "Noir + Garaga. Browser proofs validated on-chain.", color: "#10B981" },
              { icon: Brain, title: "AI Strategy Engine", desc: "5 strategy modes with live pool analytics.", color: "#8B5CF6" },
              { icon: Sparkles, title: "x402 Micropayments", desc: "HTTP 402-native premium APIs via AVNU paymaster.", color: "#06B6D4" },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                  style={{ background: `${feat.color}08`, border: `1px solid ${feat.color}15` }}>
                  <feat.icon size={18} strokeWidth={1.5} style={{ color: feat.color }} />
                </div>
                <h4 className="text-[13px] font-bold text-gray-900 mb-1">{feat.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Verified On-Chain */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20 p-6 sm:p-8 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Fingerprint size={16} strokeWidth={1.5} className="text-emerald-600" />
              <h3 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>Verified On-Chain</h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                <CheckCircle size={10} strokeWidth={2} />
                E2E Verified
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              Deployed on Starknet mainnet with real USDC, WBTC, and AVNU integration. Proofs generated in-browser. Garaga verifier validates each proof on-chain.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 hover:text-gray-900 transition-all"
              >
                <Shield size={12} strokeWidth={1.5} />
                Pool Contract
                <ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a
                href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-700 transition-all"
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
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Technology Stack</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
              {[
                "Cairo 2.15", "Starknet", "Noir ZK", "Garaga", "Barretenberg",
                "Pedersen Hash", "Poseidon BN254", "Merkle Trees", "AVNU DEX",
                "x402-starknet", "Next.js", "sats-connect", "snforge",
              ].map((tech, i) => (
                <motion.span
                  key={tech}
                  className="text-[12px] font-mono font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-default"
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
          <h2 className="text-[24px] sm:text-[36px] font-black tracking-tight text-gray-900 mb-4" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
            Privacy is an institutional priority.
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-lg mx-auto">
            Starknet is the Bitcoin DeFi layer. This is treasury-grade infrastructure.
          </p>
          <Link href="/app">
            <motion.button
              className="btn-shimmer px-8 py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-bold tracking-tight cursor-pointer flex items-center gap-2 mx-auto shadow-xl"
              whileHover={{ y: -2, boxShadow: "0 20px 60px -12px rgba(0, 0, 0, 0.25)" }}
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
        <div className="h-px bg-gray-200 max-w-lg mx-auto mb-8" />
        <div className="flex items-center justify-center gap-4 mb-2">
          {["Built on Starknet", "STARK-Verified ZK", "x402 Micropayments", "Bitcoin-Native"].map((item) => (
            <span key={item} className="text-xs text-gray-400 font-medium">{item}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Veil Protocol &middot; Confidential Bitcoin Accumulation Infrastructure
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin
        </p>
      </footer>
    </div>
  );
}
