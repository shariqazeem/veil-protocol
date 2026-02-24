import type { NextConfig } from "next";

const RELAYER_BACKEND = process.env.RELAYER_BACKEND_URL ?? "http://141.148.215.239";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},

  // Proxy /api/relayer/* to the relayer backend (avoids mixed-content HTTPS→HTTP)
  async rewrites() {
    return [
      { source: "/api/relayer/:path*", destination: `${RELAYER_BACKEND}/:path*` },
    ];
  },

  // Webpack fallback config (used with --webpack flag)
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
