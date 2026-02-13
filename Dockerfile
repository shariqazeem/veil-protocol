# GhostSats Relayer + Calldata Server
#
# Browser generates ZK proof (noir_js + bb.js WASM).
# This server only converts proof binary → garaga calldata.
# Secrets NEVER reach this server.
#
# Endpoints:
#   POST /calldata — proof binary → garaga felt252 calldata (no secrets)
#   POST /relay    — gasless withdrawal submission
#   GET  /health   — health check
#   GET  /info     — relayer info

FROM node:20-slim

# Install Python 3 for garaga
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install garaga (proof → Starknet calldata converter)
RUN pip3 install --break-system-packages garaga==1.0.1

WORKDIR /app

# Copy and install Node.js deps
COPY scripts/package.json ./
RUN npm install --production

# Copy relayer source
COPY scripts/relayer.ts scripts/tsconfig.json ./

# Copy VK (verification key) — the only circuit artifact needed
COPY circuits/ghostsats/target/vk/ ./circuits/target/vk/

# Environment
ENV GARAGA_BIN=/usr/local/bin/garaga
ENV CIRCUITS_DIR=/app/circuits
ENV RELAYER_PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npx", "ts-node", "--esm", "relayer.ts"]
