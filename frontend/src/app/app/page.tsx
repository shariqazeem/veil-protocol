"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import TelegramAppShell from "@/components/TelegramAppShell";

function SectionSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={18} className="animate-spin text-gray-300" />
    </div>
  );
}

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});

const TabPanel = dynamic(() => import("@/components/TabPanel"), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});

const TransactionHistory = dynamic(() => import("@/components/TransactionHistory"), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});

const OnboardingBanner = dynamic(() => import("@/components/OnboardingBanner"), {
  ssr: false,
});

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
