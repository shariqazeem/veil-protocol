"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Shield, Unlock, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ShieldForm from "./ShieldForm";
import UnveilForm from "./UnveilForm";
import ComplianceTab from "./ComplianceTab";
import AgentTab from "./AgentTab";

type Step = 1 | 2 | "agent";

const tabs = [
  { key: 1 as Step, label: "Shield", icon: Shield, color: "var(--accent-orange)", glow: "rgba(255,90,0,0.15)" },
  { key: 2 as Step, label: "Unveil", icon: Unlock, color: "var(--accent-emerald)", glow: "rgba(52,211,153,0.15)" },
  { key: "agent" as Step, label: "Strategist", icon: Brain, color: "var(--accent-violet)", glow: "rgba(167,139,250,0.15)" },
];

export default function TabPanel() {
  const [step, setStep] = useState<Step>(1);
  const [showCompliance, setShowCompliance] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("strategy")) {
      setStep("agent");
    }
  }, [searchParams]);

  function handleAccumulationComplete() {
    setStep(2);
  }

  if (showCompliance) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
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
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Tab Bar */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="flex items-center gap-3">
          {/* Segmented Control */}
          <div className="flex gap-1 p-1 bg-[var(--bg-primary)] rounded-xl flex-1 border border-[var(--border-subtle)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = step === tab.key;
              return (
                <motion.button
                  key={String(tab.key)}
                  onClick={() => setStep(tab.key)}
                  className={`flex-1 py-2.5 text-sm text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-lg font-medium relative ${
                    isActive ? "text-white" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: tab.color,
                        boxShadow: `0 0 20px ${tab.glow}`,
                      }}
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
              transition={{ duration: 0.2 }}
            >
              <ShieldForm onComplete={handleAccumulationComplete} />
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <UnveilForm />
            </motion.div>
          ) : (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AgentTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
