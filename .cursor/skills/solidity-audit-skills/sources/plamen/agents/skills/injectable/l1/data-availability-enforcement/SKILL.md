---
name: "data-availability-enforcement"
description: "L1 supplement - audits storage / data-availability chains (Arweave / Celestia-class) for unenforced data commitments: producer commits to data inclusion but the validator never verifies the data was actually published / gossiped / sampled."
---

# Injectable Skill: Data Availability Enforcement

> **L1 trigger**: `L1_PATTERN=true` AND protocol-type is one of: storage, data_availability, da_chain, da_layer, blob_storage. Detection: recon finds a "publish ledger", "data root", "blob commitment", "DA root", or "ingress proof" structure in the block header AND the protocol's economic model assumes miners store data.
> **Inject Into**: `depth-consensus-invariant`, `depth-state-trace`
> **Language**: Go and Rust
> **Finding prefix**: `[DA-N]`
> **Status**: v0.1 — derived from a prior DA-chain audit post-mortem

## When This Skill Activates

Data availability chains are L1s whose primary function is to commit to and serve user data, not just to settle transactions. Examples: Arweave (permanent storage), Celestia (rollup blob DA). The trust model is fundamentally different from settlement L1s: validators must enforce that **committed data is actually available**, not just that the commitment is well-formed.

The single most common DA-chain bug class is: **the block header carries a commitment to data X, the producer is paid for committing to X, but nothing in the protocol forces the producer to actually publish X.** Honest miners assigned to store X cannot, get penalized, and the chain becomes unreliable.

## 1. Commitment Inventory

Enumerate every block-header field that commits to data the protocol expects to be stored elsewhere:

- "Publish ledger" / "Submit ledger" / "DA root" / "blob commitment" / "data root"
- "Ingress proof root" / "chunk merkle root"
- "Replication committee assignments" / "partition assignments"

For each, identify:
1. The exact field path in the block header struct
2. The economic action attached to inclusion (reward, partition assignment, slashing trigger)
3. The set of actors expected to store the committed data after inclusion

Write the inventory to `scratchpad/da_commitment_inventory.md`.

## 2. Availability Check Audit

For EACH commitment in the inventory, the validator must enforce that the data is actually available. Three valid mechanisms:

### 2a. Sample-and-prove (Celestia / DAS)
- Validator picks K random chunks of the committed data
- Verifies each chunk's Merkle proof against the committed root
- Accepts only if all K chunks return valid proofs within timeout
- **Check**: random chunk selection (not attacker-influenceable), K large enough for security target, timeout bounded

