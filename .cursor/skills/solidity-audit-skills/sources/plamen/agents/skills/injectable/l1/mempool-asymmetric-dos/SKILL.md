---
name: "mempool-asymmetric-dos"
description: "L1 trigger - audits mempool / transaction pool for eviction asymmetries, replacement policy abuse, blob-pool exhaustion, and DETER-class denial of service."
---

# Injectable Skill: Mempool Asymmetric DoS

> **L1 trigger**: `L1_PATTERN=true` AND (`txpool/` OR `mempool/` OR `tx_pool` OR `blob_pool` OR `reth-transaction-pool` detected in recon subsystem map)
> **Inject Into**: `depth-network-surface` or `depth-state-trace`
> **Language**: Go and Rust
> **Finding prefix**: `[MP-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Section 1, 2: depth-network-surface (entry cost vs eviction cost)
- Section 3: depth-state-trace (mempool state consistency)
- Section 4: depth-edge-case (boundaries of the pool)

## When This Skill Activates

Recon identifies a mempool module. Mempools are uniquely exposed: every RPC client and every peer can insert transactions. The DETER paper (USENIX CCS '21) and MemPurge follow-ups showed that most production mempools had asymmetric cost models exploitable at near-zero attacker cost.

## 1. The Core Asymmetry Check

The DETER insight: if an attacker can **insert** transactions with lower cost than it takes to **evict** them, they can fill the pool faster than honest transactions can reclaim space.

For each mempool:

1. Identify the **insert cost** in (gas, fee, stake, or other resource): what does the attacker pay per byte of pool space occupied?
2. Identify the **eviction threshold**: when does a new higher-fee transaction kick out a lower-fee one?
3. Identify the **eviction cost to the attacker**: to evict an honest transaction, what must the attacker's replacement pay?
4. Compute the ratio: `insert_cost / eviction_cost`. If this is much less than 1, the pool is asymmetric.

**Specific patterns**:

### 1a. Invalid-but-accepted transactions
Transactions that are initially accepted into the pool but will later fail validation (nonce gap, insufficient balance, invalid signature for a new state root). These cost the attacker 0 but occupy space until the validator reprocesses them.

**Check**: Look for a "pending" vs "valid" split. When is validity re-checked? Can an attacker keep an invalid tx in "pending" indefinitely?

### 1b. Nonce-gap attacks
A transaction with a nonce 100 above the current nonce is "futureNonce" — it occupies space waiting for the lower-nonce gap to fill. Attacker sends 99 futureNonce placeholders + never sends the gap-filler.

**Check**: Is there a cap on futureNonce slots per account? What's the eviction policy when the cap is hit? Is the cap per-account or shared?

### 1c. Replace-by-fee (RBF) exploitation
If an attacker can replace a low-fee tx with a slightly-higher-fee tx indefinitely, they churn pool state and cost honest reorganization work. The Bitcoin `min_relay_fee_increment` and Ethereum's 10% bump rule address this — verify the implementation.

**Check**: What is the minimum fee bump for replacement? Is it enforced cumulatively (across multiple replacements) or only per-replacement?

### 1d. Blob pool asymmetry (post-EIP-4844)
Blob transactions have a separate gas market (`blob_gas_price`). If the blob pool eviction uses only blob-gas-price but insertion is cheap (or the pool is not strictly separated from legacy), asymmetric exploitation is possible.

**Check**: Is the blob pool size-capped independently of the main pool? Can an attacker spam blobs to evict legacy txs or vice versa?

Tag: `[MP-ASYMMETRIC:{insert-cost}:{eviction-cost}:{ratio}]`

## 2. Eviction Policy Correctness

When the pool is full, which transaction gets evicted?

### Patterns to check
- **Purely-fee-based**: is the "cheapest" metric fee-per-gas, fee-per-byte, or absolute fee? Fee-per-gas is standard; absolute-fee allows large low-rate transactions to displace small high-rate ones.
- **Per-sender quota**: does any single sender have a hard cap? If not, one attacker fills the pool with one-sender transactions.
- **Eviction cost consistency**: does eviction correctly update all dependent state (sender's nonce tracking, per-topic indexes, reverse-lookup maps)?
- **Deterministic ordering on ties**: when two transactions have identical fee, which gets evicted? If it's random, it's non-deterministic across nodes.

Tag: `[MP-EVICT:{policy}:{gap}]`

## 3. Propagation Multiplier

A mempool bug is worse if the bad transaction propagates:

1. Does the node broadcast incoming transactions before validating them?
2. Is there a per-peer rate limit on transaction gossip?
3. Does the node track which peer sent which transaction to avoid re-sending?
4. What happens if a peer floods with transactions that all fail validation? Is the peer scored down?

Tag: `[MP-PROPAGATE:{behavior}]`

## 4. Ordering and Priority

For transactions that do make it into blocks, the ordering algorithm affects MEV and fairness:

- **Priority-fee ordering**: verify tie-break is deterministic (hash-based, not insertion-order)
- **Fee-market simulation**: if the client simulates optimal inclusion, is the simulation correctness verified?
- **Bundle / PBS integration**: if the mempool hands off to mev-boost or builder, what's the trust boundary? Any injection attack possible?

## 5. Blob pool specifics (Ethereum post-4844)

1. Blob transactions are large (>128KB each). The pool must cap total blob size.
2. Blob versioning: are versioned hash checks in place?
3. Blob retrieval: if blob data is requested from peers, is there a DoS vector in the retrieval path?
4. Blob expiry: 18-day retention. What happens when blobs are pruned mid-mempool-lifetime?

Tag: `[BLOB:{concern}:{bound}]`

## 6. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Empty pool | first tx inserted | accepted | |
| Full pool, same-fee tx | new tx with equal fee | rejected (no displacement) | |
| Full pool, 10% higher fee | new tx with RBF-threshold fee | old tx evicted, new accepted | |
| Same-sender N txs | sender sends pool_cap+1 txs | oldest or lowest-fee evicted; sender not DoSed | |
| futureNonce only | attacker fills with gap transactions | cap enforced; pool does not grow unbounded | |
| Invalid sig batch | 1000 txs with invalid sigs | all rejected quickly; peer scored | |
| Blob size cap | blobs sum to > cap | excess rejected | |

Tag: `[BOUNDARY:mempool:{state}:{result}]`

## 7. Output schema

- **Layer**: mempool
- **Bug class**: asymmetric-cost / eviction-policy / propagation-amplification / ordering / blob-pool
- **Preferred evidence tags**: `[FUZZ-PASS]` (parameterized pool harness) > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity baseline**: Medium-High; Critical if network-wide eviction of all honest transactions is demonstrated

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **DETER — Geth and 4 other Ethereum clients (USENIX CCS '21 + USENIX Security '24)** — asymmetric eviction. Attackers send "future" nonce or "latent overdraft" transactions that pass cheap admission checks but are invalid at execution time. They fill the mempool and evict valid victim transactions at much lower cost to attacker than damage caused. Fixed in all major Ethereum clients as of Fall 2023. [Mempool Symbolic Fuzzing USENIX '24](https://arxiv.org/html/2312.02642v3); [DETER 2.0](https://tristartom.github.io/docs/deter+-ef.pdf). **Skill catch point**: Section 1 — the core asymmetry invariant. Insertion cost ≥ eviction damage.

2. **MemPurge — Geth pending pool (USENIX '24)** — chain-of-txs eviction. Attacker sends chain of ≤65 transactions that appear valid but become invalid after first executes. Attacker pays for only 1 tx worth of fees but evicts 65 honest txs. Combined with ConditionalExhaust, total attack cost **≈ $376** for full pool replacement. [Speculative DoS paper](https://www.usenix.org/system/files/sec24summer-prepub-32-yaish.pdf); [Yaish summary](https://medium.com/@aviv.yaish/speculative-denial-of-service-attacks-in-ethereum-c4bfbbaec4a2). **Skill catch point**: Section 1b — model multi-tx transitive validity; admission of tx_1 must account for worst-case state after tx_1 executes, not current state.

3. **Geth `GetHeadersFrom` integer underflow (CVE-2024-32972)** — `GetHeadersFrom(number, count uint64)` received `count-1` where count was 0, producing `UINT64_MAX` and bypassing `maxHeadersServe`. Single p2p request forced node to stream all headers from latest back to genesis. [GHSA-4xc9-8hmq-j652](https://github.com/ethereum/go-ethereum/security/advisories/GHSA-4xc9-8hmq-j652); fix in PR #29534, shipped v1.13.15. **Skill catch point**: boundary substitution — every p2p request handler with a count/range parameter must have underflow guard (subtraction below 0), overflow guard (u64 wraparound), and upper bound enforcement **after** arithmetic, not before. (Shared with `p2p-dos-and-eclipse`.)

### Critical methodology addition from Round 4 (DETER invariant)

**Insert as new Section 1e (MANDATORY invariant)**: For every mempool, quantify:

```
insert_cost  = minimum resource expenditure to place one tx in the pool
              (accounts for: fee, stake, gas, bandwidth, all admission gates)
