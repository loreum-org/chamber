---
name: "consensus-safety-invariants"
description: "L1 trigger - detects non-determinism, state transition completeness violations, and safety/liveness invariant breaks in consensus code. Inject into depth-consensus-invariant or depth-state-trace."
---

# Injectable Skill: Consensus Safety Invariants

> **L1 trigger**: `L1_PATTERN=true` AND (`consensus/` OR `state_transition/` OR `fork_choice/` OR `beacon_chain/` detected in recon subsystem map)
> **Inject Into**: `depth-consensus-invariant` (primary) or `depth-state-trace` (fallback)
> **Language**: Go and Rust (language-specific examples embedded)
> **Finding prefix**: `[CS-N]` (consensus-safety)
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

Map sections to the assigned depth agent:
- Sections 1, 2: depth-consensus-invariant (determinism + invariants)
- Sections 3, 4: depth-state-trace (state transition completeness)
- Section 5: depth-edge-case (boundary conditions)
- Section 6: depth-external (cross-client consistency)

## When This Skill Activates

Recon sets `L1_PATTERN=true` and identifies a consensus subsystem in the target. This skill attaches to agents auditing that subsystem. It is the single most load-bearing L1 skill — consensus bugs are Critical tier by default.

## 1. Non-Determinism Sources

A consensus implementation is non-deterministic if two honest nodes processing the same input can reach different output states. Each of the following is a production-bug class:

### 1a. Map iteration order
In Go, `for k, v := range m` visits keys in an **unspecified order**. In Rust, `HashMap` iteration order varies between runs (non-deterministic by default; `BTreeMap` is ordered).

**Check**: For every consensus-critical function, enumerate every map iteration. For each:
- Is the iteration result used to compute state that other nodes must agree on? If yes → non-determinism bug.
- Is there a deterministic sort (`sort.Strings(keys)` in Go; `BTreeMap` or explicit `.sort()` in Rust) before iteration?

**Known exemplar class**: Cosmos SDK Dragonberry/Elderflower (2022) involved IAVL tree iteration that became load-bearing for proof generation.

Tag: `[NON-DET:map-iter:{file}:{line} → {consumer}]`

### 1b. Node-local timestamps
`time.Now()`, `std::time::SystemTime::now()`, system clocks, file mtimes — any value that differs across nodes at the same block height.

**Check**: Grep/ast-grep for time sources. For each hit, trace forward: does the value enter consensus state?
- Block proposer timestamps are intentional (part of the block) — OK.
- Validator vote timestamps that affect scoring — check if rounded to epoch boundary.
- Timeouts for P2P operations — OK if used locally only.

Tag: `[NON-DET:wall-clock:{source} → {consumer}]`

### 1c. Floating-point math

**Rule**: floating-point arithmetic in consensus-reachable code paths is a
CRITICAL-default finding. There are no portable, toolchain-stable, and
SIMD-safe FP operations in production node-client code. "But we compiled
with strict FP" is not a defense — the risk surface is compiler version,
LLVM backend, target triple, feature flags, and the standard library
implementation of transcendental functions, any of which can change across
releases.

**Known exemplars**:

1. **Polkadot 2021-05-24 toolchain-driven divergence** — a consensus path
   used a Rust stdlib routine whose implementation differed between stable
   Rust 1.51 and nightly (same source, different generated code after an
   stdlib change). Two honest validators, both running the same source,
   produced different state because one had upgraded toolchain. Fix was
   twofold: ban FP in consensus code AND migrate affected logic to
   deterministic fixed-point. This is the canonical evidence that
   "identical source compiles identically" is false on FP paths.

