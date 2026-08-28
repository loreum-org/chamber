# Getting Started

Welcome to the Loreum Chamber! This guide will help you get started with deploying and using the protocol.

## 🚀 Quick Start

### 1. Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation.html) for smart contract development.
- Node.js and npm for the frontend application.

### 2. Local Development
Clone the repository and install dependencies:
```bash
git clone https://github.com/loreum-org/chamber
cd chamber
make install
```

### 3. Deploying a Chamber
You can deploy a Chamber through the `Registry` contract. A Chamber requires:
- An **ERC20 Token** for governance (e.g., LOREUM).
- An **ERC721 NFT** for membership (e.g., Chamber Pass).
- A **Number of Seats** (1-20) for the Board of Directors.

### 4. Basic Workflow
1. **Seat the board**: Factory create leaves the board empty. The creator must hold a membership NFT, deposit shares, and delegate. Director rights unlock after `SEATING_DELAY` (1 block). See the app guide: `app/src/docs/introduction/getting-started.md`.
2. **Deposit**: Users deposit ERC20 tokens into the Chamber to receive shares (ERC4626).
3. **Delegate**: Users delegate their voting power to specific NFT IDs.
4. **Govern**: The top N NFT holders (by delegation) become Directors.
5. **Execute**: Directors submit and confirm transactions to manage the treasury.

## 🎯 Next Steps

- **[Architecture Deep Dive](../protocol/architecture.md)**: Understand how the contracts work together.
- **[Deployment Guide](../guides/deployment.md)**: Steps to deploy to testnet or mainnet.
- **[API Reference](../reference/api-reference.md)**: Detailed function documentation.
