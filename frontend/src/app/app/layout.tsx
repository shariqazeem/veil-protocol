"use client";

import { StarknetProvider } from "@/components/StarknetProvider";
import { WalletProvider } from "@/context/WalletContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StarknetProvider>
      <WalletProvider>
        {children}
      </WalletProvider>
    </StarknetProvider>
  );
}
