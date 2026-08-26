# I-03 — Token-weighted quorum (accepted)

**Severity**: Informational  
**Status**: Accepted (documentation only; no voting-math change)  
**Location**: `Chamber.isDirector` / `_isDirector`; `Wallet` confirmations keyed by `tokenId`; `Board._getQuorum` / `getQuorum`

## Finding

`isDirector` and transaction confirmations are per membership `tokenId`, not per owner address. A single address that holds `quorum` distinct top-seat membership NFTs can submit, self-confirm (once per NFT), and execute.

This can look like a 1-of-1 treasury if NFT ownership is concentrated.

## Disposition

This is the intended model: quorum is **token-weighted** (NFT-weighted), not 1-address-1-vote. Voting math is unchanged and confirmations are **not** capped per owner.

An address holding `quorum` top-seat membership NFTs is a **single-actor treasury**. Deployers and members should treat concentrated NFT ownership as equivalent to a single signer.

NatSpec on `isDirector` and `getQuorum` records the same assumption next to the code.
