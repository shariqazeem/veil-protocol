"use client";

import { useState, useEffect } from "react";

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

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  const [arcOffset, setArcOffset] = useState(circumference);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setArcOffset(targetOffset);
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [targetOffset]);

  return (
    <div>
      <span className="text-xs text-[var(--text-tertiary)] font-medium">Privacy Score</span>

      <div className="flex flex-col items-center mt-4 gap-3">
        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Glow ring */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10" opacity="0.12" style={{ filter: "blur(8px)" }} />
            {/* Background track */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth="6" />
            {/* Score arc */}
            <circle
              cx="60" cy="60" r={radius}
              fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={arcOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-0.5">
              <span
                className={`text-2xl font-['JetBrains_Mono'] font-bold font-tabular transition-opacity duration-300 ${
                  visible ? "opacity-100" : "opacity-0"
                }`}
                style={{ color, transitionDelay: "0.4s" }}
              >
                {score}
              </span>
              <span className="text-[10px] text-[var(--text-quaternary)] font-['JetBrains_Mono']">/ 100</span>
            </div>
            <span className="text-[10px] text-[var(--text-quaternary)]">{label}</span>
          </div>
        </div>

        <div className="w-full space-y-2">
          {items.map(({ label, value, max }, i) => (
            <BarItem key={label} label={label} value={value} max={max} color={color} delay={300 + i * 100} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BarItem({ label, value, max, color, delay }: { label: string; value: number; max: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth((value / max) * 100), delay);
    return () => clearTimeout(timer);
  }, [value, max, delay]);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
        <span className="text-[11px] font-['JetBrains_Mono'] text-[var(--text-secondary)] font-tabular">
          {value}<span className="text-[var(--text-quaternary)]">/{max}</span>
        </span>
      </div>
      <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-600 ease-out"
          style={{ backgroundColor: color, width: `${width}%` }}
        />
      </div>
    </div>
  );
}
