import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import TabPanel from "@/components/TabPanel";
import TransactionHistory from "@/components/TransactionHistory";
import OnboardingBanner from "@/components/OnboardingBanner";
import TelegramAppShell from "@/components/TelegramAppShell";

export default function AppPage() {
  return (
    <TelegramAppShell>
      <OnboardingBanner />
      <Dashboard />
      <Suspense>
        <TabPanel />
      </Suspense>
      <TransactionHistory />
    </TelegramAppShell>
  );
}
