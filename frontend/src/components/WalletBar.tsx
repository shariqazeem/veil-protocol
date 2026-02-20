"use client";

import { useAccount, useConnect, useDisconnect, type Connector } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useEffect, useState, useRef } from "react";
import { Shield, Bitcoin, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isMainnet } from "@/utils/network";

function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function WalletBar() {
  const { connect, connectors, error: connectError, isPending: connectPending, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { starknetAddress, bitcoinAddress, setStarknetAddress, setBitcoinAddress, setBitcoinPublicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState<string | null>(null);
  const [snConnecting, setSnConnecting] = useState(false);
  const [snError, setSnError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStarknetAddress(isConnected && address ? address : null);
  }, [address, isConnected, setStarknetAddress]);

  // Clear connecting state when wallet actually connects
  useEffect(() => {
    if (isConnected && address) {
      setSnConnecting(false);
      setSnError(null);
    }
  }, [isConnected, address]);

  async function handleStarknetConnect(connector: Connector) {
    setSnError(null);
    setSnConnecting(true);

    try {
      // Pre-enable the wallet via legacy enable() API to trigger the popup.
      // The modern SNIP-1193 request({ type: "wallet_requestAccounts" }) hangs
      // on some wallet versions, but enable() is widely supported.
      const walletKey = `starknet_${connector.id}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const walletObj = (window as any)[walletKey];

      if (walletObj?.enable) {
        await Promise.race([
          walletObj.enable({ starknetVersion: "v5" }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 12000)),
        ]);
      }

      // Wallet is now enabled — connect through starknet-react
      // (request() should resolve immediately since wallet is pre-approved)
      resetConnect();
      connect({ connector });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "TIMEOUT") {
        setSnError("Wallet didn't respond. Make sure it's unlocked and try again.");
      } else {
        setSnError(msg);
      }
      setSnConnecting(false);
    }
  }

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
          message: "Veil Protocol: Verify your Bitcoin identity",
          network: { type: isMainnet ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet4 },
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
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3.5 sm:py-4 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* Wordmark */}
        <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          Veil<span className="text-[var(--accent-orange)]"> Protocol</span>
        </span>

        {/* Identity Pill */}
        <div ref={ref} className="relative">
          <motion.button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-0 rounded-full bg-[var(--bg-secondary)] border overflow-hidden cursor-pointer transition-all duration-300 ${
              bothConnected
                ? "border-[var(--accent-emerald)]/30 shadow-[0_0_20px_rgba(52,211,153,0.1)]"
                : "border-[var(--border-medium)] hover:border-[var(--border-bright)]"
            }`}
            whileTap={{ scale: 0.97 }}
            transition={spring}
          >
            {/* Starknet side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-2.5 border-r border-[var(--border-subtle)]">
              <Shield size={13} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              {starknetAddress ? (
                <>
                  <span className="text-[11px] sm:text-[13px] font-medium text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(starknetAddress, 3)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
                </>
              ) : (
                <span className="text-[11px] sm:text-[13px] font-medium text-[var(--text-tertiary)]">SN</span>
              )}
            </div>

            {/* Bitcoin side */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-2.5">
              <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              {bitcoinAddress ? (
                <>
                  <span className="text-[11px] sm:text-[13px] font-medium text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]">
                    {truncateAddress(bitcoinAddress, 3)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
                </>
              ) : (
                <span className="text-[11px] sm:text-[13px] font-medium text-[var(--text-tertiary)]">BTC</span>
              )}
            </div>
          </motion.button>

          {/* If neither connected */}
          {!starknetAddress && !bitcoinAddress && (
            <div className="absolute -bottom-6 right-0 text-[12px] text-[var(--text-tertiary)] whitespace-nowrap flex items-center gap-1">
              <Zap size={10} strokeWidth={2} className="text-[var(--accent-orange)]" />
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
                className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-medium)] shadow-xl p-4 sm:p-5 z-50"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">
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
                    <Shield size={13} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                    <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                      Starknet
                    </span>
                    {starknetAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
                    )}
                  </div>
                  {starknetAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded-xl px-3.5 py-3 border border-[var(--border-subtle)]">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(starknetAddress, 6)}
                      </span>
                      <button
                        onClick={() => disconnect()}
                        className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {connectors.map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => handleStarknetConnect(connector)}
                          disabled={snConnecting || connectPending}
                          className="w-full text-left px-3.5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-orange)]/30 rounded-xl text-[13px] font-medium text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {(snConnecting || connectPending) ? "Connecting..." : connector.name}
                        </button>
                      ))}
                      {(snError || connectError) && (
                        <p className="text-[12px] text-[var(--accent-red)] px-1 mt-1">
                          {snError || connectError?.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Separator */}
                <div className="h-px bg-[var(--border-subtle)] mb-5" />

                {/* Bitcoin Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Bitcoin size={13} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                    <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                      Bitcoin <span className="text-[var(--text-tertiary)]">(optional)</span>
                    </span>
                    {bitcoinAddress && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
                    )}
                  </div>
                  {bitcoinAddress ? (
                    <div className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded-xl px-3.5 py-3 border border-[var(--border-subtle)]">
                      <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)]">
                        {truncateAddress(bitcoinAddress, 6)}
                      </span>
                      <button
                        onClick={() => setBitcoinAddress(null)}
                        className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={connectBitcoin}
                        disabled={btcLoading}
                        className="w-full text-left px-3.5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-orange)]/30 rounded-xl text-[13px] font-medium text-[var(--text-primary)] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {btcLoading ? "Connecting..." : "Connect Xverse"}
                      </button>
                      {btcError && (
                        <p className="text-[12px] text-[var(--accent-red)] px-1 mt-1">{btcError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Status footer */}
                {bothConnected && (
                  <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
                    <span className="text-[12px] text-[var(--accent-emerald)] font-medium">
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
