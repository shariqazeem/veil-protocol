"use client";

import { useTelegram } from "@/context/TelegramContext";
import WalletBar from "./WalletBar";
import type { ReactNode } from "react";

interface TelegramAppShellProps {
  children: ReactNode;
}

export default function TelegramAppShell({ children }: TelegramAppShellProps) {
  const { isTelegram } = useTelegram();

  if (isTelegram) {
    // In Telegram: no WalletBar header, reduced top padding, extra bottom padding for MainButton, no footer
    return (
      <div className="min-h-screen bg-white relative">
        <div className="fixed inset-0 animated-mesh-bg-dim pointer-events-none" />
        <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

        <main className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-24 space-y-5 sm:space-y-6">
          {children}
        </main>
      </div>
    );
  }

  // In browser: full layout with WalletBar, standard padding, footer
  return (
    <div className="min-h-screen bg-white relative">
      <div className="fixed inset-0 animated-mesh-bg-dim pointer-events-none" />
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

      <WalletBar />
      <main className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 sm:pb-20 space-y-5 sm:space-y-6">
        {children}
      </main>
      <footer className="relative text-center pb-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-1 h-1 rounded-full bg-[#12D483] animate-pulse-dot" />
          <p className="text-[11px] text-gray-400">
            Veil Protocol &middot; Starknet
          </p>
        </div>
      </footer>
    </div>
  );
}
