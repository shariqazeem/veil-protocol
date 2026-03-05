"use client";

import { useState, useEffect } from "react";
import { Shield, Users, Layers, Activity } from "lucide-react";

interface PoolData {
  pool: {
    anonSets: number[];
    totalDeposits: number;
    activeTiers: number;
    batchesExecuted: number;
    totalVolume: number;
  };
  health: {
    overall: number;
    rating: string;
  };
}

export function LivePoolStats() {
  const [data, setData] = useState<PoolData | null>(null);

  useEffect(() => {
    fetch("/api/agent/privacy-score")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { pool, health } = data;
  const totalAnon = pool.anonSets.reduce((a: number, b: number) => a + b, 0);

  const stats = [
    { icon: Shield, label: "Total Deposits", value: String(pool.totalDeposits), color: "#4D4DFF" },
    { icon: Users, label: "Anonymity Set", value: String(totalAnon), color: "#12D483" },
    { icon: Layers, label: "Batches Executed", value: String(pool.batchesExecuted), color: "#FF9900" },
    { icon: Activity, label: "Protocol Health", value: `${health.overall}% ${health.rating}`, color: "#12D483" },
  ];

  return (
    <section className="px-4 sm:px-6 pb-16 relative">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12D483] animate-pulse" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Live Mainnet Stats</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                  <s.icon size={14} strokeWidth={1.5} style={{ color: s.color }} />
                </div>
                <div className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "'Inter Tight', sans-serif" }}>{s.value}</div>
                <div className="text-[10px] text-gray-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
