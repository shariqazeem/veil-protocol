"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Shield, Unlock, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTelegram } from "@/context/TelegramContext";
import ShieldForm from "./ShieldForm";
import UnveilForm from "./UnveilForm";
import ComplianceTab from "./ComplianceTab";
import AgentTab from "./AgentTab";

type Step = 1 | 2 | "agent";

const tabs = [
  { key: 1 as Step, label: "Shield", icon: Shield, color: "#4D4DFF", glow: "rgba(77,77,255,0.15)" },
  { key: 2 as Step, label: "Unveil", icon: Unlock, color: "#12D483", glow: "rgba(18,212,131,0.15)" },
  { key: "agent" as Step, label: "Strategist", icon: Brain, color: "#4D4DFF", glow: "rgba(77,77,255,0.15)" },
];

export default function TabPanel() {
  const [step, setStep] = useState<Step>(1);
  const [showCompliance, setShowCompliance] = useState(false);
  const [prefillTier, setPrefillTier] = useState<number | null>(null);
  const [prefillNoteIdx, setPrefillNoteIdx] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { startParam } = useTelegram();

  useEffect(() => {
    // Handle ?action=shield&tier=2
    const action = searchParams.get("action");
    if (action === "shield") {
      setStep(1);
      const tier = searchParams.get("tier");
      if (tier !== null) {
        const tierNum = parseInt(tier, 10);
        if (!isNaN(tierNum) && tierNum >= 0 && tierNum <= 3) {
          setPrefillTier(tierNum);
        }
      }
      return;
    }

    if (action === "unveil") {
      setStep(2);
      const noteIdx = searchParams.get("noteIdx");
      if (noteIdx !== null) {
        const idx = parseInt(noteIdx, 10);
        if (!isNaN(idx) && idx >= 0) {
          setPrefillNoteIdx(idx);
        }
      }
      return;
    }

    if (action === "agent") {
      setStep("agent");
      return;
    }

    // Handle ?strategy=<base64> (existing behavior)
    if (searchParams.get("strategy")) {
      setStep("agent");
      return;
    }

    // Handle ?tgWebAppStartParam=<base64> (from Telegram deep link)
    const tgStart = searchParams.get("tgWebAppStartParam") || startParam;
    if (tgStart) {
      try {
        const json = atob(tgStart.replace(/-/g, "+").replace(/_/g, "/"));
        const decoded = JSON.parse(json);
        if (decoded.action === "shield") {
          setStep(1);
          if (typeof decoded.tier === "number") setPrefillTier(decoded.tier);
        } else if (decoded.action === "unveil") {
          setStep(2);
          if (typeof decoded.noteIdx === "number") setPrefillNoteIdx(decoded.noteIdx);
        } else if (decoded.action === "agent") {
          setStep("agent");
        }
      } catch { /* ignore parse errors */ }
    }
  }, [searchParams, startParam]);

  function handleAccumulationComplete() {
    setStep(2);
  }

  // Clean URL params after consuming
  function cleanUrlParams() {
    if (typeof window !== "undefined" && window.location.search) {
      router.replace("/app", { scroll: false });
    }
  }

  if (showCompliance) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-3xl border-2 border-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 sm:p-6">
          <button
            onClick={() => setShowCompliance(false)}
            className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer mb-4 flex items-center gap-1"
          >
            &larr; Back
          </button>
          <ComplianceTab />
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.key === step)!;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-3xl border-2 border-[var(--border-subtle)] overflow-hidden">
      {/* Tab Bar */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="flex items-center gap-3">
          {/* Segmented Control — ParallaxPay pill pattern */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = step === tab.key;
              return (
                <motion.button
                  key={String(tab.key)}
                  onClick={() => setStep(tab.key)}
                  className={`flex-1 py-2.5 text-sm text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-lg font-medium relative ${
                    isActive ? "" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={isActive ? { color: tab.color } : undefined}
                  whileTap={{ scale: 0.97 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg bg-white shadow-md"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon size={14} strokeWidth={1.5} />
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Compliance icon button */}
          <button
            onClick={() => setShowCompliance(true)}
            className="p-2.5 rounded-xl text-[var(--text-quaternary)] hover:text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-dim)] transition-all cursor-pointer border border-transparent hover:border-[var(--accent-emerald)]/20"
            title="Compliance"
          >
            <ShieldCheck size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ x: { type: "spring", stiffness: 300, damping: 24 }, opacity: { duration: 0.2 } }}
            >
              <ShieldForm
                onComplete={handleAccumulationComplete}
                prefillTier={prefillTier}
                onPrefillConsumed={() => { setPrefillTier(null); cleanUrlParams(); }}
              />
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ x: { type: "spring", stiffness: 300, damping: 24 }, opacity: { duration: 0.2 } }}
            >
              <UnveilForm
                prefillNoteIdx={prefillNoteIdx}
                onPrefillConsumed={() => { setPrefillNoteIdx(null); cleanUrlParams(); }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ y: { type: "spring", stiffness: 300, damping: 24 }, opacity: { duration: 0.2 } }}
            >
              <AgentTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
