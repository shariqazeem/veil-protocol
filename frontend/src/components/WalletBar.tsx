"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useEffect, useState, useRef } from "react";
import { Shield, Bitcoin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function WalletBar() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { starknetAddress, bitcoinAddress, setStarknetAddress, setBitcoinAddress, setBitcoinPublicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStarknetAddress(isConnected && address ? address : null);
  }, [address, isConnected, setStarknetAddress]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function connectBitcoin() {
    setBtcLoading(true);
    setBtcError(null);
    try {
      const satsConnect = await import("sats-connect");
      const getAddress = satsConnect.getAddress;
      const AddressPurpose = satsConnect.AddressPurpose;
      const BitcoinNetworkType = satsConnect.BitcoinNetworkType;

      await getAddress({
        payload: {
          purposes: [AddressPurpose.Payment],
          message: "GhostSats: Verify your Bitcoin identity",
          network: { type: BitcoinNetworkType.Testnet4 },
        },
        onFinish: (response: { addresses: Array<{ purpose: string; address: string; publicKey?: string }> }) => {
          const paymentAddr = response.addresses.find(
            (a: { purpose: string }) => a.purpose === AddressPurpose.Payment
          );
          if (paymentAddr) {
            setBitcoinAddress(paymentAddr.address);
            if (paymentAddr.publicKey) {
              setBitcoinPublicKey(paymentAddr.publicKey);
            }
          }
        },
        onCancel: () => {
          setBtcLoading(false);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("no bitcoin wallet")) {
        setBtcError("Install Xverse or another Bitcoin wallet extension");
      } else {
        setBtcError(msg);
      }
    }
    setBtcLoading(false);
  }

  const bothConnected = !!starknetAddress && !!bitcoinAddress;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* Wordmark */}
        <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          Ghost<span className="text-[var(--accent-orange)]">Sats</span>
        </span>

        {/* Identity Pill */}
        <div ref={ref} className="relative">
          <motion.button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0 rounded-full bg-[var(--bg-secondary)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-shadow cursor-pointer overflow-hidden border border-[var(--border-subtle)]"
            whileTap={{ scale: 0.97 }}
            transition={spring}
          >
            {/* Starknet side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 border-r border-[var(--border-subtle)]">
              <Shield size={13} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              {starknetAddress ? (
                <>
                  <span className="hidden sm:inline text-[13px] font-medium text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(starknetAddress)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                </>
              ) : (
                <span className="hidden sm:inline text-[13px] font-medium text-[var(--text-tertiary)]">Starknet</span>
              )}
            </div>

            {/* Bitcoin side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5">
              <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              {bitcoinAddress ? (
                <>
                  <span className="hidden sm:inline text-[13px] font-medium text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(bitcoinAddress)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                </>
              ) : (
                <span className="hidden sm:inline text-[13px] font-medium text-[var(--text-tertiary)]">Bitcoin</span>
              )}
            </div>
          </motion.button>

          {/* If neither connected, show subtle label */}
          {!starknetAddress && !bitcoinAddress && (
            <div className="absolute -bottom-6 right-0 text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
              Connect Identity
            </div>
          )}

          {/* Dropdown */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={spring}
                className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-w-80 glass-card p-5 z-50"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                    Identity
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Starknet Section */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Shield size={13} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Starknet
                    </span>
                    {starknetAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    )}
                  </div>
                  {starknetAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl px-3.5 py-3">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(starknetAddress, 6)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {connectors.map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => connect({ connector })}
                          className="w-full text-left px-3.5 py-3 bg-[var(--bg-secondary)] rounded-xl text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                        >
                          {connector.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Separator */}
                <div className="h-px bg-[var(--border-subtle)] mb-5" />

                {/* Bitcoin Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Bitcoin <span className="text-[var(--text-quaternary)] normal-case tracking-normal">(optional)</span>
                    </span>
                    {bitcoinAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    )}
                  </div>
                  {bitcoinAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl px-3.5 py-3">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(bitcoinAddress, 6)}
                      </span>
                      <button
                        onClick={() => setBitcoinAddress(null)}
                        className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={connectBitcoin}
                        disabled={btcLoading}
                        className="w-full text-left px-3.5 py-3 bg-[var(--bg-secondary)] rounded-xl text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {btcLoading ? "Connecting..." : "Connect Xverse"}
                      </button>
                      {btcError && (
                        <p className="text-[11px] text-red-500 px-1 mt-1">{btcError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Status footer */}
                {bothConnected && (
                  <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      Both identities verified
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
