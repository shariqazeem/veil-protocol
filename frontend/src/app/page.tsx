import Link from "next/link";
import {
  Shield,
  Layers,
  Lock,
  Bitcoin,
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ExternalLink,
  CheckCircle,
  Building2,
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
import { HeroAnimations } from "@/components/LandingAnimations";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none animated-mesh-bg" />
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-40" />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 bg-white/90 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Veil Protocol" width={28} height={28} className="rounded-lg" />
            <span className="text-lg font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Veil<span className="text-[#4D4DFF]"> Protocol</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://veilprotocol-docs.vercel.app" target="_blank" rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors">Docs</a>
            <Link href="/app">
              <button className="btn-shimmer px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold tracking-tight cursor-pointer flex items-center gap-2 shadow-lg hover:-translate-y-px transition-transform">
                Launch App <ArrowRight size={14} strokeWidth={2} />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 sm:pt-44 pb-20 sm:pb-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-100 border border-gray-200 mb-6">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#12D483] animate-pulse" />
                <span className="text-xs text-gray-600 font-medium">Starknet Mainnet</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <Brain size={10} strokeWidth={2} className="text-[#4D4DFF]" />
                <span className="text-xs text-[#4D4DFF] font-medium">AI Strategist</span>
              </span>
              <span className="w-px h-3 bg-gray-300" />
              <span className="inline-flex items-center gap-1.5">
                <CreditCard size={10} strokeWidth={2} className="text-[#FF9900]" />
                <span className="text-xs text-[#FF9900] font-medium">x402 Payments</span>
              </span>
            </div>
          </div>

          <h1 className="text-[36px] sm:text-[64px] font-black tracking-tight text-gray-900 leading-[1.05] mb-5 animate-fade-in-up"
            style={{ fontFamily: "'Inter Tight', sans-serif", animationDelay: "0.1s" }}>
            <HeroAnimations />
          </h1>

          <p className="text-[15px] sm:text-[18px] text-gray-500 max-w-xl mx-auto mb-4 leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}>
            An AI strategy agent plans your confidential BTC accumulation. ZK proofs verified on-chain via Garaga. Premium analytics gated by x402 micropayments. All on Starknet mainnet.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
            <span className="text-[12px] text-gray-400">AI plans your strategy</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">x402 unlocks premium intel</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">ZK proofs hide everything</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <Link href="/app">
              <button className="btn-shimmer px-8 py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-bold tracking-tight cursor-pointer flex items-center gap-2 shadow-xl hover:-translate-y-0.5 transition-transform">
                <Brain size={16} strokeWidth={1.5} /> Launch App
              </button>
            </Link>
            <a href="https://github.com/shariqazeem/veil-protocol" target="_blank" rel="noopener noreferrer"
              className="px-6 py-4 text-gray-500 hover:text-gray-900 text-[15px] font-medium transition-colors">View Source</a>
          </div>
        </div>
      </section>

      {/* PRIVACY POOLS + strkBTC READY */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Association Set */}
            <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-6 sm:p-8 shadow-sm hover:shadow-2xl transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-200">
                  <ShieldCheck size={18} strokeWidth={1.5} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>First Association Set Privacy Pool</h2>
                  <span className="text-[10px] text-emerald-600 font-semibold">on Starknet</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-5">
                Implementing the <strong>Privacy Pools</strong> model (Buterin, Soleimani et al.) with STARK-native proofs. Compliant privacy that separates honest users from illicit funds.
              </p>

              {/* Protocol flow diagram */}
              <div className="space-y-2.5 mb-5">
                {[
                  { step: "Deposit", desc: "USDC enters shielded pool", icon: Shield, color: "#4D4DFF" },
                  { step: "Merkle Tree", desc: "Commitment added to Association Set", icon: Layers, color: "#12D483" },
                  { step: "ZK Proof", desc: "Prove inclusion without revealing deposit", icon: Fingerprint, color: "#06B6D4" },
                  { step: "Withdrawal", desc: "Compliant exit via inclusion proof", icon: CheckCircle, color: "#12D483" },
                ].map((s, i) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                      <s.icon size={13} strokeWidth={1.5} style={{ color: s.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-['JetBrains_Mono'] text-gray-300">0{i + 1}</span>
                        <span className="text-xs font-bold text-gray-900">{s.step}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                <CheckCircle size={10} strokeWidth={2} />
                Based on Buterin et al. Privacy Pools research
              </div>
            </div>

            {/* Right: strkBTC-Ready */}
            <div className="rounded-3xl border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50/30 p-6 sm:p-8 shadow-sm hover:shadow-2xl transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-200">
                  <Bitcoin size={18} strokeWidth={1.5} className="text-[#FF9900]" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>strkBTC-Ready Architecture</h2>
                  <span className="text-[10px] text-orange-600 font-semibold">Day 1 Compatible</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-5">
                Built independently before strkBTC was announced. Our architecture already implements the features strkBTC promises for compliant shielded BTC on Starknet.
              </p>

              {/* Feature checklist */}
              <div className="space-y-3 mb-5">
                {[
                  { label: "Shielded/Unshielded dual modes", desc: "ZK-private withdrawals + transparent ragequit" },
                  { label: "Viewing keys for selective disclosure", desc: "Audit-ready without compromising other users" },
                  { label: "STARK-native ZK proofs (no trusted setup)", desc: "Noir + Garaga — quantum-secure verification" },
                  { label: "Bitcoin settlement integration", desc: "Intent-based escrow with solver network" },
                ].map((feat) => (
                  <div key={feat.label} className="flex items-start gap-2.5">
                    <CheckCircle size={14} strokeWidth={2} className="text-[#FF9900] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">{feat.label}</span>
                      <span className="text-[10px] text-gray-400">{feat.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-center">
                <span className="text-xs font-bold text-orange-700">Built before strkBTC was announced.</span>
                <span className="text-[10px] text-orange-500 block mt-0.5">Ready for Day 1 integration.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="px-4 sm:px-6 pb-20 relative">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Brain, title: "AI Strategy Agent", desc: "Tell the AI what you want \u2014 \"$50 max privacy\" \u2014 and it plans optimal deposits across tiers, timing, and pool conditions. Five strategy modes from stealth DCA to whale distribution.", color: "#4D4DFF", bg: "from-indigo-50 to-white", border: "border-indigo-200", tag: "Intelligence" },
            { icon: CreditCard, title: "x402 Micropayments", desc: "Premium pool analytics, per-tier risk scoring, and BTC projections \u2014 gated behind HTTP 402 micropayments. Pay $0.01 USDC per analysis, settled on Starknet via AVNU paymaster.", color: "#FF9900", bg: "from-orange-50 to-white", border: "border-orange-200", tag: "Monetization" },
            { icon: Fingerprint, title: "ZK Privacy Layer", desc: "Noir circuits generate proofs in-browser. Garaga verifies on-chain. Pedersen commitments for Merkle membership, Poseidon BN254 for ZK withdrawals. Secrets never leave your device.", color: "#12D483", bg: "from-emerald-50 to-white", border: "border-emerald-200", tag: "Cryptography" },
          ].map((pillar) => (
            <div key={pillar.title} className={`rounded-3xl border-2 ${pillar.border} bg-gradient-to-br ${pillar.bg} p-6 hover:shadow-2xl hover:-translate-y-3 transition-all`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${pillar.color}10`, border: `1px solid ${pillar.color}20` }}>
                  <pillar.icon size={18} strokeWidth={1.5} style={{ color: pillar.color }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: pillar.color, background: `${pillar.color}10` }}>{pillar.tag}</span>
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2" style={{ fontFamily: "'Inter Tight', sans-serif" }}>{pillar.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* x402 FLOW */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50/30 p-6 sm:p-10 shadow-sm hover:shadow-2xl transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-200">
                <CreditCard size={18} strokeWidth={1.5} className="text-[#FF9900]" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>x402: Pay-Per-Insight Privacy Analytics</h2>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">The first privacy protocol with native micropayment-gated AI intelligence. No subscriptions, no accounts &mdash; just HTTP 402.</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
              {[
                { step: "01", label: "Request", desc: "GET /api/agent/premium-strategy", icon: Server, color: "#6B7280" },
                { step: "02", label: "402 Response", desc: "Payment requirements returned", icon: CreditCard, color: "#FF9900" },
                { step: "03", label: "Pay & Settle", desc: "$0.01 USDC via AVNU paymaster", icon: Wallet, color: "#4D4DFF" },
                { step: "04", label: "Premium Intel", desc: "Risk scores, timing, projections", icon: Sparkles, color: "#12D483" },
              ].map((s) => (
                <div key={s.step} className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:shadow-lg hover:-translate-y-1 transition-all">
                  <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <s.icon size={14} strokeWidth={1.5} style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-['JetBrains_Mono'] text-gray-300 block">{s.step}</span>
                  <span className="text-xs font-bold text-gray-900 block">{s.label}</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{s.desc}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Pool Health Score", value: "A+" },
                { label: "Per-Tier Risk", value: "5 levels" },
                { label: "BTC Projections", value: "Live" },
                { label: "Optimal Timing", value: "Real-time" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-center">
                  <div className="text-sm font-bold text-orange-700" style={{ fontFamily: "'Inter Tight', sans-serif" }}>{item.value}</div>
                  <div className="text-[10px] text-orange-500 font-medium">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI STRATEGY ENGINE */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 sm:p-10 shadow-sm hover:shadow-2xl transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-200">
                <Brain size={18} strokeWidth={1.5} className="text-[#4D4DFF]" />
              </div>
              <h2 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>AI Strategy Engine</h2>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 text-[#4D4DFF] border border-indigo-200">Natural Language</span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">Tell the AI how you want to accumulate BTC. It analyzes live pool conditions, anonymity sets, BTC price, and timing &mdash; then generates an optimal strategy. One-click execution via connected wallet.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
              {[
                { mode: "Privacy-First", desc: "Max anonymity set" },
                { mode: "Stealth DCA", desc: "Time-decorrelated" },
                { mode: "Whale Split", desc: "Large amount splitting" },
                { mode: "Efficiency", desc: "Least deposits" },
                { mode: "Balanced", desc: "Best of all" },
              ].map((s) => (
                <div key={s.mode} className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-center">
                  <div className="text-[11px] font-bold text-indigo-700">{s.mode}</div>
                  <div className="text-[10px] text-indigo-400">{s.desc}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-3">Natural Language Examples</span>
              <div className="flex flex-wrap gap-2">
                {["\"$50 max privacy\"", "\"DCA $200 over 5 deposits\"", "\"Spread $500 across all tiers\"", "\"Quick $10 anonymous deposit\""].map((p) => (
                  <span key={p} className="text-xs font-['JetBrains_Mono'] text-gray-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROTOCOL FLOW */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Protocol Flow</span>
            <h2 className="text-[22px] sm:text-[30px] font-black tracking-tight text-gray-900 mt-3" style={{ fontFamily: "'Inter Tight', sans-serif" }}>From Strategy to Confidential BTC Exit</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { icon: Brain, title: "Plan", desc: "AI analyzes pools, timing, and privacy scores to generate your optimal strategy.", color: "#4D4DFF", bg: "from-indigo-50 to-white", border: "border-indigo-100" },
              { icon: Shield, title: "Shield", desc: "Deposit USDC into fixed-denomination privacy pools. Pedersen + Poseidon commitments computed client-side.", color: "#4D4DFF", bg: "from-indigo-50 to-white", border: "border-indigo-100" },
              { icon: Layers, title: "Batch", desc: "All deposits aggregate into one USDC-to-BTC swap via AVNU. Individual intent hidden within the batch.", color: "#12D483", bg: "from-emerald-50 to-white", border: "border-emerald-100" },
              { icon: Fingerprint, title: "Prove", desc: "ZK proof generated in-browser (noir_js + bb.js). Garaga verifies ~2,835 calldata elements on-chain.", color: "#06B6D4", bg: "from-cyan-50 to-white", border: "border-cyan-100" },
              { icon: Bitcoin, title: "Exit", desc: "Claim WBTC on Starknet or intent-based native BTC settlement via escrow-solver-oracle.", color: "#FF9900", bg: "from-orange-50 to-white", border: "border-orange-100" },
            ].map((step, i) => (
              <div key={step.title} className={`rounded-2xl border-2 ${step.border} bg-gradient-to-br ${step.bg} p-4 text-center hover:shadow-2xl hover:-translate-y-3 transition-all`}>
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-sm" style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                  <step.icon size={18} strokeWidth={1.5} style={{ color: step.color }} />
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-['JetBrains_Mono'] text-gray-300">0{i + 1}</span>
                  <h3 className="text-[13px] font-bold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM + SOLUTION */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-3xl border-2 border-red-100 bg-gradient-to-br from-white to-red-50/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center border border-red-100"><Eye size={14} strokeWidth={1.5} className="text-red-500" /></div>
              <h2 className="text-[14px] font-bold text-gray-900">The Problem</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">Every Bitcoin purchase on DeFi is publicly visible. No AI guidance. No privacy. No way to accumulate BTC without signaling your strategy to the entire market.</p>
            <div className="space-y-2">
              {["Strategy exposed to front-runners", "Transaction amounts create fingerprints", "No intelligent entry timing"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-red-400"><span className="w-1 h-1 rounded-full bg-red-300" />{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100"><Shield size={14} strokeWidth={1.5} className="text-emerald-600" /></div>
              <h2 className="text-[14px] font-bold text-gray-900">Veil Protocol</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">AI plans your strategy. ZK proofs hide your activity. x402 micropayments unlock premium analytics. Starknet&apos;s STARKs provide quantum-secure verification.</p>
            <div className="space-y-2">
              {["AI optimizes privacy + timing", "Fixed tranches make deposits uniform", "Pay-per-insight analytics via x402"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-emerald-500"><CheckCircle size={10} strokeWidth={2} />{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Technical Architecture</span>
          </div>
          <div className="rounded-3xl border-2 border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              {[
                { title: "AI Layer", color: "indigo", items: ["Natural language strategy", "5 optimization modes", "Live pool analytics", "x402 premium gate"] },
                { title: "Client (Browser)", color: "indigo", items: ["noir_js witness gen", "bb.js proof gen (WASM)", "Poseidon BN254 commits", "Starknet + BTC wallets"] },
                { title: "On-Chain (Cairo)", color: "emerald", items: ["Pedersen commitments", "Garaga ZK verifier", "Merkle tree (depth 20)", "Intent escrow + oracle"] },
                { title: "Infrastructure", color: "orange", items: ["AVNU DEX aggregation", "x402 AVNU paymaster", "Gasless relayer (AA)", "Intent solver network"] },
              ].map((col) => (
                <div key={col.title} className={`rounded-xl bg-${col.color}-50 border border-${col.color}-100 p-4`}>
                  <div className={`text-xs font-bold text-${col.color}-600 mb-3`}>{col.title}</div>
                  <div className="space-y-2">
                    {col.items.map((item) => (
                      <div key={item} className="flex items-center gap-2"><span className={`w-1 h-1 rounded-full bg-${col.color}-400`} /><span className="text-xs text-gray-600">{item}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="flex items-center gap-1.5 mb-3"><Fingerprint size={12} strokeWidth={1.5} className="text-emerald-600" /><span className="text-xs font-bold text-emerald-700">ZK Proof Pipeline</span></div>
                <div className="space-y-1.5">
                  {["Noir Circuit \u2192 Poseidon BN254", "noir_js \u2192 Witness (browser WASM)", "bb.js \u2192 Proof (browser WASM)", "Garaga \u2192 ~2,835 calldata felt252", "Starknet \u2192 On-chain verification"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2"><span className="text-[10px] font-['JetBrains_Mono'] text-emerald-400 w-3">{i + 1}.</span><span className="text-[11px] text-emerald-700 font-medium">{s}</span></div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
                <div className="flex items-center gap-1.5 mb-3"><CreditCard size={12} strokeWidth={1.5} className="text-[#FF9900]" /><span className="text-xs font-bold text-orange-700">x402 Payment Flow</span></div>
                <div className="space-y-1.5">
                  {["Client \u2192 GET premium-strategy", "Server \u2192 402 Payment Required", "Client \u2192 Sign via AVNU paymaster", "Server \u2192 Verify + settle on-chain", "Server \u2192 Return premium analysis"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2"><span className="text-[10px] font-['JetBrains_Mono'] text-orange-400 w-3">{i + 1}.</span><span className="text-[11px] text-orange-700 font-medium">{s}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT SETS US APART */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">What Sets Us Apart</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Brain, title: "AI-Planned Privacy", desc: "Strategy engine picks optimal tiers, timing, and pool conditions for maximum anonymity.", color: "#4D4DFF" },
              { icon: CreditCard, title: "x402 Micropayments", desc: "HTTP 402-native premium APIs. $0.01 per analysis, settled on-chain via AVNU paymaster.", color: "#FF9900" },
              { icon: Fingerprint, title: "On-Chain ZK Proofs", desc: "Real Noir circuits verified by Garaga. Browser-generated proofs. No mock, no backend trust.", color: "#12D483" },
              { icon: Bitcoin, title: "Native BTC Settlement", desc: "Intent-based escrow. Solver delivers native BTC. Oracle confirms. Trustless cross-chain exit.", color: "#FF9900" },
              { icon: Building2, title: "Standardized Tranches", desc: "$1, $10, $100, $1,000. Fixed denominations create uniform anonymity sets.", color: "#4D4DFF" },
              { icon: Lock, title: "MEV Protection", desc: "Individual orders hidden within batch execution. No mempool exposure.", color: "#12D483" },
              { icon: ShieldCheck, title: "Compliance Ready", desc: "Optional view keys for regulators. Prove your deposits without compromising others.", color: "#4D4DFF" },
              { icon: Bot, title: "Telegram Strategy Bot", desc: "@VeilProtocolBot plans strategies in chat, links to web app for self-custody execution.", color: "#06B6D4" },
            ].map((feat) => (
              <div key={feat.title} className="p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-2xl hover:-translate-y-3 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm" style={{ background: `${feat.color}08`, border: `1px solid ${feat.color}15` }}>
                  <feat.icon size={18} strokeWidth={1.5} style={{ color: feat.color }} />
                </div>
                <h4 className="text-[13px] font-bold text-gray-900 mb-1">{feat.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERIFIED ON-CHAIN */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Fingerprint size={16} strokeWidth={1.5} className="text-emerald-600" />
              <h3 className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>Deployed on Starknet Mainnet</h3>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700"><CheckCircle size={10} strokeWidth={2} />Production</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">Real USDC, real WBTC, real AVNU integration, real Garaga ZK verification. Not a testnet demo &mdash; production infrastructure handling real assets with AI strategy and x402 payments.</p>
            <div className="flex flex-wrap gap-2">
              <a href={`${EXPLORER_CONTRACT}${addresses.contracts.shieldedPool}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 hover:text-gray-900 transition-all">
                <Shield size={12} strokeWidth={1.5} />Pool Contract<ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
              <a href={`${EXPLORER_CONTRACT}${(addresses.contracts as Record<string, string>).garagaVerifier ?? ""}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-700 transition-all">
                <Fingerprint size={12} strokeWidth={1.5} />Garaga ZK Verifier<ExternalLink size={10} strokeWidth={2} className="opacity-50" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-6"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Technology Stack</span></div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
              {["Cairo 2.15", "Starknet", "Noir ZK", "Garaga", "Barretenberg", "x402-starknet", "AVNU Paymaster", "Pedersen Hash", "Poseidon BN254", "Merkle Trees", "Association Sets (Privacy Pools)", "strkBTC-Compatible", "Next.js", "sats-connect", "snforge", "37 Cairo Tests"].map((tech) => (
                <span key={tech} className="text-[12px] font-['JetBrains_Mono'] font-medium text-gray-600 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-default">{tech}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-32 relative">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[24px] sm:text-[36px] font-black tracking-tight text-gray-900 mb-4" style={{ fontFamily: "'Inter Tight', sans-serif" }}>AI-powered. Privacy-first. Pay-per-use.</h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-lg mx-auto">The first Association Set privacy pool on Starknet — combining Privacy Pools compliance, AI strategy agents, ZK proofs, and strkBTC-ready architecture. Built for the Re&#123;define&#125; Hackathon.</p>
          <Link href="/app">
            <button className="btn-shimmer px-8 py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-bold tracking-tight cursor-pointer flex items-center gap-2 mx-auto shadow-xl hover:-translate-y-0.5 transition-transform">
              <Brain size={16} strokeWidth={1.5} /> Launch App <ArrowRight size={14} strokeWidth={2} />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-10 px-4 relative">
        <div className="h-px bg-gray-200 max-w-lg mx-auto mb-8" />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-2">
          {["Privacy Pools", "strkBTC Ready", "AI Strategy Agent", "x402 Micropayments", "ZK Privacy", "Bitcoin Settlement", "Starknet Mainnet"].map((item) => (
            <span key={item} className="text-xs text-gray-400 font-medium">{item}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400">Veil Protocol &middot; AI + x402 + Privacy on Starknet</p>
        <p className="text-xs text-gray-400 mt-1">Re&#123;define&#125; Hackathon 2026 &middot; Privacy + Bitcoin + x402 Tracks</p>
      </footer>
    </div>
  );
}
