"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ExternalLink, X } from "lucide-react";

const STARKNET_FAUCET = "https://starknet-faucet.vercel.app/";

export default function OnboardingBanner() {
  const { isConnected } = useAccount();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isConnected) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="rounded-2xl p-5 bg-gradient-to-br from-orange-950/30 to-[var(--bg-secondary)] border border-orange-800/20 relative"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
        >
          <X size={14} strokeWidth={1.5} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/20 flex items-center justify-center flex-shrink-0">
            <Rocket size={16} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
              Welcome to GhostSats
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
              This is a live testnet demo on Starknet Sepolia. To try the full privacy flow:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-[var(--accent-orange)] font-[family-name:var(--font-geist-mono)] mt-0.5 flex-shrink-0">01</span>
                <div>
                  <span className="text-[11px] text-[var(--text-primary)] font-medium">Get Sepolia ETH for gas</span>
                  <a
                    href={STARKNET_FAUCET}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-[var(--accent-orange)] hover:underline"
                  >
                    Faucet <ExternalLink size={8} strokeWidth={2} />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-[var(--accent-orange)] font-[family-name:var(--font-geist-mono)] mt-0.5 flex-shrink-0">02</span>
                <span className="text-[11px] text-[var(--text-primary)] font-medium">Connect Starknet + Bitcoin wallets</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-[var(--accent-orange)] font-[family-name:var(--font-geist-mono)] mt-0.5 flex-shrink-0">03</span>
                <span className="text-[11px] text-[var(--text-primary)] font-medium">Mint test USDC in the Shield tab, then deposit</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-[var(--accent-orange)] font-[family-name:var(--font-geist-mono)] mt-0.5 flex-shrink-0">04</span>
                <span className="text-[11px] text-[var(--text-primary)] font-medium">Unveil with ZK proof — verified on-chain by Garaga</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