2. **Cosmos SDK #7773 / #15381** — FP in fee / reward math produced
   validator-to-validator divergence in testnet replays; the fix
   ([#15381](https://github.com/cosmos/cosmos-sdk/issues/15381)) explicitly
   removed FP from the state machine and added lints to prevent
   regressions. SDK `defensive_programming` guidance now forbids FP in
   state-machine code, not just "discourages."

3. **Parity Ethereum #6511** — early Parity discussion documenting why the
   Yellow Paper has no FP opcodes: structural ban, not stylistic. Any FP
   introduced by a precompile or host function wrapping a native FP op
   recreates the same risk.

4. **EVM Yellow Paper** — the bytecode has ZERO FP opcodes by design.
   Protocols that introduce FP via precompiles, host functions, or a
   custom VM extend the risk surface of their client beyond the spec.

**Check**:

1. Grep for `float64`, `f64`, `f32`, `FloatingPointValue`, and native
   transcendentals (`.sin()`, `.exp()`, `.ln()`, `.pow()`) in every
   consensus-reachable module.
2. Grep for `#![allow(clippy::float_arithmetic)]` or the absence of
   `#![forbid(clippy::float_arithmetic)]` at the crate root for Rust
   consensus crates. The absence of `forbid` is itself a finding for any
   crate that participates in state transitions.
3. For each hit, trace forward: does the value enter the state root, a
   hash input, a signed-over payload, vote weight, gas accounting, or a
   cross-validator comparison? If yes → CRITICAL-default.
4. "Only used for metrics / local logging / display" is an acceptable
   defense ONLY if the value never leaves the process. Prometheus
   metrics are OK; anything written to disk that gets hashed or compared
   across nodes is NOT.

**Severity**: Consensus-reachable FP is CRITICAL-default. Non-consensus
FP (telemetry, RPC display) is Informational. Absent `forbid` lint on a
consensus crate is Low (defense-in-depth).

Tag: `[NON-DET:float:{op}:{file}:{line}]` — upgrade to
`[NON-DET:float:CRITICAL:{op}:{file}:{line}]` when the value reaches
state root / hash input / signed payload.

### 1d. Iteration over Go goroutine-produced data
Channels, select statements with multiple ready cases, goroutine scheduling — any of these can produce order-dependent output.

**Check**: Ast-grep for `select { case ... }` with multiple readable cases inside consensus code. For each, verify the branch taken does not affect state.

Tag: `[NON-DET:goroutine-order:{file}:{line}]`

### 1e. Environment-dependent parsing
JSON/protobuf unmarshal with fields in different orders; `strconv` of NaN/Inf; locale-dependent string operations.

## 2. State Transition Completeness

For every state-modifying function in the consensus path:

1. Enumerate ALL state variables the function reads or writes (use LSP `find-references` or SCIP query)
2. For each code path (branches, early returns, error cases): does the function update ALL variables it should, or only some?
3. Pair-check: if variable `A` is updated, is its paired variable (`A_checkpoint`, `A_prev`, `A_accumulator`) also updated?
4. Error paths: on `return err`, is state rolled back? Or do some writes persist?

### Table to fill per function

| Function | State vars touched | All paths consistent? | Rollback on error? | Gap |
|---|---|---|---|---|
| `applyBlock` | {list from LSP} | {yes/no} | {yes/no} | {specific gap} |

Tag: `[STATE-GAP:{func}:{path} → {vars-updated} / {vars-missing}]`

## 3. Safety Invariants

Safety: "nothing bad ever happens." For every documented invariant (from recon `design_context.md` or protocol spec):

1. State the invariant in a single line: `∀ state s, predicate P(s) = true`
2. Enumerate all write sites for the variables in P (LSP `find-references`)
3. For each write site, ask: can the write break P? If not, why not — is there a guard, or is it structural?
4. For N-validator scenarios: can a Byzantine fraction of 1/3 or 2/3 cause P to break by coordinated writes?

### Canonical safety invariants (check for each)

- **No double vote**: a validator does not sign two conflicting attestations for the same slot
- **No surround vote**: attestation source/target ranges do not surround another
- **No finality reversal**: a finalized block is never pruned or reorg'd past
- **State root monotonicity**: state root does not regress on valid blocks
- **Stake conservation**: total active stake = sum(validator.effective_balance) at every epoch boundary
- **Slashed stake non-negative**: slashed amount ≤ validator balance

Tag: `[SAFETY:{invariant}:{break-path}]`

## 3a. Block Header Field Independent Validation (every field, every fork)

A block header is a struct with N fields, every one of which flows into consensus. The validator must check EVERY field against an INDEPENDENT ground truth — not against itself, not against another producer-supplied field in the same block.

**Methodology**:
1. Find the block header struct definition (`struct BlockHeader`, `struct ChainBlockHeader`, etc.)
2. List every field
3. For each field, locate the validation site in `prevalidate_block` / `validate_header` / equivalent
4. Verify each field is checked against ONE of: parent block (state continuity), local state (anchor / chain tip), wall clock (with bounded drift), reward curve (with bounded params), local mining keys, or a hardcoded protocol constant
5. **Never trust** producer-supplied fields against other producer-supplied fields from the same block

**Common gaps**: `previous_solution_hash`, `block.height`, `last_diff_timestamp`, `epoch_index`, `vdf_seed`, `reward_amount` are all frequent victims. Validators check `block.timestamp` but forget the rest.

Tag: `[HEADER-FIELD-UNVERIFIED:{field-name}]`

## 3b. Transaction Replay Protection Enumeration

Every signed transaction format must carry a per-sender replay-protection field. EVM uses `nonce`. Non-EVM tx formats (Cosmos `sequence`, Solana `recent_blockhash`, anchor-with-expiry schemes) use varied schemes.

**Methodology**:
1. Find the transaction struct definition for EACH tx type the protocol supports (data tx, commitment tx, system tx, etc.)
2. For each, enumerate fields and identify the replay-protection mechanism: nonce, sequence number, anchor with bounded expiry, or block-state binding
3. If NO replay-protection field exists → CRITICAL finding (cross-block replay possible)
4. If anchor-based: verify the anchor expiry is bounded (max N blocks) AND the validator independently checks the anchor is current
5. If sequence-based: verify monotonic increment AND collision detection
6. For system txs: check `valid_for_block_height` AND `parent_blockhash` are validated against LOCAL parent, not against producer-supplied parent

Tag: `[REPLAY-MISSING:{tx-type}]`, `[REPLAY-CIRCULAR:{tx-type}]`

## 3c. ID-must-equal-hash-of-signature Verifier Check

For every consensus-relevant ID field (`block_hash`, `tx_id`, `commitment_id`) that is derived from a hash of the signed object, the verifier must independently RECOMPUTE the hash and compare against the producer-supplied ID. Just verifying the signature is not enough — the ID can be set to any value while the signature stays valid.

**Methodology**:
1. Find every signing function in `crates/types/` or equivalent: `sign_block`, `sign_tx`, `sign_commitment_tx`
2. For each, identify how the ID is derived (typically `id = keccak256(signature.as_bytes())` or `hash(payload)`)
3. Find the corresponding verifier in `validate_block` / `validate_tx`
4. Verify the verifier RECOMPUTES the ID and ASSERTS `recomputed_id == provided_id`
5. If absent → attacker can set `block.block_hash = arbitrary_value` while keeping the signature valid. Two valid blocks with the same hash, or one valid block with a fake hash field → consensus split.

Tag: `[ID-NOT-VERIFIED:{type}.{id-field}]`

## 3d. Validation-Bundle Enumeration Checklist (MANDATORY ARTIFACT)

§3a tells you what to do; §3d makes it mechanically verifiable. For every block-header / transaction / commitment struct in the audit scope, produce an explicit per-field checklist BEFORE writing any finding. This prevents the "I checked timestamp and stopped" failure mode where the agent reports one validated field and forgets the other 14.

**Required artifact**: when this skill triggers, write `{SCRATCHPAD}/validation_bundle_{struct_name}.md`:

```markdown
# Validation Bundle: ChainBlockHeader (50 fields)

| # | Field | Type | Validator function | Source of truth | Status |
|---|---|---|---|---|---|
| 1 | block_hash | H256 | validate_block_hash() at consensus/src/block_validator.rs:L42 | recomputed from payload | OK |
| 2 | timestamp | u64 | check_timestamp() at L78 | local clock ± 30s drift | OK |
| 3 | previous_solution_hash | H256 | — | — | **MISSING** |
| 4 | block.height | u64 | implicit (parent.height + 1) | parent block | **CIRCULAR — uses producer-supplied parent ref** |
| 5 | last_diff_timestamp | u64 | — | — | **MISSING** |
| 6 | difficulty | U256 | check_difficulty() at L156 | adjust_difficulty(parent.difficulty, time_delta) | OK |
| ... | ... | ... | ... | ... | ... |
```

**Rules**:
1. Read pre-baked `{SCRATCHPAD}/scip/repo_map.md` to extract the full field list from the struct definition. Do NOT enumerate from memory. (MCP tools are unavailable in subagent contexts per Claude Code bug #25200.)
2. For each field, search `validate_block` / `prevalidate_block` / `validate_header` / equivalent for ANY reference to the field name. Record the function and line.
3. Status values: `OK` (validated against independent ground truth), `CIRCULAR` (validated against another producer-supplied field), `MISSING` (no validator reference at all), `BOUNDED` (validator exists but bound is too loose).
4. Every `MISSING` row generates a `[HEADER-FIELD-UNVERIFIED:{field-name}]` finding. Every `CIRCULAR` row generates a `[HEADER-FIELD-CIRCULAR:{field-name}]` finding. The bundle is the evidence — the orchestrator can verify the agent enumerated EVERY field by counting checklist rows against the struct field count.

**Why mandatory**: a prior DA-chain run produced finding "block.timestamp not validated against local clock" but missed `previous_solution_hash`, `block.height`, and `last_diff_timestamp` — the §3a methodology was present but didn't force enumeration. §3d closes this by making the checklist artifact the precondition for any header-validation finding. No checklist → no header-validation finding accepted.

Tag: `[BUNDLE-INCOMPLETE:{struct_name}:{field_count_validated}/{total_fields}]`

## 4. Liveness Invariants

Liveness: "something good eventually happens." Plamen cannot prove liveness mechanically, but can identify liveness-blocking patterns:

1. **Unbounded loops**: any `for` / `while` / `loop` in consensus code that can iterate > block-gas-limit times. Tag: `[LIVENESS:unbounded-loop:{loc}]`
2. **Locks held across I/O**: consensus mutex held while doing network or disk I/O. Tag: `[LIVENESS:lock-over-io:{loc}]`
3. **Self-referential waits**: goroutine waits for an event that can only be produced by itself. Tag: `[LIVENESS:deadlock-self:{loc}]`
4. **Quorum-sensitive waits**: waiting for 2/3+ votes when the protocol allows <1/3 Byzantine — can the Byzantine fraction prevent progress? Tag: `[LIVENESS:halt-2-3:{loc}]`

## 4a. Verifier Early-Rejection Pattern (VDF / ZK / BLS / heavy compute)

For computationally expensive verifier routines (VDF step replay, ZK proof verification, BLS aggregation, recursive hash chains), the verifier must check cheap preconditions BEFORE entering the expensive compute loop. Otherwise an attacker forces the validator to pay full compute cost on a doomed-to-fail input, then learn it was invalid.

**Methodology**:
1. For each `validate_*` / `verify_*` function with a clear cheap-vs-expensive split, identify the loop body cost
2. Verify that ALL of these are checked BEFORE the loop:
   - Length / count bounds (e.g., `vdf_steps.len() <= MAX_STEPS_PER_BLOCK`)
   - Format validity (e.g., proof bytes are well-formed, hashes are 32 bytes, public keys are on-curve)
   - Timing bounds (e.g., `step_number < local_step + MAX_LOOKAHEAD`)
   - Producer permission (e.g., signer is in active validator set)
3. Verify the LAST check is the expensive recompute / pairing / re-derivation
4. **Fail mode**: attacker submits a block with `vdf_steps = [crafted; N]` where N is huge but the result is wrong. Verifier loops N times then reports invalid — N times wasted CPU.

Tag: `[VERIFIER-LATE-REJECT:{func}]`

## 4a.1 Proof-of-X entropy and step-count audit

When the protocol uses VDF, PoW, recursive hash chains, or similar
proof-of-computation primitives, ask:

1. **Entropy source**: what seeds the proof? Is it unpredictable
   block-derived state, or a deterministic chain the attacker can precompute?
2. **Verification-before-cost**: does the verifier reject malformed or
   impossible inputs before replaying the expensive computation?
3. **Step-count cap**: is there a protocol-enforced upper bound on claimed
   steps / rounds / iterations per block?

A deterministic seed chain or an unbounded claimed step count is a consensus
and DoS finding, not just a performance concern.

Tag: `[POX-ENTROPY:{func}]`, `[POX-STEP-COUNT:{func}]`

## 4b. Fixed-point Arithmetic Order of Operations

For all difficulty adjustment, fee calculation, and EMA computations using fixed-point arithmetic (`u64`/`u128`/`U256` with implicit decimals), audit the order of operations: multiplication must precede division to avoid intermediate truncation.

**Common bug**: `a / b * c` truncates to integer at the division step, losing precision. The correct form is `(a * c) / b`, with an overflow check on the intermediate product.

**Methodology**:
1. Grep for `adjust_difficulty`, `compute_*_fee`, `*_ema`, `interpolate`, `decay_factor`
2. For each function, list the arithmetic operations and check operator precedence
3. Flag any `x / y * z` or `(x / y) * z` pattern as a finding unless `y` divides `x` exactly by construction
4. Also check for "division before multiplication" inside `mulDiv` style helpers

Tag: `[FIXED-POINT-DIV-FIRST:{func}]`

## 5. Boundary Conditions

Apply the four-state sweep per consensus-critical function:

| State | Values tested | Expected behavior | Observed | Result |
|---|---|---|---|---|
| Zero | all params = 0 / empty / None | {from spec} | {from code} | |
| One | single validator / block / vote | {from spec} | {from code} | |
| Max | N_MAX validators / max balance / max slot | {from spec} | {from code} | |
| Byzantine boundary | 1/3 − 1, 1/3, 1/3 + 1, 2/3 − 1, 2/3, 2/3 + 1 Byzantine | {from spec} | {from code} | |

Tag: `[BOUNDARY:{state}:{var}={value} → {result}]`

## 6. Cross-Client Consistency (if target is a fork or alt-client)

If the target is a fork of an existing consensus client (op-geth, op-reth, custom cometbft), use the fork-ancestry primitive:

1. `git diff upstream/main...HEAD -- consensus/` (or equivalent subsystem path)
2. For each modified function, re-run Sections 1-4 specifically on the diff
3. Flag any documented protocol constant that was changed (epoch length, slots per epoch, max validators, slashing penalties) — constant changes require justification

Tag: `[DRIFT:{func}:{upstream-behavior} → {fork-behavior}]`

## 7. Output schema

Findings use the standard Plamen format with these L1-specific fields:

- **Layer**: consensus
- **Bug class**: non-determinism / state-gap / safety-violation / liveness / boundary / cross-client-drift
- **Preferred evidence tags**: `[NON-DET-PASS]` (run 2x, diff output) > `[CONFORMANCE-PASS]` (spec test) > `[DIFF-PASS]` (fork differential) > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity default**: Critical impact; likelihood depends on reachability

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **Aptos deterministic→non-deterministic map refactor (October 18, 2023)** — a performance change in aptos-core replaced a deterministic map with Rust `HashMap` in VM output handling. When a transaction hit its gas limit, the FeeStatement event's I/O gas summation iterated the map in arbitrary order, producing different gas-used totals on different validators. Chain halted for ~5 hours. [Aptos incident report](https://aptosnetwork.com/currents/10-18-23-aptos-mainnet-incident-report); [technical detail](https://medium.com/xyra-labs/kana-labs-tech-talks-decoding-aptos-network-outage-on-october-18-2023-c3a0a12febf8). **Skill catch point**: Section 1a — enumerate map iteration in any function reachable from state-touching paths.

2. **Cosmos SDK Go map iteration non-determinism (ongoing class, EPIC #13039)** — Go's runtime intentionally randomizes `range m` for `map[K]V`. State-machine code that iterates maps produces divergent results across validators. Long-running class; multiple modules affected. [EPIC tracker](https://github.com/cosmos/cosmos-sdk/issues/13039); [writeup](https://ashourics.medium.com/the-challenge-of-gos-map-iteration-in-the-cosmos-sdk-blockchain-a-dive-into-determinism-bd5a99260519). **Skill catch point**: Same as Aptos — Section 1a.

3. **Geth `dataCopy` shallow-copy + RETURNDATACOPY consensus split (CVE-2020-26241, discovered by Fluffy OSDI '21)** — the `dataCopy` precompile (0x04) performed a shallow copy. Attacker writes X to memory, calls 0x04, overwrites memory with Y, calls RETURNDATACOPY. Geth returned Y; spec-compliant clients returned X. Consensus divergence. Fixed v1.9.17. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2020-26241); [Fluffy paper](https://www.usenix.org/system/files/osdi21-yang.pdf). **Skill catch point**: Section 6 (Cross-client consistency) + execution-client-hardening Section 4 (precompiles).

4. **Geth transfer-after-destruct consensus divergence (CVE-2020-26265, Fluffy OSDI '21)** — second Fluffy finding. Transfer semantics to an already-destructed contract diverged between Geth and OpenEthereum. Caused a mainnet hard fork event 4 months after disclosure. [Fluffy paper](https://www.usenix.org/system/files/osdi21-yang.pdf). **Skill catch point**: Section 2 — state transition completeness for contract lifecycle (create → live → destruct → resurrect via CREATE2).

5. **Solana stake inflation u64 overflow (September 2022 outage)** — during the coordinated restart after the duplicate-block fork, the inflation mechanism generated enough new SOL to overflow a u64; stake-percentage math × 100 produced values exceeding max possible. Contributed to extended downtime. [Helius outage history](https://www.helius.dev/blog/solana-outages-complete-history). **Skill catch point**: Section 3 (safety invariants) — total_supply ≤ u64::MAX / safety_margin invariant.

6. **Cosmos-SDK `x/group` div-by-zero chain halt (ASA-2025-003, v0.50.11)** — division by zero when total voting power is zero in a group proposal path, unrecovered panic halts chain. [GHSA-x5vx-95h7-rv4p](https://github.com/cosmos/cosmos-sdk/security/advisories/GHSA-x5vx-95h7-rv4p). This is the **BeginBlocker/EndBlocker panic class** — see methodology nuance below.

### Methodology nuance from Round 4 (panic-in-BeginBlocker/EndBlocker)

**Add to Section 2 checks**: unlike transaction-processing paths, code executed in BeginBlocker / EndBlocker / vote-extension-processor / PreBlocker does NOT recover from panics — any panic halts the chain. Cosmos SDK has 4+ advisories of exactly this pattern (ASA-2025-003, ISA-2025-002, ISA-2025-005, plus adjacent). **Check**:

- Enumerate every `panic()`, `recover()` boundary, and unchecked slice index in BeginBlocker / EndBlocker / PreBlocker / vote-extension paths (grep the module for `BeginBlock(`, `EndBlock(`, `PreBlock(`)
- Every division where denominator is state-derived: is there a zero-check?
- Every `for _, v := range stateSlice` where `stateSlice` could be empty at genesis or after migration
- Every type assertion `x.(T)` without the `ok` form

Tag: `[PANIC-BLOCK:{func}:{trigger}]`

## 10. Randomness / VRF Grinding (leader-selection bias)

Leader election, lottery selection, committee shuffling, and any "who gets to act next" decision must derive from entropy a block producer cannot bias. The producer can withhold or re-mine its own block to grind toward a favorable outcome whenever (a) the entropy source is producer-influenceable AND (b) the producer can observe the selection result before committing to the block.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find selection callers/seed write-sites; on-demand single-symbol source reads for the seed-derivation and selection functions only; never bulk-read large files.

**Heuristics**:
1. Grep for `getRandom`, `seed`, `randao`, `vrf_verify`, `vrf_prove`, `next_leader`, `select_proposer`, `shuffle`, `committee`, `lottery`, `winner`.
2. Trace the entropy source backward. Producer-biasable sources (each a finding): block hash of a block the producer mines (`prev_block.hash`, `parent_hash`), block timestamp, producer-supplied nonce/seed field, tx-set the producer chooses, a deterministic chain the producer can precompute.
3. **Grinding test**: can the producer compute the selection result for several candidate blocks it could publish, then publish only the one that favors it? If selection reads producer-controlled bits AND the result is observable pre-commit → grindable → finding.
4. **VRF correctness**: if a VRF is used, verify the verifier checks the proof against the producer's REGISTERED public key (not a producer-supplied key), and that the VRF input is bound to height/epoch so the same proof cannot be reused. A VRF whose output is never verified, or whose input is grindable, provides no unbiasability.
5. RANDAO-style commit-reveal: verify the reveal cannot be selectively withheld for free (last-revealer advantage) and that a missed reveal is penalized or the value is still safe.

**Severity**: producer-biasable leader/committee selection is High–Critical (consensus fairness / liveness); biasable lottery payout is High (economic). Non-consensus randomness (test fixtures, non-binding UI) is Informational.

Tag: `[RAND-GRIND:{seed-source}:{selection-func}]`, `[VRF-UNVERIFIED:{func}]`

## 11. Timestamp Trust / Timejacking

A node that trusts peer-supplied or loosely-bounded timestamps can be pushed off the honest clock. Wide allowable block-timestamp drift, a node clock adjusted from peer messages, or missing local-clock sanity checks let an attacker shift the victim's notion of "now" — breaking slot calculation, slashing/evidence windows, unbonding timers, and finality.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find timestamp validators and clock-adjustment write-sites; on-demand single-symbol source reads for the timestamp-check and clock-source functions only; never bulk-read large files.

**Heuristics**:
1. Grep for `max_clock_drift`, `MAX_FUTURE`, `allowed_drift`, `timestamp > now`, `time.Now`, `adjusted_time`, `network_time`, `median_time`, `peer.*time`, `ntp`.
2. **Drift bound**: locate the block-timestamp validation. Is `block.timestamp <= now + MAX_DRIFT` enforced with a TIGHT, protocol-justified `MAX_DRIFT`? A multi-minute or unbounded forward drift is a finding — it lets a producer post-date blocks to manipulate time-gated logic.
3. **Peer-influenced clock**: if the node derives "now" from a median/aggregate of peer-reported times (Bitcoin-style `nTimeOffset`), can a cluster of attacker peers shift the victim's clock? Verify the offset is bounded AND that a local-clock / NTP sanity check overrides an implausible peer median.
4. **Downstream consumers**: trace the timestamp/clock value into slot-number computation, slashing/evidence-window bounds, unbonding/withdrawal timers, and finality. A drifted clock that widens or closes a slashing window is High–Critical.
5. **Monotonicity**: verify `block.timestamp > parent.timestamp` is enforced where the protocol requires monotonic time.

**Severity**: timejacking that opens/closes a slashing or finality window is Critical; that only skews local logging is Informational.

Tag: `[TIME-DRIFT-WIDE:{check}:{bound}]`, `[TIME-PEER-INFLUENCE:{clock-source}]`

## 9. Fallback if primitives unavailable

If LSP/SCIP/ast-grep unavailable, degrade to:

- Read consensus package directory listing; grep manually for `range m` (Go) or `.iter()` on HashMap (Rust)
- Grep for `time.Now`, `SystemTime`
- Grep for `float64`, `f64`
- Check recent commits to consensus package (`git log --oneline consensus/`)
- Cross-reference with spec documents if available

Note degraded scope in the finding with `[PRIMITIVE:FALLBACK]`.

## Cross-references

- Related skills: `fork-choice-audit`, `cross-environment-semantic-drift`, `go-concurrency-safety`, `rust-unsafe-audit`
- Consumed by: `depth-consensus-invariant`, `depth-state-trace`
- Severity guide: `docs/l1-mode/severity-matrix.md`
