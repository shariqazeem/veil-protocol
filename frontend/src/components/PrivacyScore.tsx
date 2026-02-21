"use client";

import { motion } from "framer-motion";

interface PrivacyScoreProps {
  anonSet: number;
  batches: number;
  btcLinked: number;
  commitments: number;
}

function computeBreakdown(props: PrivacyScoreProps) {
  const anonPts = Math.min(props.anonSet / 20, 1) * 40;
  const batchPts = Math.min(props.batches / 10, 1) * 20;
  const btcPts = Math.min(props.btcLinked / 5, 1) * 15;
  const usagePts = Math.min(props.commitments / 20, 1) * 15 + (props.commitments > 0 ? 10 : 0);
  const rawTotal = anonPts + batchPts + btcPts + usagePts;
  const total = Math.min(Math.round(rawTotal), 100);

  return {
    total,
    items: [
      { label: "Anonymity", value: Math.round(anonPts), max: 40 },
      { label: "Batches", value: Math.round(batchPts), max: 20 },
      { label: "BTC Link", value: Math.round(btcPts), max: 15 },
      { label: "Usage", value: Math.round(usagePts), max: 25 },
    ],
  };
}

export default function PrivacyScore(props: PrivacyScoreProps) {
  const { total: score, items } = computeBreakdown(props);
  const color = score >= 60 ? "var(--accent-emerald)" : score >= 30 ? "var(--accent-amber)" : "var(--text-quaternary)";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Strong" : score >= 30 ? "Moderate" : "Building";

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div>
      <span className="text-xs text-[var(--text-tertiary)] font-medium">Privacy Score</span>

      <div className="flex flex-col items-center mt-4 gap-3">
        <div className="relative">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth="5" />
            <motion.circle
              cx="48" cy="48" r={radius}
              fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-xl font-['JetBrains_Mono'] font-bold font-tabular"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {score}
            </motion.span>
            <span className="text-[10px] text-[var(--text-quaternary)]">{label}</span>
          </div>
        </div>

        <div className="w-full space-y-1">
          {items.map(({ label, value, max }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
              <span className="text-[11px] font-['JetBrains_Mono'] text-[var(--text-secondary)] font-tabular">
                {value}<span className="text-[var(--text-quaternary)]">/{max}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
