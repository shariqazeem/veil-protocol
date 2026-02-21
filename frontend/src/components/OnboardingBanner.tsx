"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X, Shield, Wallet, ArrowRightLeft, Lock } from "lucide-react";
import { isMainnet } from "@/utils/network";

const STARKNET_FAUCET = "https://starknet-faucet.vercel.app/";

const steps = [
  { icon: Wallet, label: "Connect", desc: "Link Starknet + Bitcoin wallets" },
  { icon: Shield, label: "Shield", desc: "Deposit USDC into privacy pool" },
  { icon: ArrowRightLeft, label: "Convert", desc: "Batch swap to BTC at market rate" },
  { icon: Lock, label: "Exit", desc: "ZK-prove ownership, withdraw privately" },
];

export default function OnboardingBanner() {
  const { isConnected } = useAccount();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isConnected) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="card-glow p-4 sm:p-5 relative"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
        >
          <X size={14} strokeWidth={1.5} />
        </button>

        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          Confidential Bitcoin Accumulation
        </span>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4 max-w-[280px]">
          Shield USDC, convert to BTC, exit privately with zero-knowledge proofs.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {steps.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="text-center"
            >
              <div className="w-8 h-8 mx-auto rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-1.5">
                <Icon size={13} strokeWidth={1.5} className="text-violet-500" />
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">{label}</span>
              <span className="text-[9px] text-[var(--text-quaternary)] leading-tight block mt-0.5 hidden sm:block">{desc}</span>
            </motion.div>
          ))}
        </div>

        {!isMainnet && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <a
              href={STARKNET_FAUCET}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-violet-500 hover:underline inline-flex items-center gap-1"
            >
              Get testnet gas <ExternalLink size={8} strokeWidth={2} />
            </a>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
