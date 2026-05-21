# Design notes (advanced)

> **Audience:** integrators, auditors, and developers. New users should read **[What is a Chamber?](../introduction/overview.md)** and **[Governance](./governance.md)** first.

This page records **implementation choices** in `contracts/src/` that explain edge cases and gas tradeoffs.

## One contract per Chamber

Governance and vault logic share **one proxy address** (`TransparentUpgradeableProxy` → `Chamber` implementation). Users interact with a single `Chamber` for deposits, delegation, and the queue.

## Namespaced storage (ERC‑7201)

`Board`, `Wallet`, Chamber delegation fields, and `Registry` use **fixed storage slots** so upgrades are less likely to collide layouts accidentally.

## Board leaderboard

- Delegations accumulate per **membership NFT tokenId** in a **sorted linked list** (by weight, descending).  
- **`MAX_SEATS`** on Chamber: **20**; **`MAX_NODES`** on Board: **50** (more NFTs can exist on the list than active seats).  
- Links are **`uint128`** — token IDs above `2^128-1` cannot be inserted.  
- **`circuitBreaker`** on delegate/undelegate uses **transient storage** (EIP‑1153) to block reentrancy while reordering the list.

## Wallet: hash-only calldata

- Stored per proposal: `target`, `value`, `executed`, `confirmations`, **`bytes32 dataHash`**.  
- Execute paths require matching calldata; **`SubmitTransaction`** events carry full `bytes data` for offchain archives.

## Self-target calls

Calls where `target == Chamber` are limited to **`upgradeImplementation`** selector — arbitrary self-calls are rejected.

## Quorum formula

`getQuorum() = 1 + (getSeats() * 51) / 100` — integer math in Solidity.

## Seat update timelock

`executeSeatsUpdate` requires **7 days** and enough supporters who are **still directors** at execution time.

## Delegation vs transfers

`_update` enforces that share transfers cannot strand delegated weight (see **[Vault](./vaults.md)**).

## Further reading

- **[API reference](../reference/api-reference.md)**  
- **[Sequence diagrams](../reference/sequence-diagrams.md)**  
- **[Security review](../security/security-review.md)**  
