"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import OnboardingBanner from "@/components/OnboardingBanner";
import TelegramAppShell from "@/components/TelegramAppShell";

const Dashboard = dynamic(() => import("@/components/Dashboard"), { ssr: false });
const TabPanel = dynamic(() => import("@/components/TabPanel"), { ssr: false });
const TransactionHistory = dynamic(() => import("@/components/TransactionHistory"), { ssr: false });

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
