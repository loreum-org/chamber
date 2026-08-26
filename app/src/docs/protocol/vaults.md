# How the treasury (vault) works

Each Chamber is a **tokenized vault** (ERC‑4626). That is a standard way to say: **deposit one token, get share tokens** that represent your fraction of the pool.

If you only know multisigs: a Safe **holds** tokens but does not issue **shares** that track membership in the group. Chamber does both — treasury **and** transferable **membership in the pot**.

## Deposit and withdraw

| Action | What happens |
|--------|----------------|
| **Deposit** | You send the Chamber’s **underlying ERC‑20** (for example USDC) into the contract. You receive **Chamber share tokens**. |
| **Withdraw / Redeem** | You burn shares and receive underlying back (subject to vault liquidity). |

Share price follows ERC‑4626 math: as the vault earns or holds more underlying per share, each share represents a larger claim.

## Shares vs delegation

- **Shares** = your economic stake in the treasury.  
- **Delegation** = how much of that stake you assign to **NFT token IDs** on the board.

You can hold shares **without** delegating. You cannot delegate **more than your share balance**.

## Why you must undelegate before moving shares

The contract blocks transfers that would leave you with **fewer free shares than you have delegated**. That prevents “double spending” influence — assigning the same shares to leaders while also selling them.

**Practical rule:** want to withdraw or transfer? **Undelegate first**, then move shares.

## ETH and NFTs sent to the Chamber

These paths are **not** vault deposits — they do not mint shares or change board seats.

- **ETH** sent to the Chamber address is accepted (`receive` / payable `fallback`) for donations or gas.
- **Any ERC‑721** can be received via `safeTransferFrom`. `onERC721Received` does **not** whitelist the membership collection. Chamber is meant to **custody arbitrary ERC‑721s** the same way a Safe holds NFTs. Directors move them out through the **proposal queue** (wallet `executeTransaction`).
- **ERC‑1155 is not accepted.** There is no `onERC1155Received` / `onERC1155BatchReceived`. An ERC‑1155 `safeTransferFrom` to the Chamber **reverts**.

## Safety note (first depositor attacks)

The implementation uses a **decimals offset** (virtual shares) to reduce classic ERC‑4626 inflation attacks on empty or tiny vaults. Integrators should still follow ERC‑4626 best practices.

## Read next

- **[Getting started](../introduction/getting-started.md)** — deposit in the app  
- **[Governance](./governance.md)** — delegation and seats  
- **[Why not just a multisig?](../introduction/why-not-multisig.md)**  
