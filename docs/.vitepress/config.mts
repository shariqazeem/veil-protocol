import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Veil Protocol",
  description: "Re{defining} Privacy on Starknet — ZK proofs, AI strategy agent, x402 micropayments, Starkzap social login",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#4D4DFF" }],
  ],
  appearance: false,
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/what-is-veil-protocol" },
      { text: "Technical", link: "/technical/zk-integration" },
      { text: "Launch App", link: "https://theveilprotocol.vercel.app/app" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/shariqazeem/veil-protocol" },
          { text: "Explorer", link: "https://voyager.online/contract/0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38" },
          { text: "Telegram Bot", link: "https://t.me/VeilProtocolBot" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "What is Veil Protocol?", link: "/guide/what-is-veil-protocol" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Privacy Model", link: "/guide/privacy-model" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Telegram Bot", link: "/guide/telegram-bot" },
          { text: "AI Strategist", link: "/guide/ai-strategist" },
        ],
      },
      {
        text: "Technical",
        items: [
          { text: "ZK Integration", link: "/technical/zk-integration" },
          { text: "Architecture", link: "/technical/architecture" },
          { text: "Smart Contracts", link: "/technical/smart-contracts" },
          { text: "Prover & Relayer", link: "/technical/prover-relayer" },
          { text: "Testing", link: "/technical/testing" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Deployed Contracts", link: "/technical/deployed-contracts" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/shariqazeem/veil-protocol" },
    ],
    footer: {
      message: "Re{defining} Privacy on Starknet — Re{define} Hackathon 2026",
      copyright: "MIT License",
    },
    search: {
      provider: "local",
    },
  },
});
