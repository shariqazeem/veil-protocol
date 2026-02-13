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

# Use Python 3.10 base (garaga requires >=3.10,<3.11)
FROM python:3.10-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install garaga (proof → Starknet calldata converter)
RUN pip install --no-cache-dir garaga==1.0.1

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
