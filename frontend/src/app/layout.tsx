import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StarknetProvider } from "@/components/StarknetProvider";
import { WalletProvider } from "@/context/WalletContext";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veil Protocol | Confidential Bitcoin Accumulation on Starknet",
  description: "Institutional-grade confidential Bitcoin accumulation infrastructure. STARK-verified ZK proofs, tranche-based privacy pools, and intent-based BTC settlement on Starknet.",
  metadataBase: new URL("https://theveilprotocol.vercel.app"),
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Veil Protocol | Confidential Bitcoin Accumulation on Starknet",
    description: "Treasury-grade Bitcoin accumulation layer built on Starknet's quantum-secure STARK infrastructure. On-chain ZK verification via Garaga.",
    siteName: "Veil Protocol",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veil Protocol | Confidential Bitcoin Accumulation on Starknet",
    description: "Confidential Bitcoin accumulation infrastructure. STARK-verified proofs, tranche-based privacy, intent-based settlement.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <StarknetProvider>
          <WalletProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </WalletProvider>
        </StarknetProvider>
      </body>
    </html>
  );
}
