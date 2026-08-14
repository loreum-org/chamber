---
name: "fork-choice-audit"
description: "L1 trigger - audits fork-choice rule implementation (LMD-GHOST, Tendermint locking, Nakamoto longest-chain) for equivocation handling, slot-vs-block reasoning, duplicate block handling, and chain reorg correctness."
---

# Injectable Skill: Fork Choice Audit

> **L1 trigger**: `L1_PATTERN=true` AND (`fork_choice/` OR `ghost/` OR `lmd/` OR `consensus/tendermint/` OR `fork.rs` OR `choice.rs` detected in recon subsystem map)
> **Inject Into**: `depth-consensus-invariant`
> **Language**: Go and Rust
> **Finding prefix**: `[FC-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Section 1, 2: depth-consensus-invariant (rule correctness)
- Section 3: depth-edge-case (equivocation + duplicate handling)
- Section 4: depth-state-trace (reorg state consistency)

## When This Skill Activates

Recon identifies a fork-choice module. This skill applies whether the protocol uses LMD-GHOST (Ethereum beacon chain), longest-chain (Bitcoin, pre-merge Ethereum), Tendermint locking (Cosmos), or a custom fork-choice rule.

## 1. Identify the Rule

Before auditing, determine which rule is implemented. Extract from spec docs and code:

| Rule | Signature | Key invariants |
|---|---|---|
| **LMD-GHOST** | "latest message driven — greedy heaviest observed subtree" | Each validator's latest attestation contributes to a subtree weight; choose heaviest |
| **Casper FFG + LMD-GHOST** (Ethereum) | LMD-GHOST bounded by finalized checkpoints | Never revert past justified/finalized checkpoint |
| **Tendermint BFT** | Round-based, locking on 2/3+ prevotes | Locked validator cannot vote for conflicting proposal in same round |
| **Nakamoto longest-chain** | Heaviest accumulated work | Chain with most work wins; stale blocks discarded |
| **HotStuff / Aptos / Sui** | 3-phase: prepare, precommit, commit | No two conflicting QCs at the same view |

Write the identified rule into the finding header so reviewers know which invariants apply.

## 2. Rule-Specific Invariants

### 2a. LMD-GHOST
- **Heaviest subtree monotonicity**: adding an attestation can only increase (never decrease) the subtree weight
- **Latest-message tie-break**: if two children have equal weight, tie-break is deterministic (typically lower root hash)
- **Boundary with finality**: fork choice never selects a block that would require reverting a finalized block
- **Slot vs block**: a slot can have zero, one, or multiple proposed blocks; fork choice must handle the missing-block case

**Check**: Enumerate every call site of `find_head()` / `get_head()`. For each, verify the return value is bounded by the latest finalized checkpoint.

### 2b. Tendermint BFT locking
- **Lock only on 2/3+ prevotes**: validator cannot lock without proof of 2/3 prevotes
- **Lock carries across rounds**: once locked in round R, validator votes locked block in rounds R+1, R+2, ... unless unlocked by a newer 2/3+ prevote
- **Unlock on newer PoLC** (Proof-of-Lock-Change): only unlock if a strictly newer round's 2/3+ prevotes are seen
- **No equivocation across rounds**: locked validator cannot vote for conflicting block in later round of same height

**Check**: Follow the `lock_value`, `lock_round`, `valid_value`, `valid_round` state variables. Verify every `set_lock` call is guarded by the 2/3 check.

### 2c. Nakamoto longest-chain
- **Cumulative difficulty, not length**: chain selection uses total work, not block count
- **Stale block eviction**: blocks building on non-canonical ancestors are discarded cleanly
- **Reorg depth bound**: some clients impose a max reorg depth (e.g., 64 blocks); verify the bound is documented and enforced

## 3. Equivocation and Duplicate Block Handling

Equivocation = a validator signing two conflicting attestations. Fork choice must:

1. **Detect** equivocation via slashing conditions (double vote, surround vote, double proposal)
2. **Preserve** both conflicting signatures as evidence
3. **Not crash** or hang when two conflicting messages arrive in close proximity
4. **Not double-count** the equivocator's weight — their vote should NOT contribute to fork-choice weight after equivocation is detected

**Check**:
- Ast-grep for "equivocation" / "double_vote" / "slashing" in fork-choice code
- Trace the weight computation: does it exclude equivocators' contributions?
- Duplicate block handling: if two blocks for the same slot arrive, does the fork-choice data structure gracefully hold both, or does the second overwrite the first? Overwrites are bug-prone.

**Known exemplar class**: Cosmos / Tendermint "Denial of Validators" attacks — multiple historical bugs where equivocation detection could itself be exploited to halt the chain.

Tag: `[EQUIVOC:{loc}:{handling}]`

## 4. Reorg State Consistency

When fork choice selects a new head, the node must reorg: revert state from the old head back to the common ancestor, then apply blocks from the common ancestor to the new head.

**Check**:
1. Enumerate all state that must be rolled back on reorg: account balances, nonces, receipts, logs, fork-choice's own caches
2. For each state category, verify the reorg path touches it
3. Look for **side-channel state** that does NOT roll back: metrics, logs flushed to disk, cached RPC responses, indexer state
4. On reorg, is any background task (indexer, RPC subscription, metrics) left in an inconsistent state?

Tag: `[REORG-GAP:{state-category}]`

### 4a. Fork block ordering / replay order

For every helper that returns blocks to apply during a reorg
(`get_fork_blocks`, `fork_blocks`, `blocks_to_apply`, `ancestor_path`,
`rollback_path`):

1. Determine the expected order: ancestor → child → ... → new head for
   forward application, or old head → ... → ancestor for rollback.
2. Inspect whether the implementation collects by walking parent pointers
   from head to ancestor and forgets to reverse the list.
3. Check all consumers: if a function expects forward order but receives
   reverse-chronological order, state replay can apply children before
   parents.
4. Emit a finding for any ambiguous helper that does not document and enforce
   its order contract.

Tag: `[REORG-ORDER:{function}:{expected}->{actual}]`

**Known exemplar class**: Solana Sept 2022 stuck validator bug — fork choice could not revert to heaviest bank when its slot matched the last voted slot.

## 5. Slot vs Block Reasoning

A subtle class of bugs comes from conflating slot (time unit) with block (proposed content). Rules of thumb:

- **Every slot has zero or one canonical block** but the fork-choice data structure must handle both cases
- **Slot N can be skipped** (empty slot) and slot N+1's block parent points to slot N-1's block
- **Validators vote on slots, not blocks** — if slot N is empty, validators vote "empty" for N and contribute to the subtree rooted at N-1

**Check**: Ast-grep for "slot" in fork-choice code. For each, ask: does the code distinguish "no block at this slot" (valid) from "block not yet arrived" (network delay)?

## 6. Boundary Conditions

Apply the sweep specific to fork choice:

| State | Test | Expected | Observed |
|---|---|---|---|
| Genesis | fork choice on only genesis block | returns genesis | |
| Single child | one block building on head | returns the child | |
| Tie | two children with equal weight | deterministic tie-break | |
| Deep reorg | new head requires reverting 50+ blocks | completes without state corruption | |
| Finality boundary | new head would revert finalized block | rejected | |
| Equivocator weight | equivocator's vote equals non-equivocator's vote | equivocator excluded, non-equivocator wins | |
| All votes missing | no attestations in latest epoch | returns last-known head | |

Tag: `[BOUNDARY:fork-choice:{test} → {result}]`

## 7. Output schema

- **Layer**: consensus
- **Bug class**: fork-choice-rule / equivocation-handling / reorg-consistency / slot-block-conflation / boundary
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (spec test against reference) > `[NON-DET-PASS]` > `[DIFF-PASS]` > `[LSP-TRACE]`

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **Solana duplicate-block fork-choice stuck-validator (September 30, 2022)** — a validator's hot-spare malfunctioned and generated duplicate blocks for the same slot. Fork choice had no rule for `same_leader + same_slot + different_payload`. Consensus stalled until coordinated restart. [Helius outage history](https://www.helius.dev/blog/solana-outages-complete-history). **Skill catch point**: Section 3 — enumerate leader-duplicate scenarios (same slot/different parent, same slot/same parent/different content, same slot/two leaders); assert fork choice resolves each without liveness loss.

2. **Prysm Fusaka outdated-attestation state replay DoS (December 4, 2025)** — Prysm v7.0.0 unnecessarily generated old beacon states while processing outdated attestations. Out-of-sync attestations referencing historical block roots triggered thousands of costly state replays, dropping validator participation to 75% and costing **382 ETH in missed rewards**. Rated **High** not Critical because 9 other clients continued validating. [Crypto.news analysis](https://crypto.news/what-broke-ethereums-fusaka-upgrade/); [postmortem](https://bitcoinethereumnews.com/ethereum/ethereum-prysm-fusaka-mainnet-postmortem-42-epoch-window-shows-18-5-missed-attestations-and-382-eth-lost-in-validator-rewards/). **Skill catch point**: new methodology step — identify every path that triggers historical state replay, assert the trigger is bounded by a recent-slot check. **Stale attestations must be rejected before any state replay.**

3. **Lighthouse fork-choice timing bug (v2.5.0, fixed in v2.5.1 "Slippy")** — two separate bugs introduced in v2.4.0 and v2.5.0 causing intermittent fork-choice errors. Self-resolved within seconds but noise in logs indicated deeper race conditions. [Release v2.5.1 "Slippy"](https://github.com/sigp/lighthouse/releases/tag/v2.5.1). **Skill catch point**: Section 2a — for each tick-driven fork-choice update, verify ordering of: new block arrival, attestation arrival, slot tick, head update. Fuzz all permutations.

4. **Tendermint lite-client bisection safety gap (issue #3244)** — bisection binary-searched for blocks where validator set voting power changes by <1/3. With sufficient validator-set flux, an attacker could fool a lite client into accepting an invalid header at zero cost. [tendermint #3244](https://github.com/tendermint/tendermint/issues/3244); [attack spec](https://docs.tendermint.com/master/spec/light-client/attacks/notes-on-evidence-handling.html). **Skill catch point**: for any skip/jump verification, assert the security argument depends on slashing-accountability of faulty validators between trusted and target heights, NOT on honest-majority assumption at target alone.

### Methodology nuance from Round 4 (stale-state triggers are DoS vectors)

**Add to Section 2a**: The Prysm Fusaka lesson generalizes — **any fork-choice handler that replays historical state on attacker-controlled input is a DoS vector**. Specific check:

- For every attestation / message handler, trace the path: "does this trigger state reconstruction?"
- For every state reconstruction call, assert it is bounded by a recent-slot check
- Reject-before-replay, not reject-after-replay

Tag: `[FC-STALE-DOS:{handler}:{replay-trigger}]`

## 9. Fallback if primitives unavailable

- Identify fork-choice module by directory name
- Read the function that returns "current head" / "canonical chain"
- Grep for weight/score accumulation loops
- Check recent fork-choice fixes in `git log`

## Cross-references

- Related skills: `consensus-safety-invariants`, `bls-aggregation-audit` (for attestation signature check), `state-sync-pruning` (reorg clears sync state)
- Consumed by: `depth-consensus-invariant`
- Severity guide: `docs/l1-mode/severity-matrix.md`
