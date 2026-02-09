"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WalletState {
  starknetAddress: string | null;
  bitcoinAddress: string | null;
  bitcoinPublicKey: string | null;
  setStarknetAddress: (addr: string | null) => void;
  setBitcoinAddress: (addr: string | null) => void;
  setBitcoinPublicKey: (key: string | null) => void;
}

const WalletContext = createContext<WalletState>({
  starknetAddress: null,
  bitcoinAddress: null,
  bitcoinPublicKey: null,
  setStarknetAddress: () => {},
  setBitcoinAddress: () => {},
  setBitcoinPublicKey: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [starknetAddress, setStarknetAddress] = useState<string | null>(null);
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null);
  const [bitcoinPublicKey, setBitcoinPublicKey] = useState<string | null>(null);

  return (
    <WalletContext.Provider
      value={{ starknetAddress, bitcoinAddress, bitcoinPublicKey, setStarknetAddress, setBitcoinAddress, setBitcoinPublicKey }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
