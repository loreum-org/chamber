---
name: "validator-lifecycle-and-slashing"
description: "L1 trigger - audits validator entry/exit transitions, slashing correctness, leader-duplicate handling, and lifecycle state invariants for PoS / DPoS / BFT consensus clients."
---

# Injectable Skill: Validator Lifecycle and Slashing

> **L1 trigger**: `L1_PATTERN=true` AND (`slashing/` OR `validator/` OR `staking/` OR `x/slashing` OR `x/staking` OR `unbonding` OR `delegator` detected in recon subsystem map)
> **Inject Into**: `depth-state-trace` or `depth-consensus-invariant`
> **Language**: Go and Rust
> **Finding prefix**: `[VL-N]`
> **Status**: v0.1 draft (added from Round 4 gap analysis)

## Orchestrator Decomposition Guide

- Section 1: depth-state-trace (lifecycle state machine)
- Section 2: depth-consensus-invariant (slashing correctness)
- Section 3: depth-edge-case (boundary conditions on stake math)

## When This Skill Activates

Recon identifies a PoS / DPoS / BFT staking subsystem. This skill is ADJACENT to but distinct from `fork-choice-audit` and `consensus-safety-invariants`: those cover "which chain is head" and "does the state machine stay consistent," while this one covers **"who counts as a validator right now, and when must they be punished."**

Round 4 gap analysis identified this as a pattern with ≥3 public exemplars not well-covered by the existing skill pack.

## 1. Lifecycle State Machine

Every staking system has a finite state machine for validator status. Common states:

| State | Meaning | Typical transitions |
|---|---|---|
| **Pending / Deposited** | Funds deposited, not yet active | → Active (on epoch boundary) |
| **Active** | Currently producing blocks / signing attestations | → Exiting (voluntary), → Slashed (on misbehavior), → Jailed (on downtime) |
| **Exiting** | Requested to leave, funds locked | → Unbonding |
| **Unbonding** | Exit period elapsing; still slashable | → Withdrawable |
| **Withdrawable** | Funds claimable | → (removed) |
| **Jailed / Tombstoned** | Temporarily removed for downtime | → Active (on unjail) |
| **Slashed** | Permanently penalized | → Unbonding (with reduced stake) |

### Check per transition

1. Enumerate every state transition in the validator state machine
2. For each, identify the trigger (epoch boundary, tx message, slashing evidence, timeout)
3. For each transition, enumerate the state variables that MUST be updated (active set, delegator shares, power index, reward accumulator, slashing index)
4. Check: does every code path through the transition update ALL variables?
5. **Check idempotency**: can the same transition fire twice? What happens?

Tag: `[VL-STATE:{transition}:{missing-update}]`

## 2. Slashing Correctness

Slashing is the enforcement mechanism for validator misbehavior. Bugs here let malicious validators escape penalty or let honest validators be wrongly punished.

### 2a. Slashable offenses
Enumerate every offense the protocol defines:

- **Double-sign** (equivocation): signing two conflicting proposals/attestations at the same height/slot
- **Surround vote** (Ethereum beacon): attestation source/target ranges that surround another
- **Unavailability** (downtime): missing N consecutive blocks / M of last K blocks
- **Invalid block proposal** (if detectable)

For each, find the detection code and verify:
1. Detection is triggered on every path the offense can occur through (not just the obvious one)
2. The slashing amount is correct per protocol spec
3. The slashing is **attributable** to a specific validator (not a validator set)
4. The slashing is **immediate** or **delayed** per spec (not accidentally skipped)

### 2b. Slashing evasion — the critical class

Attacker wants to escape slashing by transitioning to a non-slashable state before detection fires. Key check:

**Can a validator exit / re-delegate / unbond between committing an offense and being detected?**

If yes, the evidence window is too short — the protocol has a slashing evasion bug. Examples:

- Cosmos SDK had historical bugs where re-delegation during the evidence window avoided slashing
- Ethereum beacon has a strict slashable-until-withdrawable guarantee — this is load-bearing

Tag: `[VL-EVASION:{offense}:{window-gap}]`

### 2c. Double-slash protection
Conversely: a validator should not be slashed twice for the same evidence. Check: is there a slashed-offenses set / bitmap? Is it consulted before slashing?

### 2d. Slashing math
Slashing burns stake. Verify:

- Integer overflow / underflow in stake subtraction
- Slashing amount is a function of validator's CURRENT stake at the time of detection, not the stake at the time of offense (or whichever the spec dictates — check it matches)
- Delegator stakes are slashed proportionally (or per spec)
- Slashed stake goes to the correct destination (burned, community pool, fee collector — per spec)

Tag: `[VL-MATH:{op}:{issue}]`

## 3. Leader / Proposer Duplicate Handling

Related to `fork-choice-audit` Section 3, but focused on validator-level accountability:

### Check
- If a validator proposes two conflicting blocks in the same slot, is this **detected**? (Should be a slashable offense)
- If a validator has a hot-spare that duplicates blocks, does the protocol distinguish "malicious duplicate" from "accidental duplicate"? Typically they're treated identically because the network cannot distinguish.
- **Known exemplar**: Solana September 2022 — a validator's hot-spare generated duplicate blocks; fork choice had no rule for `same_leader + same_slot + different_payload` leading to 5+ hour network halt. [Helius history](https://www.helius.dev/blog/solana-outages-complete-history).

Tag: `[VL-DUPLICATE:{handling}]`

## 4. Validator Set Transitions at Epoch Boundaries

