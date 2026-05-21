# Deploying Chambers (for operators)

> **Audience:** developers and operators running Foundry scripts. End users normally create Chambers through the app’s **Deploy** page — see **[Getting started](../introduction/getting-started.md)**.

Contracts live in **`contracts/`**. Production-shaped deploys use the **Registry**, which pins a Chamber **implementation** and exposes **`createChamber`**.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)  
- RPC URL and funded deployer key  
- Optional: block explorer API key for verification  

```bash
cd contracts
forge install
```

## What Registry deploy does

`script/Registry.s.sol` (via `DeployRegistry` helper):

1. Deploy **Registry** implementation.  
2. Deploy **Chamber** implementation.  
3. Deploy **Registry proxy** with `initialize(chamberImplementation, admin)`.  
4. Return the **Registry address** your app should use (`VITE_*_REGISTRY` env vars).

Each **`createChamber`** then:

- Spawns a **Chamber proxy** initialized with your ERC‑20, ERC‑721, seats, name, symbol.  
- Transfers **ProxyAdmin ownership** to the Chamber (upgrades go through director queue).  
- Optionally links **parent/child** if the asset token is another registered Chamber.

Example:

```bash
cd contracts
forge script script/Registry.s.sol:DeployRegistry \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

Set **`ADMIN`** in the environment if the admin should not be `msg.sender`.

## Standalone Chamber script (local only)

`script/Chamber.s.sol` deploys a Chamber proxy **without** Registry semantics (ProxyAdmin may stay with a separate admin EOA). Prefer **Registry** for production documentation and the app.

## App configuration

Point the frontend at your Registry and mocks:

- `VITE_SEPOLIA_REGISTRY`, `VITE_SEPOLIA_CHAMBER_IMPL`, mock token addresses, etc.  
- See **`app/README.md`** and repo deployment docs under **`docs/guides/deployment.md`** if present at monorepo root.

## Read next

- **[Architecture](../protocol/architecture.md)**  
- **[API reference](../reference/api-reference.md)**  
- **[Getting started](../introduction/getting-started.md)** — user-facing deploy wizard  
