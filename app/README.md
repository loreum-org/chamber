# Chamber App

A decentralized treasury governance application for the Chamber Protocol. This application serves as a Gnosis Safe-like interface for managing multi-signature treasury operations with board-based governance.

## Features

- **Deploy Chambers**: Create new treasury governance instances via the Registry
- **Board Visualization**: Beautiful graphical representation of board members and their voting power
- **Transaction Queue**: Submit, confirm, and execute multi-signature transactions
- **Treasury Management**: Deposit/withdraw assets using ERC4626 vault mechanics
- **Delegation System**: Delegate voting power to NFT holders to compete for board seats

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **wagmi v2** + **viem** for Ethereum interactions
- **RainbowKit v2** for wallet connection
- **TanStack Query** for data fetching
- **Tailwind CSS** for styling
- **Framer Motion** for animations

## Design

The application features a "Futuristic Western Civilization" design aesthetic:
- Dark theme with marble and gold accents
- Classical architectural elements (columns, pediments)
- Modern glowing effects and gradients
- Serif typography for headers, sans-serif for content

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm

### Installation

```bash
cd app
npm install
```

### Configuration

1. Update the WalletConnect Project ID in `src/lib/wagmi.ts`:
   ```typescript
   projectId: 'YOUR_WALLETCONNECT_PROJECT_ID'
   ```

2. Update contract addresses for your deployment in `src/lib/wagmi.ts`:
   ```typescript
   export const CONTRACT_ADDRESSES = {
     sepolia: {
       registry: '0x...',
       chamberImplementation: '0x...',
     },
     // ...
   }
   ```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

## Project Structure

```
app/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Layout.tsx
│   │   ├── ChamberCard.tsx
│   │   ├── BoardVisualization.tsx
│   │   ├── TreasuryOverview.tsx
│   │   └── DelegationManager.tsx
│   ├── contracts/       # Contract ABIs
│   ├── hooks/           # Custom React hooks
│   │   ├── useChamber.ts
│   │   └── useRegistry.ts
│   ├── lib/             # Utilities and config
│   │   ├── wagmi.ts
│   │   └── utils.ts
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── DeployChamber.tsx
│   │   ├── ChamberDetail.tsx
│   │   └── TransactionQueue.tsx
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Key Functionality

### Chamber Management
- View all deployed chambers
- Deploy new chambers with custom parameters
- View chamber details (assets, board, transactions)

### Board Governance
- Visual representation of board seats in a semi-circular "senate" layout
- Leaderboard showing all members ranked by delegated voting power
- Directors are the top N members (where N = number of seats)

### Transaction Queue (Safe-like)
- Submit new transactions (ETH transfers, token transfers, custom calls)
- View pending transactions awaiting confirmations
- Confirm transactions as a director
- Execute transactions once quorum is reached
- View transaction history

### Treasury (ERC4626 Vault)
- Deposit assets to receive shares
- Withdraw assets by burning shares
- View share/asset ratio
- Track total assets and supply

### Delegation
- Delegate shares to NFT token IDs
- Undelegate to reclaim voting power
- View your active delegations
- Locked shares cannot be transferred

## Contract Integration

The app integrates with the following contracts:

- **Registry**: Factory for deploying new Chambers
- **Chamber**: Main contract combining:
  - ERC4626 vault for asset management
  - Board governance for director elections
  - Wallet multisig for transaction execution

## License

MIT
