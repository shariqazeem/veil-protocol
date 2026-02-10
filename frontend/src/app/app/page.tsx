import WalletBar from "@/components/WalletBar";
import Dashboard from "@/components/Dashboard";
import TabPanel from "@/components/TabPanel";
import TransactionHistory from "@/components/TransactionHistory";

export default function AppPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <WalletBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 sm:pb-20 space-y-8 sm:space-y-10">
        <Dashboard />
        <TabPanel />
        <TransactionHistory />
      </main>
      <footer className="text-center pb-8 sm:pb-10">
        <p className="text-[11px] text-[var(--text-tertiary)] tracking-widest uppercase">
          GhostSats v1.0 &middot; Starknet Sepolia
        </p>
        <p className="text-[10px] text-[var(--text-quaternary)] mt-1">
          ZK Proofs &middot; Pedersen Commitments &middot; Merkle Proofs &middot; Nullifier Set
        </p>
      </footer>
    </div>
  );
}
