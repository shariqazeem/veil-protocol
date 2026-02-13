#!/bin/bash
# Build the relayer Docker image with circuit artifacts
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Copy VK (only artifact needed for /calldata endpoint)
echo "Copying circuit verification key..."
rm -rf circuits
mkdir -p circuits/target/vk
cp ../circuits/ghostsats/target/vk/vk circuits/target/vk/vk

echo "Building Docker image..."
docker build -t ghostsats-relayer .

# Cleanup
rm -rf circuits

echo ""
echo "Done! Run with:"
echo "  docker run -p 3001:3001 \\"
echo "    -e PRIVATE_KEY=0x... \\"
echo "    -e ACCOUNT_ADDRESS=0x... \\"
echo "    -e POOL_ADDRESS=0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af \\"
echo "    ghostsats-relayer"
