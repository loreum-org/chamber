# Getting started — create, stake, delegate, and use a Chamber

This guide follows the **[Chamber web app](../guides/app-routes.md)** step by step: how to **deploy** a Chamber, **stake** (deposit) treasury assets into it, **delegate** share weight toward member NFTs so a board forms, and **use** governance once you are routed that way.

For the big picture first, skim **[Overview](./overview.md)**.

---

## Before you begin

1. **Connect your wallet** (header control) on a network where the **Registry** and any Chamber deployments are configured for this build (see **[Deployment](../guides/deployment.md)** for env vars).
2. There are three main ideas on-chain:
   - **Chamber share tokens** (from the vault) — weight you delegate.
   - **Membership NFTs** (ERC‑721) — specific **token IDs** that can receive delegation and rank on the board.
   - **Director queue** — outbound actions need **submit → confirm to quorum → execute** once you hold a seated member ID.

Optional query parameters on Deploy can **prefill** token addresses:

`/deploy?erc20=0x…&erc721=0x…`

On networks that expose mock addresses in env, those may also prefill automatically when the fields are empty.

---

## 1. Create (deploy) a Chamber

**Route:** `/deploy` (details in **[App routes](../guides/app-routes.md)**).

Deploy calls the **Registry**. A new Chamber is created as an **upgradeable proxy** wired through **`Registry`** — the production expectation; see Deployment guide for scripts vs app.

### What you configure in the wizard

| Field | Role |
|--------|------|
| **ERC‑20 address** | The **underlying asset** held in the Chamber vault (e.g. a stablecoin or treasury token). |
| **ERC‑721 address** | The **membership NFT** collection whose **token IDs** appear on the delegation leaderboard. |
| **Seats** | How many **top‑weighted token IDs** count as director seats (**1–20** in contracts). Initial **quorum** in the UI follows majority-of-seats framing (shown on review — e.g. `1 + ⌊seats × 51%⌋`). |
| **Name / Symbol** | Human-readable labels for Chamber **share** tokens surfaced by ERC‑4626. |

Steps in the UI: fill the form → **Review & Deploy** → confirm the transaction → on success use **Go to Dashboard** or **Deploy Another**.

The new Chamber appears on the Dashboard once indexed from the Registry.

---

## 2. Open and use your Chamber from the Dashboard

**Route:** Dashboard **`/`** → choose a Chamber → **`/chamber/:address`** (canonical **Overview**). Same route table: **[App routes](../guides/app-routes.md)**.

The chamber header summarizes **vault size**, **seats**, **quorum**, and shortcuts to:

- **`/chamber/:address/transactions`** — **proposal queue** (submit, confirm, execute).
- Tabs: **Overview**, **Board**, **Staking**, **Delegation**.

**Board** ranks members by delegated weight so you can see who currently occupies the **top N seats**. **Director profile** deeplinks: **`/chamber/:address/director/:tokenId`**.

Until someone has delegated weight to member IDs that fill those seats, the UI shows that there are **no directors yet**.

---

## 3. Stake — deposit underlying, receive Chamber shares

**Tab:** **Staking** (`/chamber/:address/staking`)

In the contracts this is ERC‑4626-style **deposit** (sometimes called “staking” in the UI): you lock the Chamber’s configured **underlying ERC‑20** and receive **Chamber share tokens** proportional to vault pricing.

Typical sequence:

1. Ensure your wallet holds enough **underlying** token.
2. **Approve** the Chamber contract when the UI asks (spender = Chamber vault address).
3. Use **Deposit** (underlying out of your wallet, Chamber **shares** in). Use **Withdraw** when you want underlying back.
4. Check **Overview → Quick Actions** or the chamber header for **Your Balance** in **shares**.

**Delegation is limited by your Chamber share balance** — only shares you effectively control can move into delegation.

Invariants are spelled out in **[Vault](../protocol/vaults.md)**.

---

## 4. Delegate share weight toward member NFTs

**Tab:** **Delegation** (`/chamber/:address/delegation`)

You point some or all of your **undelegated** Chamber share balance at one or more **membership NFT token IDs** (the ERC‑721 the Chamber was created with):

- Increasing delegation to ID **42** strengthens **member #42** on the leaderboard.
- **Board** recomputes: the **top `seats`** token IDs are the **directors**.
- Undo or adjust allocations with **undelegate** / UI controls as exposed.

Director-only actions (**Transactions** flows) unlock when your connected wallet proves control (**EOA** or **[EIP‑1271](https://eips.ethereum.org/EIPS/eip-1271)** contract wallets) over an NFT token ID currently in **top seats**.

For formulas, quorum, and cancellations, **[Governance](../protocol/governance.md)**.

---

## 5. Use governance — propose, confirm, execute

**Route:** **`/chamber/:address/transactions`**

Rough lifecycle:

1. **Submit** — choose `target`, optional ETH `value`, and calldata. The hash is recorded; callers must reuse the exact calldata to execute later.
2. **Confirm** — other seated directors attest until quorum is satisfied.
3. **Execute** — anyone allowed by contract rules submits the matching calldata path so **`keccak256(data)`** matches storage.

Optional metadata-bearing flows may expose URIs once proposals use **`submitTransactionWithMetadata`**.

Sharper multisig UX detail: **[Wallet / multisig behavior](../protocol/multisig.md)**.

---

## Short mental model

| Goal | Where in the app |
|------|------------------|
| Spawn a treasury + board ruleset | **`/deploy`** |
| Earn voting weight | **Staking** (deposit underlying → Chamber shares) |
| Elect who leads | **Delegation** toward NFT token IDs; watch **Board** |
| Spend treasury / call contracts on-chain | **Transactions** |

---

## Read next

- **[Overview](./overview.md)** — product framing  
- **[App routes](../guides/app-routes.md)** — URL map  
- **[Governance](../protocol/governance.md)**  
- **[Vault](../protocol/vaults.md)**  
- **[Deployment](../guides/deployment.md)**  
