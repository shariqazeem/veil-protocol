import { Suspense } from "react";
import WalletBar from "@/components/WalletBar";
import Dashboard from "@/components/Dashboard";
import TabPanel from "@/components/TabPanel";
import TransactionHistory from "@/components/TransactionHistory";
import OnboardingBanner from "@/components/OnboardingBanner";

export default function AppPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative">
      {/* Subtle animated mesh background — matches landing page */}
      <div className="fixed inset-0 animated-mesh-bg-dim pointer-events-none" />

      <WalletBar />
      <main className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 sm:pb-20 space-y-5 sm:space-y-6">
        <OnboardingBanner />
        <Dashboard />
        <Suspense>
          <TabPanel />
        </Suspense>
        <TransactionHistory />
      </main>
      <footer className="relative text-center pb-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-1 h-1 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
          <p className="text-[11px] text-[var(--text-quaternary)]">
            Veil Protocol &middot; Starknet
          </p>
        </div>
      </footer>
    </div>
  );
}