eviction_damage = maximum resource removal this tx can cause
              (accounts for: bytes freed, slot evictions, state churn, propagation)
```

**Invariant**: `insert_cost ≥ eviction_damage` for every admission path.

Check:
- Invalid-but-admitted transactions (nonce gap, future balance, wrong sig) **must** be pruned from the pool before their slot is counted against any cap — or the admission check must have already charged the full eviction damage
- Transitive validity: if admitting tx_A makes tx_B invalid, the mempool must not count both against admission quota
- Test by constructing the worst-case attacker: fill the pool with minimally-costing entries and measure how much honest traffic is evicted

Tag: `[MP-COST-RATIO:{insert_cost}:{eviction_damage}:{ratio}]`

Ratios < 1 are CRITICAL; ratios just above 1 are High (a small-margin attacker can still cause damage under peak load).

## 8. Per-Transaction-Type Count Cap Audit

When a block can contain MULTIPLE transaction types (regular data tx, commitment tx, system tx, deposit, slashing, governance, oracle update, etc.), each type needs its OWN count cap. A single `max_txs_per_block` applied uniformly is insufficient — one attacker-controlled free tx type can flood blocks while "expensive" types are correctly bounded.

**Methodology**:
1. Find the block header / body struct and enumerate EVERY field that holds a list or count of transactions. Typical names: `data_ledgers`, `commitment_txs`, `system_txs`, `slashings`, `deposits`, `attestations`, `seal_operations`.
2. For each list field, find the block validator check for that specific field's length.
2a. Verify the cap is enforced in BOTH places:
   - block production / assembly
   - block validation / acceptance
3. For each tx type, find the cost-per-tx (bytes, compute, state writes).
4. **Red flag**: if one type has `len(txs) <= MaxTxPerBlock` but another type has no per-type cap (only the total byte cap), the unbounded type is a DoS vector — especially if the unbounded type is cheap to produce (no signature fee, no stake requirement, free-to-spam).

**Required artifact**: `{SCRATCHPAD}/tx_type_caps.md`:

```markdown
| Tx Type | Field name | Per-type cap? | Cap value | Cost per tx | Spam risk |
|---|---|---|---|---|---|
| Regular data tx | `data_ledgers[].txs` | YES | MaxTxPerBlock=5000 | signature + state write | OK |
| Commitment tx | `commitment_txs` | **NO** | — | signature only (cheap) | **HIGH — no cap** |
| System tx | `system_txs` | YES | MaxSystemPerBlock=16 | none (privileged) | OK if validated |
| Slashing evidence | `slashings` | YES | MaxSlashPerBlock=32 | free to submit | OK |
```

**Every "NO" in the "Per-type cap?" column is a finding** — severity is at least High when the type is cheap to produce and propagates through p2p (commitment txs, attestations, gossip messages). A cap enforced only at production or only at validation is also a finding.

Tag: `[MP-NO-PER-TYPE-CAP:{tx_type}]`

## 8a. CometBFT Mempool Priority / FIFO Front-running

CometBFT/Tendermint mempools are FIFO by default; a priority mempool exists but must be explicitly configured and implemented correctly. FIFO ordering enables ordering games (an observer races a target tx by submitting earlier), and either ordering mode can STARVE critical low-volume messages (oracle price updates, emergency pause, slashing evidence) behind a flood of cheap txs.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find mempool insert/reap call-sites and any priority assignment; on-demand single-symbol source reads for the `CheckTx`/reap/priority functions only; never bulk-read large files.

**Heuristics**:
1. Grep for `mempool.Priority`, `priority`, `ReapMaxBytesMaxGas`, `CheckTx`, `Mempool`, `recheck`, `fifo`. Identify whether the mempool is FIFO or priority-based.
2. **Ordering exposure**: if FIFO, any logic whose outcome depends on relative tx ordering (oracle-feeds, auctions, first-come settlement) is front-runnable by an observer who submits earlier — flag the affected app-level path.
3. **Critical-message starvation**: identify protocol-critical message types (oracle update, pause/halt, governance, slashing evidence). Verify they cannot be indefinitely delayed behind attacker spam — i.e. they get a reserved lane, a priority floor, or a dedicated cap. A critical message subject to the same shared FIFO/priority queue as spammable txs, with no reservation, is a finding.
4. **Priority assignment integrity**: if `mempool.Priority` is set in `CheckTx`, verify the priority is derived from a non-attacker-gameable signal (validated fee/stake), not from a self-declared field a sender can inflate for free.

**Severity**: starvation of an oracle/pause/evidence message is High–Critical (stale price / un-haltable incident / missed slashing); ordering front-run is Medium–High per the affected app path.

Tag: `[MP-FIFO-FRONTRUN:{path}]`, `[MP-CRITICAL-STARVE:{msg-type}]`

## 9. Fallback if primitives unavailable

- Locate the mempool directory
- Find the `Add` / `insert` / `add_transaction` function
- Find the `pop` / `evict` / `remove` function
- Read both, check if they maintain the same cost function

## Cross-references

- Related: `p2p-dos-and-eclipse` (peer scoring interaction), `rpc-surface-audit` (RPC `eth_sendRawTransaction` is an insertion path), `execution-client-hardening`
- Consumed by: `depth-network-surface`, `depth-state-trace`
- Severity: `docs/l1-mode/severity-matrix.md`
