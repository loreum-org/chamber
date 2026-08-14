---
name: "state-sync-pruning"
description: "L1 trigger - audits state sync, snapshot integrity, checkpoint trust, pruning race conditions, and state growth attacks."
---

# Injectable Skill: State Sync and Pruning

> **L1 trigger**: `L1_PATTERN=true` AND (`sync/` OR `snap_sync` OR `fast_sync` OR `statesync` OR `pruning` OR `snapshot/` detected in recon subsystem map)
> **Inject Into**: `depth-state-trace` or `depth-edge-case`
> **Language**: Go and Rust
> **Finding prefix**: `[SS-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-state-trace (sync protocol state)
- Sections 3, 4: depth-edge-case (pruning races, growth)
- Section 5: depth-external (checkpoint trust)

## When This Skill Activates

Recon identifies state sync or pruning code. State sync is the mechanism by which a new node catches up without replaying the entire history; pruning is how an existing node garbage-collects old state. Both are subtle: a bug in either can corrupt the node's state silently, leading to later divergence.

## 1. Sync Mode Fingerprinting

Identify the sync mode(s) supported:

| Mode | Description | Trust model |
|---|---|---|
| **Full sync** | Replay every block from genesis | Trustless (modulo consensus rules) |
| **Fast sync** | Download headers + recent state trie | Trusts weak subjectivity checkpoint |
| **Snap sync** (Ethereum) | Download flat account snapshots in ranges | Healing phase verifies root |
| **Warp sync** (Parity) | Download a snapshot of state at a past block | Trusts snapshot root |
| **State sync** (Cosmos) | Download state at a trusted height from peers | Trusts a configured height/hash |
| **Checkpoint sync** (Beacon) | Trusts a recent finalized checkpoint root | Weak subjectivity |
| **Portal Network** | Content-addressed historical storage | Trustless per item |

Write the mode(s) into the finding header.

## 2. Root / Checkpoint Trust

Every non-full sync mode depends on a root or checkpoint. Verify the trust chain:

1. **Where does the checkpoint come from?** Hardcoded? CLI flag? RPC? Config file?
2. **What signs it?** Nothing (pure trust)? A hardcoded key? The current validator set?
3. **Validity period**: is the checkpoint rejected if older than X? Stale checkpoints permit long-range attacks.
4. **Rollback**: if a checkpoint turns out to be invalid mid-sync, does the node recover cleanly?

Tag: `[SYNC-TRUST:{source}:{validation}]`

**Historical exemplar class**: unsigned-checkpoint sync in early Cosmos clients; trust-anchor bypass in early beacon chain clients.

## 3. Snapshot Integrity

For any sync mode that downloads bulk state (snap, warp, state sync):

### 3a. Chunk verification
- State is downloaded in chunks. Is each chunk verified against the root as it arrives?
- Or is all data downloaded first, then verified at the end (bad — wasted bandwidth on poisoned chunks)?
- What happens if a peer serves a chunk that hashes correctly but whose content violates invariants (e.g., negative balance)?

### 3b. Duplicate account / missing account
- Can the same account appear in two chunks? How is the conflict resolved?
- Can an account be missing from all chunks? Is there a completeness check?

### 3c. Healing phase
- After bulk download, the "healing" phase typically walks the trie and fetches missing nodes. Verify:
  - Is the healing phase bounded in time/attempts?
  - Can a malicious peer serve nodes that hash correctly but belong to a different subtrie?

### 3d. Parallel peer downloads
- If multiple peers serve chunks in parallel, how are conflicts resolved?
- Can a slow peer hold up the whole sync?

Tag: `[SNAPSHOT:{integrity-class}]`

## 4. Pruning Safety

Pruning removes old state to save disk. Bugs here corrupt the active state.

### 4a. Reference counting
- Most pruning uses reference counts on trie nodes. Is the ref count atomic with state writes?
- On reorg, are ref counts correctly adjusted? **Frequent bug source.**

### 4b. In-flight reads
- Can a pruning operation race with an active read? (e.g., RPC `eth_getProof` reading historical state while pruner deletes it)
- Is there a read lock, a MVCC snapshot, or a pruning-delay grace period?

### 4c. Pruning boundaries
- Which blocks are pruned? How deep is the retained window?
- Is the window configurable? What's the minimum safe window vs fork-choice requirements?
- Beacon chain: pruning cannot go past the latest finalized checkpoint. Is this enforced?

### 4d. Archive vs pruned mode
- If the node supports archive mode, is the code path strictly disabled when pruning is enabled? Mixed-mode bugs exist.

### 4e. Persistence atomicity across logical units

A persistence unit is any tuple of writes that must commit or abort together
for higher-level state to stay consistent (block body + receipts + state
root; header + total-difficulty + canonical-hash mapping; snapshot chunk +
chunk manifest). A node crash BETWEEN the writes of a logical unit leaves
partially-applied state that the restart path may silently accept.

Methodology — enumerate as a table, one row per logical unit:

| Logical Unit | Writes In Order | Fence (txn commit / fsync / batch) | Restart Recovery | Torn-Write Risk |

For each row:
1. Read the write sequence from the code. Do all writes happen under the
   SAME DB transaction / batch that commits atomically, or are they split
   across multiple commits?
2. If split, what happens if the process dies between commits? Does the
   next start detect and roll back, complete the remaining writes, or
   silently accept the partial state?
3. OS-level torn writes: for any write that bypasses the DB's own atomicity
   (direct `write` + `fsync` to a file), verify that either the write is
   ≤ 4 KiB (page-atomic on most filesystems) or the file uses a
   write-then-rename pattern with `fsync` on the parent directory.
4. Windows-specific: `rename` is NOT atomic over an existing file on
   pre-Windows-10 / some network filesystems; `MoveFileEx` with
   `MOVEFILE_REPLACE_EXISTING` is required. Flag any code that assumes
   POSIX rename semantics cross-platform.
5. CUDA / async-DMA writes: a pinned-buffer write the kernel has
   acknowledged may not be durable until the next host `fsync`.

Tag: `[PERSIST-ATOMIC:{unit}:{torn-scenario}]`. Severity High by default
(silent state corruption on restart is a safety violation); Critical when
the partial state is accepted as canonical without any reconciliation.

Tag: `[PRUNE:{race-or-boundary}]`

## 5. State Growth Attacks

Attacker crafts transactions that bloat state at low cost, outpacing pruning.

### 5a. Storage cost mismatch
- Is every state-writing opcode priced to cover the amortized storage cost?
- Ethereum SSTORE_REFUND has been tuned multiple times — check if the current pricing is sufficient.

### 5b. Account creation bomb
- How cheap is it to create an empty account? Ethereum's Shanghai fork patched a variant of this.
- Is there a spam check on account creation?

### 5c. Unbounded storage arrays
- Smart contract arrays (unbounded `SSTORE` of a key) — not a client bug but a client should bound per-tx state growth

Tag: `[STATE-GROW:{mechanism}:{cost}]`

## 6. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Genesis-only sync | no blocks to sync | idempotent | |
| Sync from stale checkpoint | checkpoint from N finality periods ago | rejected | |
| Peer serves wrong root | chunks that verify against a different root | detected + peer banned | |
| Reorg mid-sync | fork-choice changes head during sync | handled cleanly | |
| Prune to latest | pruning window = 0 | refuses if below consensus safety | |
| Prune across finality | prune past finalized | refused | |
| Disk full during sync | out-of-space | graceful error | |

## 7. Output schema

- **Layer**: storage (sync) or state
- **Bug class**: checkpoint-trust / snapshot-integrity / pruning-race / state-growth
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (sync correctness test) > `[FUZZ-PASS]` > `[LSP-TRACE]`
- **Severity baseline**: High for silent state corruption; Medium for resource exhaustion; Critical if a poisoned snapshot can be finalized

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **Geth snap-sync state corruption after abnormal termination (Issue #30229, 2024)** — in one sync cycle, the storage trie for an account was fully synced and persisted but the account trie was not yet flushed. On restart, restart logic missed topmost trie nodes in 1-2 paths, producing inconsistent state that didn't match the synced state root. **The node silently went off-consensus.** [go-ethereum #30229](https://github.com/ethereum/go-ethereum/issues/30229). **Skill catch point**: Section 4b — crash-recovery atomicity. For every 2PC-like flush sequence, test with `kill -9` at each flush boundary.

2. **Snapping Snap Sync — adversarial sync source attacks (USENIX Security '23, Taverna-Paterson)** — snap sync protocol trusts peer-provided state without sufficient on-chain verification. Attacker controlling a sync peer can plant invalid state that survives restart, permanently deviating the victim from consensus. [Practical Attacks on Go Ethereum Synchronising Nodes](https://www.usenix.org/system/files/usenixsecurity23-taverna.pdf). **Skill catch point**: Section 3a — every received trie node must be verified against the proof root **before** writing to disk. No provisional writes. No "trust peer now, verify later."

3. **Geth `debug_traceTransaction` historical DoS** — unbounded custom JS tracer, later restricted. Demonstrates the state-growth / resource-exhaustion pattern in sync-adjacent code.

4. **Ethereum Shanghai EIP-3529 (SSTORE refund reform, 2021)** — response to state-growth exploits where attackers abused the gas-refund mechanism to inflate state at negative cost. [EIP-3529](https://eips.ethereum.org/EIPS/eip-3529). **Skill catch point**: Section 5a — storage cost must cover amortized sync cost, not just write cost.

### Critical methodology addition from Round 4 (crash-recovery atomicity)

**Insert as new Section 4e (MANDATORY test)**: Geth issue #30229 shows crash-recovery atomicity is a hot bug class. Test methodology:

1. Identify every 2-phase flush sequence (storage → account → root; proof → data → index; etc.)
2. For each, inject `kill -9` at the boundary between phases
3. Verify the restart logic either (a) rolls back to a consistent state, or (b) completes the interrupted sequence
4. **Never** accept "it works on graceful shutdown" — graceful shutdown is not the interesting case

Tag: `[SYNC-ATOMIC:{flush-seq}:{kill-point}]`

## 9. Fallback if primitives unavailable

- Find the sync package / module
- Read the entry function (usually `start_sync` / `sync_loop`)
- Map sync phases and trust boundaries
- Find the pruner function and read it top-to-bottom

## Cross-references

- Related: `consensus-safety-invariants` (fork-choice pruning interaction), `execution-client-hardening` (storage pricing)
- Consumed by: `depth-state-trace`, `depth-edge-case`
- Severity: `docs/l1-mode/severity-matrix.md`