Epoch transitions are a critical moment when pending validators become active, exiting validators leave, and the total stake changes. Bugs at epoch boundaries:

- **Race between epoch boundary and slashing detection**: evidence arrives at slot T; epoch boundary at T+1 promotes a pending validator. Is the slashing applied to the pre-transition or post-transition set?
- **Off-by-one**: active set at slot T vs active set at slot T+1 — which is used to validate attestations for slot T?
- **Deposit / exit queue processing**: is it FIFO? Capped per epoch? Can the queue stall?
- **Unbonding period vs trust period**: unbonding period must be ≥ trust period of any consuming light client, else a slashed validator's old signature can still verify. **Historical Cosmos class**.

Tag: `[VL-EPOCH:{boundary}:{gap}]`

## 4a. CometBFT Evidence / Vote-Aggregation

For CometBFT/Tendermint-based clients, two specific aggregation checks gate slashing soundness. Skipping either lets forged equivocation evidence slash an honest validator, or lets vote-counting misattribute power.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find evidence-verification and vote-aggregation call-sites; on-demand single-symbol source reads for the evidence-verify and BitArray/vote-count functions only; never bulk-read large files.

**Heuristics**:
1. **Evidence verification**: grep for `DuplicateVoteEvidence`, `LightClientAttackEvidence`, `VerifyEvidence`, `evidence`. For each evidence type, verify the handler (a) re-checks the FULL signature of each conflicting vote against the accused validator's pubkey, (b) confirms both votes are for the SAME height/round/type but conflicting block IDs (true equivocation, not two distinct valid messages), and (c) rejects evidence outside the bounded age window (`MaxAgeNumBlocks` / `MaxAgeDuration`). Evidence accepted without full signature re-verification, or without height/time bounding, is a finding.
2. **BitArray / vote-set sizing**: grep for `BitArray`, `VoteSet`, `commit.Signatures`, `votesBitArray`. Before counting votes or summing voting power from a commit/vote-set, verify the bit-array / signature-slice LENGTH equals the validator-set size for that height. A length mismatch (commit from a different-size set, or attacker-supplied over/undersized array) must be rejected before any index access or power summation — otherwise out-of-range indexing or misattributed power results.

**Severity**: forged-evidence slashing of an honest validator is Critical; vote-misattribution from unchecked BitArray length is High–Critical (consensus power error / panic).

Tag: `[VL-EVIDENCE-UNVERIFIED:{evidence-type}]`, `[VL-BITARRAY-MISMATCH:{site}]`

## 5. Boundary Conditions

| State | Test | Expected |
|---|---|---|
| Empty validator set | no validators active | handled per spec (no block produced, chain stalls gracefully?) |
| Single validator | only one active | no double-sign detection needed, but still must work |
| Slashing at genesis | evidence applies to pre-genesis state | rejected |
| Slashing on already-slashed | double-slash attempt | rejected (double-slash protection) |
| Exit during slashing window | attempt to exit mid-evidence-period | blocked until exit window ≥ evidence window |
| Stake = 1 wei | minimum stake validator | handled without divide-by-zero (see consensus-safety-invariants) |
| Stake = u64::MAX | overflow boundary | handled |
| Unbonding across upgrade | unbonding validator during hard fork | state preserved correctly |

Tag: `[BOUNDARY:validator:{state}:{result}]`

## 6. Output schema

- **Layer**: consensus (validator accounting)
- **Bug class**: state-machine-gap / slashing-evasion / double-slash / slashing-math / leader-duplicate / epoch-transition
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (against slashing spec) > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity baseline**: High by default; Critical if slashing can be fully evaded or chain halts

## 7. Known bug exemplars

1. **Solana hot-spare duplicate-block network halt (September 30, 2022)** — fork choice lacked handling for `same_leader + same_slot + different_payload`. Chain halted 5+ hours. [Helius outage history](https://www.helius.dev/blog/solana-outages-complete-history). **Skill catch point**: Section 3 duplicate handling.

2. **Cosmos SDK `x/staking` re-delegation-window slashing evasion (historical, various advisories)** — re-delegation of stake during the evidence window could sidestep slashing. Class has been patched multiple times. Reference: Cosmos SDK security advisories archive. **Skill catch point**: Section 2b — slashing evasion.

3. **Polygon PoS validator-exit consensus disruption (July 2025)** — validator lifecycle transition triggered a Bor/Erigon finality issue. [Cointelegraph report](https://cointelegraph.com/news/polygon-finality-disruption-node-bug). **Skill catch point**: Section 4 — epoch boundary with lifecycle transition.

4. **Ethereum beacon chain early slashing edge cases** — Aumasson et al. review found multiple subtle slashing-condition bugs in early Eth2 clients. [Security Review of Ethereum Beacon Clients](https://www.aumasson.jp/data/papers/eth2sec.pdf). **Skill catch point**: Section 2a — slashable offense enumeration + 2b — evasion window.

## 8. Fallback if primitives unavailable

- Locate staking / slashing module directory
- Read the validator state enum / struct
- Read every function that mutates validator state
- Grep for `slash(`, `Slash(`, `jail(`, `unbond(`, `undelegate(`

## Cross-references

- Related: `fork-choice-audit` (leader duplicates), `consensus-safety-invariants` (panic in slashing path + integer math), `bls-aggregation-audit` (attestation signing)
- Consumed by: `depth-state-trace`, `depth-consensus-invariant`
- Severity: `docs/l1-mode/severity-matrix.md`
