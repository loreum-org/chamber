# Governance

Chamber governance is **numeric**: share holders assign weight to **membership NFT token IDs**; the highest-weight IDs occupy **`seats`** positions; those token owners (EOA or EIP‑1271 contract wallet, see `Chamber._isDirector`) act as directors on the multisig queue.

## Delegation rules

- **`delegate(tokenId, amount)`** increases weight for **`tokenId`** and increases **`totalHolderDelegations[msg.sender]`**; it cannot exceed the holder’s Chamber **share balance** (`balanceOf`).  
- **`undelegate`** reduces accounting and updates the leaderboard when the **`Board`** node still exists (evicted/minimal delegation edge cases handled in **`Chamber.undelegate`**).  
- **Invalid or burned NFT IDs** revert on delegate; **`getDirectors`** maps top token IDs to **`ownerOf`** and yields **`address(0)`** if ownership resolution fails.  

## Director set

At any block:

1. Read **`getSeats()`** as **`N`**.  
2. Take the first **`N`** token IDs from **`getTop(N)`** (sorted by delegated amount, descending).  
3. **`isDirector(tokenId)`** requires **`msg.sender`** to control **`nft.ownerOf(tokenId)`** (including ERC‑1271) **and** **`tokenId`** to appear in that prefix of the leaderboard.  

## Quorum (wallet)

Quorum is **not** “majority of directors.” It is defined in **`Board._getQuorum`** as:

\[
\text{quorum} = 1 + \lfloor \text{seats} \times 51 / 100 \rfloor
\]

Matching Solidity: **`1 + (seats * 51) / 100`**.

Examples:

| Seats | Quorum |
|------:|-------:|
| 3 | 2 |
| 5 | 3 |
| 7 | 4 |
| 20 | 11 |

Each **distinct director `tokenId`** may confirm at most once per transaction. **Submit** auto-confirms for the submitter’s **`tokenId`**.

## Seat count changes

- **Initial `seats`** are set in **`initialize`**.  
- After that, **`updateSeats(proposerTokenId, newSeats)`** starts or adds support to a **`SeatUpdate`**: backers must propose the **same** `newSeats` integer; **`requiredQuorum`** is snapped at proposal creation time.  
- **`executeSeatsUpdate`** succeeds only after a **7 day** delay **and** if at least **`requiredQuorum`** of the recorded **`supporters`** are **still directors**—i.e., their token IDs remain in the **`getTop(getSeats())`** prefix at execution time.  
- The **initial proposer** may cancel-and-reopen a proposal by **`updateSeats`** with a differing seat count (`OnlyProposerCanCancel` guard when supporters already exist)—see **`Board._setSeats`**.  

## Transaction cancellation

**`cancelTransaction(tokenId, transactionId)`** records cancel votes. When **`cancelConfirmations` reaches quorum**, the nonce becomes **cancelled** and cannot accumulate further confirmations. This is orthogonal to confirmations for execution.

## Sub-chamber hierarchy

If **`Registry.createChamber`** is called with **`erc20Token`** equal to an existing chamber address, **`Registry`** records **parent ↔ child** links (`getParentChamber`, `getChildChambers`). This models organizations whose **underlying asset is another Chamber’s share token**.

## Interfaces

Governance-heavy methods are surfaced on **`IChamber`** (which extends **`IBoard`**, **`IWallet`**, **`IERC4626`**). Prefer reading NatSpec alongside this document.
