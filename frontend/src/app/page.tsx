"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
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
  CreditCard,
  Bot,
  Wallet,
  Eye,
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

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setShowCursor(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
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
                Launch App
                <ArrowRight size={14} strokeWidth={2} />
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO — The new narrative: AI + x402 + Privacy      */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-28 px-4 sm:px-6">
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
                <span className="text-xs text-gray-600 font-medium">Starknet Mainnet</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <Brain size={10} strokeWidth={2} className="text-violet-600" />
                <span className="text-xs text-violet-600 font-medium">AI Strategist</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <CreditCard size={10} strokeWidth={2} className="text-amber-600" />
                <span className="text-xs text-amber-600 font-medium">x402 Payments</span>
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
            <span>AI-Powered Privacy</span>
            <br />
            <span className="text-gradient">
              <TypewriterText text="for Bitcoin on Starknet" delay={900} speed={45} />
            </span>
          </motion.h1>

          <motion.p
            className="text-[15px] sm:text-[18px] text-gray-500 max-w-xl mx-auto mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            An AI strategy agent plans your confidential BTC accumulation. ZK proofs verified on-chain via Garaga. Premium analytics gated by x402 micropayments. All on Starknet mainnet.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8"
          >
            <span className="text-[12px] text-gray-400">AI plans your strategy</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">x402 unlocks premium intel</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">ZK proofs hide everything</span>
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
                <Brain size={16} strokeWidth={1.5} />
                Launch App
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

      {/* ═══════════════════════════════════════════════════ */}
      {/* THREE PILLARS — AI + x402 + ZK Privacy              */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              icon: Brain, title: "AI Strategy Agent",
              desc: "Tell the AI what you want — \"$50 max privacy\" — and it plans optimal deposits across tiers, timing, and pool conditions. Five strategy modes from stealth DCA to whale distribution.",
              color: "#8B5CF6", bg: "from-violet-50 to-white", border: "border-violet-200",
              tag: "Intelligence",
            },
            {
              icon: CreditCard, title: "x402 Micropayments",
              desc: "Premium pool analytics, per-tier risk scoring, and BTC projections — gated behind HTTP 402 micropayments. Pay $0.01 USDC per analysis, settled on Starknet via AVNU paymaster.",
              color: "#F59E0B", bg: "from-amber-50 to-white", border: "border-amber-200",
              tag: "Monetization",
            },
            {
              icon: Fingerprint, title: "ZK Privacy Layer",
              desc: "Noir circuits generate proofs in-browser. Garaga verifies on-chain. Pedersen commitments for Merkle membership, Poseidon BN254 for ZK withdrawals. Secrets never leave your device.",
              color: "#10B981", bg: "from-emerald-50 to-white", border: "border-emerald-200",
              tag: "Cryptography",
            },
          ].map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`rounded-3xl border-2 ${pillar.border} bg-gradient-to-br ${pillar.bg} p-6 hover:shadow-xl transition-all`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${pillar.color}10`, border: `1px solid ${pillar.color}20` }}>
                  <pillar.icon size={18} strokeWidth={1.5} style={{ color: pillar.color }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ color: pillar.color, background: `${pillar.color}10` }}>
                  {pillar.tag}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                {pillar.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{pillar.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* x402 FLOW — The innovation story                    */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50/30 p-6 sm:p-10 shadow-sm hover:shadow-xl transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200">
                <CreditCard size={18} strokeWidth={1.5} className="text-amber-600" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>x402: Pay-Per-Insight Privacy Analytics</h2>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
              The first privacy protocol with native micropayment-gated AI intelligence. No subscriptions, no accounts — just HTTP 402.
            </p>

            {/* x402 Flow Visualization */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
              {[
                { step: "01", label: "Request", desc: "GET /api/agent/premium-strategy", icon: Server, color: "#6B7280" },
                { step: "02", label: "402 Response", desc: "Payment requirements returned", icon: CreditCard, color: "#F59E0B" },
                { step: "03", label: "Pay & Settle", desc: "$0.01 USDC via AVNU paymaster", icon: Wallet, color: "#8B5CF6" },
                { step: "04", label: "Premium Intel", desc: "Risk scores, timing, projections", icon: Sparkles, color: "#10B981" },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:shadow-md transition-all"
                >
                  <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <s.icon size={14} strokeWidth={1.5} style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-gray-300 block">{s.step}</span>
                  <span className="text-xs font-bold text-gray-900 block">{s.label}</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{s.desc}</span>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Pool Health Score", value: "A+" },
                { label: "Per-Tier Risk", value: "5 levels" },
                { label: "BTC Projections", value: "Live" },
                { label: "Optimal Timing", value: "Real-time" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                  <div className="text-sm font-bold text-amber-700" style={{ fontFamily: "'Inter Tight', sans-serif" }}>{item.value}</div>
                  <div className="text-[10px] text-amber-500 font-medium">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* AI STRATEGY ENGINE                                  */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-3xl border-2 border-violet-200 bg-gradient-to-br from-white to-violet-50/30 p-6 sm:p-10 shadow-sm hover:shadow-xl transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center border border-violet-200">
                <Brain size={18} strokeWidth={1.5} className="text-violet-600" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>AI Strategy Engine</h2>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                Natural Language
              </span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
              Tell the AI how you want to accumulate BTC. It analyzes live pool conditions, anonymity sets, BTC price, and timing — then generates an optimal strategy. One-click execution via connected wallet.
            </p>

            {/* Strategy modes */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
              {[
                { mode: "Privacy-First", desc: "Max anonymity set" },
                { mode: "Stealth DCA", desc: "Time-decorrelated" },
                { mode: "Whale Split", desc: "Large amount splitting" },
                { mode: "Efficiency", desc: "Least deposits" },
                { mode: "Balanced", desc: "Best of all" },
              ].map((s) => (
                <div key={s.mode} className="rounded-lg bg-violet-50 border border-violet-100 p-2.5 text-center">
                  <div className="text-[11px] font-bold text-violet-700">{s.mode}</div>
                  <div className="text-[10px] text-violet-400">{s.desc}</div>
                </div>
              ))}
            </div>

            {/* Example prompts */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-3">Natural Language Examples</span>
              <div className="flex flex-wrap gap-2">
                {[
                  "\"$50 max privacy\"",
                  "\"DCA $200 over 5 deposits\"",
                  "\"Spread $500 across all tiers\"",
                  "\"Quick $10 anonymous deposit\"",
                ].map((p) => (
                  <span key={p} className="text-xs font-mono text-gray-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PROTOCOL FLOW — How it works                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Protocol Flow</span>
            <h2 className="text-[22px] sm:text-[30px] font-black tracking-tight text-gray-900 mt-3" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              From Strategy to Confidential BTC Exit
            </h2>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3"
          >
            {[
              {
                icon: Brain, title: "Plan",
                desc: "AI analyzes pools, timing, and privacy scores to generate your optimal strategy.",
                color: "#8B5CF6", bg: "from-violet-50 to-white", border: "border-violet-100",
              },
              {
                icon: Shield, title: "Shield",
                desc: "Deposit USDC into fixed-denomination privacy pools. Pedersen + Poseidon commitments computed client-side.",
                color: "#7C3AED", bg: "from-purple-50 to-white", border: "border-purple-100",
              },
              {
                icon: Layers, title: "Batch",
                desc: "All deposits aggregate into one USDC-to-BTC swap via AVNU. Individual intent hidden within the batch.",
                color: "#10B981", bg: "from-emerald-50 to-white", border: "border-emerald-100",
              },
              {
                icon: Fingerprint, title: "Prove",
                desc: "ZK proof generated in-browser (noir_js + bb.js). Garaga verifies ~2,835 calldata elements on-chain.",
                color: "#06B6D4", bg: "from-cyan-50 to-white", border: "border-cyan-100",
              },
              {
                icon: Bitcoin, title: "Exit",
                desc: "Claim WBTC on Starknet or intent-based native BTC settlement via escrow-solver-oracle.",
                color: "#F59E0B", bg: "from-amber-50 to-white", border: "border-amber-100",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`rounded-2xl border-2 ${step.border} bg-gradient-to-br ${step.bg} p-4 text-center hover:shadow-xl transition-all`}
              >
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-sm"
                  style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={18} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-mono text-gray-300">0{i + 1}</span>
                  <h3 className="text-[13px] font-bold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* THE PROBLEM + SOLUTION — Context                    */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Problem */}
          <motion.div
            className="rounded-3xl border-2 border-red-100 bg-gradient-to-br from-white to-red-50/20 p-6 shadow-sm"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
                <Eye size={14} strokeWidth={1.5} className="text-red-500" />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900">The Problem</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Every Bitcoin purchase on DeFi is publicly visible. No AI guidance. No privacy. No way to accumulate BTC without signaling your strategy to the entire market.
            </p>
            <div className="space-y-2">
              {[
                "Strategy exposed to front-runners",
                "Transaction amounts create fingerprints",
                "No intelligent entry timing",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-red-400">
                  <span className="w-1 h-1 rounded-full bg-red-300" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Solution */}
          <motion.div
            className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20 p-6 shadow-sm"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
                <Shield size={14} strokeWidth={1.5} className="text-emerald-600" />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900">Veil Protocol</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              AI plans your strategy. ZK proofs hide your activity. x402 micropayments unlock premium analytics. Starknet&apos;s STARKs provide quantum-secure verification.
            </p>
            <div className="space-y-2">
              {[
                "AI optimizes privacy + timing",
                "Fixed tranches make deposits uniform",
                "Pay-per-insight analytics via x402",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-emerald-500">
                  <CheckCircle size={10} strokeWidth={2} />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ARCHITECTURE                                        */}
      {/* ═══════════════════════════════════════════════════ */}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              {[
                { title: "AI Layer", color: "violet", items: ["Natural language strategy", "5 optimization modes", "Live pool analytics", "x402 premium gate"] },
                { title: "Client (Browser)", color: "purple", items: ["noir_js witness gen", "bb.js proof gen (WASM)", "Poseidon BN254 commits", "Starknet + BTC wallets"] },
                { title: "On-Chain (Cairo)", color: "emerald", items: ["Pedersen commitments", "Garaga ZK verifier", "Merkle tree (depth 20)", "Intent escrow + oracle"] },
                { title: "Infrastructure", color: "amber", items: ["AVNU DEX aggregation", "x402 AVNU paymaster", "Gasless relayer (AA)", "Intent solver network"] },
              ].map((col) => (
                <div key={col.title} className={`rounded-xl bg-${col.color}-50 border border-${col.color}-100 p-4`}>
                  <div className={`text-xs font-bold text-${col.color}-600 mb-3`}>{col.title}</div>
                  <div className="space-y-2">
                    {col.items.map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className={`w-1 h-1 rounded-full bg-${col.color}-400`} />
                        <span className="text-xs text-gray-600">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ZK + x402 Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">ZK Proof Pipeline</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    "Noir Circuit → Poseidon BN254",
                    "noir_js → Witness (browser WASM)",
                    "bb.js → Proof (browser WASM)",
                    "Garaga → ~2,835 calldata felt252",
                    "Starknet → On-chain verification",
                  ].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 w-3">{i + 1}.</span>
                      <span className="text-[11px] text-emerald-700 font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <CreditCard size={12} strokeWidth={1.5} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">x402 Payment Flow</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    "Client → GET premium-strategy",
                    "Server → 402 Payment Required",
                    "Client → Sign via AVNU paymaster",
                    "Server → Verify + settle on-chain",
                    "Server → Return premium analysis",
                  ].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-amber-400 w-3">{i + 1}.</span>
                      <span className="text-[11px] text-amber-700 font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECURITY PROPERTIES                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">What Sets Us Apart</span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              { icon: Brain, title: "AI-Planned Privacy", desc: "Strategy engine picks optimal tiers, timing, and pool conditions for maximum anonymity.", color: "#8B5CF6" },
              { icon: CreditCard, title: "x402 Micropayments", desc: "HTTP 402-native premium APIs. $0.01 per analysis, settled on-chain via AVNU paymaster.", color: "#F59E0B" },
              { icon: Fingerprint, title: "On-Chain ZK Proofs", desc: "Real Noir circuits verified by Garaga. Browser-generated proofs. No mock, no backend trust.", color: "#10B981" },
              { icon: Bitcoin, title: "Native BTC Settlement", desc: "Intent-based escrow. Solver delivers native BTC. Oracle confirms. Trustless cross-chain exit.", color: "#F59E0B" },
              { icon: Building2, title: "Standardized Tranches", desc: "$1, $10, $100, $1,000. Fixed denominations create uniform anonymity sets.", color: "#7C3AED" },
              { icon: Lock, title: "MEV Protection", desc: "Individual orders hidden within batch execution. No mempool exposure.", color: "#10B981" },
              { icon: ShieldCheck, title: "Compliance Ready", desc: "Optional view keys for regulators. Prove your deposits without compromising others.", color: "#8B5CF6" },
              { icon: Bot, title: "Telegram Strategy Bot", desc: "@VeilProtocolBot plans strategies in chat, links to web app for self-custody execution.", color: "#06B6D4" },
            ].map((feat) => (
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

      {/* ═══════════════════════════════════════════════════ */}
      {/* VERIFIED ON-CHAIN                                   */}
      {/* ═══════════════════════════════════════════════════ */}
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
              <h3 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>Deployed on Starknet Mainnet</h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                <CheckCircle size={10} strokeWidth={2} />
                Production
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              Real USDC, real WBTC, real AVNU integration, real Garaga ZK verification. Not a testnet demo — production infrastructure handling real assets with AI strategy and x402 payments.
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
                "x402-starknet", "AVNU Paymaster", "Pedersen Hash", "Poseidon BN254",
                "Merkle Trees", "Next.js", "sats-connect", "snforge", "52 Cairo Tests",
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
            AI-powered. Privacy-first. Pay-per-use.
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-lg mx-auto">
            The first protocol combining AI strategy agents, ZK privacy, and x402 micropayments on Starknet. Built for the Re&#123;define&#125; Hackathon.
          </p>
          <Link href="/app">
            <motion.button
              className="btn-shimmer px-8 py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-bold tracking-tight cursor-pointer flex items-center gap-2 mx-auto shadow-xl"
              whileHover={{ y: -2, boxShadow: "0 20px 60px -12px rgba(0, 0, 0, 0.25)" }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
            >
              <Brain size={16} strokeWidth={1.5} />
              Launch App
              <ArrowRight size={14} strokeWidth={2} />
            </motion.button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4 relative">
        <div className="h-px bg-gray-200 max-w-lg mx-auto mb-8" />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-2">
          {["AI Strategy Agent", "x402 Micropayments", "ZK Privacy", "Bitcoin Settlement", "Starknet Mainnet"].map((item) => (
            <span key={item} className="text-xs text-gray-400 font-medium">{item}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Veil Protocol &middot; AI + x402 + Privacy on Starknet
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin + x402 Tracks
        </p>
      </footer>
    </div>
  );
}
