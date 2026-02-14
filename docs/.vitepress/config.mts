import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Veil Protocol",
  description: "Bitcoin's Privacy Layer on Starknet — ZK proofs, Pedersen commitments, gasless withdrawals",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#FF5A00" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/what-is-veil-protocol" },
      { text: "Technical", link: "/technical/zk-integration" },
      { text: "App", link: "https://theveilprotocol.vercel.app/app" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/shariqazeem/veil-protocol" },
          { text: "Explorer", link: "https://sepolia.voyager.online/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af" },
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
      message: "Built for Re{define} Starknet Hackathon 2026",
      copyright: "MIT License",
    },
    search: {
      provider: "local",
    },
  },
});
