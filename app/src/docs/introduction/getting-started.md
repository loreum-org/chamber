# Getting started

This guide matches the **Chamber web app** routes in `app/src/App.tsx`: Dashboard, Deploy, per‑chamber views, transaction queue, director profile, and in-app docs.

## Connect a wallet

Use the app’s wallet connect control in the header. You need a browser wallet (e.g. MetaMask) on a network where the **Registry** and your Chamber are deployed.

## Explore chambers

**Route:** `/` (Dashboard)

The dashboard lists chambers the app discovers from the configured **Registry** (see app environment / chain setting). Each row links into a chamber’s detail view.

## Open a chamber

**Route:** `/chamber/:address`  
**Optional tab:** `/chamber/:address/:tab`

From a chamber you can:

- Inspect vault stats, directors, delegation leaderboard, and seat settings (tabs depend on the current UI).  
- **Deposit / withdraw** underlying assets (ERC‑4626 `deposit` / `withdraw` / `mint` / `redeem` flow in the contract).  
- **Delegate** Chamber share balance toward membership **token IDs** you support.  

If you own (or control via EIP‑1271) a token ID in the current top **`getSeats()`** leaderboard positions, wallet actions gated as “director” will be available (submit/confirm/execute transactions, seat proposals where exposed).

## Transactions

**Route:** `/chamber/:address/transactions`

Directors cooperate on the on-chain queue:

1. **Submit** — provides `target`, ETH `value`, and `data`; submitter gets the first confirmation.  
2. **Confirm** — other directors add confirmations until **`getQuorum()`** is reached.  
3. **Execute** — any director passes the **same calldata** as at submit time so the contract can verify **`keccak256(data)`**.

The UI should surface **metadata URIs** when proposals used **`submitTransactionWithMetadata`**.

## Director profile

**Route:** `/chamber/:address/director/:tokenId`

Useful for linking to or inspecting a specific membership token’s participation context (delegation and director status vary with leaderboard state).

## Deploy a new chamber (app)

**Route:** `/deploy`

The Deploy flow gathers:

- Underlying **ERC‑20** (vault asset).  
- **Membership ERC‑721**.  
- Initial **seat count** (contracts enforce **1–20**).  
- **Name** and **symbol** for Chamber **share tokens** (ERC‑20 surfaced by ERC‑4626).  

Behind the scenes, production setups should use **`Registry.createChamber`** so **ProxyAdmin** ownership lands on the Chamber proxy according to **`Registry.sol`**; standalone deploy scripts behave differently—see **[Deployment](../guides/deployment.md)**.

## Documentation in the app

**Route:** `/docs` and `/docs/...`

This documentation tree is loaded from **`app/src/docs/**/*.md`**.

## Read next

- **[Governance concepts](../protocol/governance.md)**  
- **[Vault mechanics](../protocol/vaults.md)**  
- **[Multisig / Wallet behavior](../protocol/multisig.md)**  
- **[API reference](../reference/api-reference.md)**  