### 2b. Full retrieval (Arweave-style)
- Validator downloads the entire committed data from a peer claiming to host it
- Hashes and compares against the commitment
- **Check**: peer selection is permissionless (not just from producer's peer list), retrieval timeout bounded, fallback to multiple peers

### 2c. Attestation from N peers (Filecoin-style)
- N independent peers attest they have the data (signed messages)
- Validator collects ≥ threshold attestations before accepting the commitment
- **Check**: attestation threshold ≥ Byzantine fraction + 1, attesters are sybil-resistant, no producer-attesting

If NONE of these mechanisms exists for a commitment → **CRITICAL finding**. The producer is paid for a commitment with no enforcement. Honest miners assigned to store the data can be poisoned.

Tag: `[DA-COMMITMENT-NO-AVAILABILITY:{ledger-name}]`

## 2d. Merkle Proof Primitive Audit

Whenever the DA flow relies on `validate_path`, `verify_proof`, `validate_chunk`,
or any Merkle-style helper, audit the verifier itself rather than trusting that
the caller used it correctly.

Questions:
1. **Leaf binding**: does the proof chain the claimed leaf all the way to the
   committed root, or does it only compare a caller-supplied hash at the end?
2. **Length bounds**: before slicing / advancing the proof buffer, does the
   verifier assert enough bytes remain?
3. **Range binding**: if an offset chooses left vs right branch, does the same
   offset also prove the queried chunk is in-range for that branch?
4. **Operator direction**: where the proof combines offset and hash checks, are
   `&&` and `||` used with the intended meaning?

Tag: `[DA-MERKLE-PROOF:{function}]`

## 3. Gossip-Path Trace

For each committed data root, trace the gossip handler that is expected to deliver the actual chunks to other peers. The validator side does NOT replace gossip — both must exist:

1. Find the producer-side function that broadcasts the data after inclusion (e.g., `gossip_chunks_for_data_root`)
2. Verify the function is called UNCONDITIONALLY after the producer's block is accepted, not just on best-effort
3. Verify the receive-side handler stores the chunks AND signals success to the validator's availability check
4. **Common bug**: producer broadcasts on its own initiative (no protocol enforcement), but if it doesn't, no consequence — validators never check

Tag: `[DA-GOSSIP-NOT-ENFORCED:{handler-path}]`

### 3a. Publish-Ledger Gossip Duty Matrix

For each ledger / blob / chunk class whose availability depends on peer-side
replication, write a row:

| Data class | Publisher | Required recipients | Gossip trigger | Validator check | Penalty on missing gossip | Evidence |
|------------|-----------|---------------------|----------------|-----------------|---------------------------|----------|

Required enumeration:
1. Identify every publish-ledger or data-ledger field that creates an
   obligation for a producer or relay to gossip bytes after block acceptance.
2. Locate the exact trigger that sends the bytes. A best-effort background
   task is not enforcement unless block validity, reward, or reputation depends
   on success.
3. Locate the verifier or challenge that detects missing gossip before honest
   assigned peers are penalized for not storing unavailable bytes.
4. Locate the penalty path for producer/relay non-delivery: rejection, delayed
   reward, score decrement, challenge failure, or slashing.
5. If any obligation has no verifier or no penalty, emit
   `[DA-GOSSIP-DUTY-UNENFORCED:{data-class}]`.

### 3b. Relay Obligation Enforcement

For each peer that RECEIVES committed data (chunks, blobs, DA attestations) via gossip:

1. Trace the receive-side handler: after storing a received chunk, does it re-broadcast to peers whose partition assignment covers that chunk's ledger offset?
2. Is the re-broadcast mandatory (protocol-enforced) or best-effort (no penalty for dropping)?
3. If a relay node silently drops received chunks, is there any detection mechanism (challenge, attestation timeout, partition-holder complaint)?
4. **Common bug class (Arweave Wildfire)**: relay is best-effort; a miner stores data for itself but does not forward to assigned partition holders → those holders have empty partitions and cannot produce valid storage proofs → the network's DA guarantee degrades silently.

Tag: `[DA-RELAY-NOT-ENFORCED:{handler-path}]`

## 4. Recall Range / Proof-of-Access

Many DA chains use a "challenge" mechanism: every block, the protocol requires the miner to prove they have a randomly-selected chunk of their assigned partition. This is the storage-proof economic primitive.

**Check**:
- Recall range RNG: is the seed derived from a high-entropy source the miner cannot grind? (See `consensus-safety-invariants` Section 1 + `efficient-sampling` patterns)
- The chunk hash chain: is each chunk in the recall range bound to the previous via a hash function the miner cannot pre-compute?
- The proof-of-access verifier: does it actually check the chunk content, or just the chunk index?
- **Selective storage attack**: if the recall range is predictable, a miner storing only N% of the partition can answer N% of challenges. Storage cost / reward economic model breaks.

Tag: `[DA-PoA-PREDICTABLE:{rng-source}]`, `[DA-PoA-VERIFIER-WEAK:{check}]`

## 5. Slashing for Non-Storage

Once availability is enforced, the next question is: what happens when a miner fails the proof? Most DA chains plan slashing but ship without it.

**Check**:
- Is there a `Slash` / `RemoveStake` / `Penalize` code path in the validator?
- Is it called from the proof-of-access verifier on failure?
- If slashing is "planned but not implemented", document as a Critical pre-mainnet finding — the economic model assumes slashing but the code does not enforce it

Tag: `[DA-SLASHING-MISSING]`

## 6. Output schema

- **Layer**: consensus / storage
- **Bug class**: da-availability / da-gossip-enforcement / da-poa-weakness / da-slashing-missing
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (run a synthetic non-publishing producer and verify validators reject) > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity baseline**: Critical (DA chain whose entire economic model depends on enforcement)

## 7. Known bug classes (research basis)

1. **Arweave early Wildfire reputation gaming** — miners selectively responded to recall challenges they had pre-stored, refusing others. Reputation system was patched repeatedly. The lesson: any storage-proof verifier whose challenge can be predicted by the prover is exploitable.

2. **Filecoin Window PoSt incentive misalignment** — miners can defer submission of storage proofs to earn revenue without losing stake until the window closes. Filecoin patched the timing model multiple times.

3. **Celestia / EigenDA DAS sample size selection** — academic papers show that DA sampling parameters (K samples, M-of-N threshold) must be calibrated against the target Byzantine fraction; under-sampled DAS gives a false sense of availability.

4. **A prior DA-chain audit post-mortem (this skill's origin)** — `Publish` ledger commitments had NO validator-side enforcement that gossiped chunks reached the assigned partition holders. A producer could include a `data_root` and never broadcast; assigned miners received partitions they could not reconstruct.

## Cross-references

- Related: `consensus-safety-invariants` (boundary conditions on recall range RNG), `p2p-dos-and-eclipse` (gossip-path enforcement)
- Consumed by: `depth-consensus-invariant`, `depth-state-trace`
- Severity guide: `docs/l1-mode/severity-matrix.md`
