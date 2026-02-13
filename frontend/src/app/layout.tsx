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
  title: "GhostSats | Bitcoin's Privacy Layer on Starknet",
  description: "Private USDC-to-WBTC execution with real on-chain ZK proof verification via Garaga. Noir circuits, Pedersen commitments, gasless relayer. Secrets never touch calldata.",
  metadataBase: new URL("https://ghostsats.vercel.app"),
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "GhostSats | Bitcoin's Privacy Layer on Starknet",
    description: "Private USDC-to-WBTC execution with real on-chain ZK proof verification via Garaga. Noir circuits, Pedersen commitments, gasless relayer.",
    siteName: "GhostSats",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostSats | Bitcoin's Privacy Layer on Starknet",
    description: "Real ZK proofs verified on-chain. Private USDC-to-WBTC execution on Starknet.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
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
