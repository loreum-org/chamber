---
name: "consensus-tx-identity-invariants"
description: "L1 trigger - audits replay protection, transaction identity binding, and cross-layer uniqueness."
---

# Injectable Skill: Consensus Tx Identity Invariants

> **L1 trigger**: `CONSENSUS` flag AND (`txid`, `tx_hash`, `nonce`, `sequence`, `signature`, `message_id` detected across modules)
> **Inject Into**: `depth-consensus-invariant`, `depth-state-trace`
> **Language**: Go and Rust
> **Finding prefix**: `[TXI-N]`

## 1. Identity Definition

Determine what uniquely identifies a transaction in each layer:

- explicit nonce / sequence
- hash of body
- hash of signed payload
- envelope ID distinct from execution payload ID

Tag: `[TX-ID:DEFINITION]`

## 2. Replay Protection

For every submission path, ask what value changes to prevent replay and whether
it is monotonic, chain-bound, and sender-bound. Flag replay surfaces on the
same chain, across forks, or across layers.

Write the answer as a table:

| Tx Type | Replay-unique field | Sender-bound? | Chain-bound? | Expiry / bound |
|---|---|---|---|---|

Tag: `[TX-ID:REPLAY]`

Mandatory enumeration:

1. List **every signed transaction/message type**, not only system
   transactions: user transactions, system transactions, commitments,
   block-level commitments, gossip messages, admin/config messages, and any
   wrapper/envelope format.
2. For each type, identify the replay guard: nonce, sequence, anchor,
   recent-block hash, expiry, chain ID, domain separator, or explicit consumed
   marker.
3. If no per-sender or per-message replay guard exists, emit a finding. Do not
   accept "outer EVM signature has chain_id" as sufficient unless the inner
   payload identity and all consensus effects are also covered by that exact
   signature domain.
4. Check same-chain replay, cross-fork replay, cross-layer replay, and
   re-inclusion after reorg separately.

## 3. ID / Signature Binding

Verify that the provided ID equals the hash of the signed content and that the
signature covers the exact bytes later used for execution or persistence.

Questions:
1. Is the ID recomputed by the verifier, or trusted from peer input?
2. Does the signature sign the same bytes the ID is derived from?
3. If the ID and signature are derived from different byte domains, can the
   content change while one of them stays stable?

Mandatory binding table:

| Object | Claimed ID field | Recomputed from | Signature covers | Persistence key | Mismatch possible? |
|---|---|---|---|---|---|

Apply it to blocks, transactions, commitments, and any included commitment
list. If a block/tx/commitment ID is accepted from peer input without
recomputing it from the signed bytes, emit a finding.

Tag: `[TX-ID:BINDING]`

## 4. Cross-Layer Consistency

Trace the transaction through admission, mempool, consensus inclusion,
execution, and indexing. All layers must agree on nonce / chain identifier /
sender identity / canonical ID.

If a wrapper transaction carries an inner transaction or message, verify the
wrapper ID is tied to the inner payload identity instead of being an unrelated
field.

Tag: `[TX-ID:CROSS-LAYER]`
