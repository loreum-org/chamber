---
name: "hardfork-activation-and-protocol-upgrade"
description: "L1 trigger - audits bugs that surface only at fork boundaries / protocol upgrade points: activation logic, dormant code paths, upgrade epoch correctness, version gating."
---

# Injectable Skill: Hardfork Activation and Protocol Upgrade

> **L1 trigger**: `L1_PATTERN=true` AND (`fork_rules` OR `chain_config` OR `hardfork` OR `upgrade_handler` OR `x/upgrade` OR `ActivationHeight` OR `ActivationEpoch` detected in recon subsystem map)
> **Inject Into**: `depth-state-trace` or `depth-consensus-invariant`
> **Language**: Go and Rust
> **Finding prefix**: `[HF-N]`
> **Status**: v0.1 draft (added from Round 4 gap analysis)

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-state-trace (activation logic, version gating)
- Section 3: depth-consensus-invariant (dormant code paths)
- Section 4: depth-edge-case (boundary epoch + upgrade races)

## When This Skill Activates

Recon identifies fork-activation, chain-config, or upgrade-handler code. This skill addresses a distinct bug class surfaced by Round 4: **bugs that are invisible until an upgrade epoch arrives**. The Prysm Fusaka bug (Dec 2025) is the canonical example — perfectly working code in v7.0.0, Critical-severity bug the moment Fusaka activated.

The defining feature: these bugs cannot be found by analyzing "current behavior" alone. They live in code paths that are dormant until a specific block height, epoch, or version condition fires.

## 1. Activation Logic

Every hardfork has an activation condition: a block height, timestamp, epoch, or version number. Verify:

### 1a. Activation condition is deterministic
- The condition must not depend on non-deterministic inputs (no wall clock, no node-local config that differs across peers)
- The condition must be a single canonical value per chain, not derived from a header field an attacker can influence

### 1b. Activation is atomic across all affected rules
If a hardfork activates multiple rule changes (new opcode, new gas cost, new pricing), ALL must activate at the same height. Partial activation = consensus split.

### 1c. Activation code is reachable
Check: the code gated by `if block.Number >= ForkBlock` actually runs. Dead code that was meant to activate but never does is a finding (late activation = missed hardfork).

### 1d. Test network vs mainnet
Testnet activation heights are different from mainnet. Verify: the code does not have a hardcoded mainnet block number that breaks on testnet, or vice versa. Every activation condition should be config-driven.

Tag: `[HF-ACTIVATE:{fork}:{issue}]`

## 2. Dormant Code Paths

The hardest class: code that exists for a future fork but has never run in production. Prysm Fusaka is the exemplar — v7.0.0 shipped with the Fusaka code path, but that path was dormant until the upgrade epoch. When it activated, bugs surfaced that no amount of testing on the pre-Fusaka chain would have caught.

### Check
- List every `if chainConfig.IsXxx(blockNumber)` gate in the codebase
- For each, identify what code runs when the gate becomes true
- Apply full L1 skill pack to that dormant code (it's effectively a new codebase that just hasn't executed yet)
- **Cross-check against the spec**: does the code match the spec document for that fork?
- **Cross-check against other clients**: has another client already implemented the fork? Run a differential against their implementation (this is the strongest check)

Tag: `[HF-DORMANT:{fork}:{gated-code}]`

**Critical methodology nuance**: dormant code is under-tested by definition. Any finding in dormant code should be flagged **High or Critical** because the production blast radius is the entire upgrade.

## 3. Version Gating

For protocols with multiple client implementations, version gating must agree:

- Client A version X says "Fusaka activates at epoch 411392"
- Client B version Y must say the same

Check:
- Activation constants are consistent across clients (spec document is the source of truth)
- If the activation is spec-defined, the spec must be referenced in the code (grep for EIP number, Cosmos ADR, etc.)
- Client-specific feature flags must not alter the activation height

Tag: `[HF-VERSION:{client}:{divergence}]`

## 4. Upgrade Epoch Boundary

At the upgrade epoch itself, two rule sets coexist: pre-upgrade rules apply to blocks at epoch N-1, post-upgrade rules apply to N. At the boundary:

### 4a. Transition state
- What state must be migrated? (New struct fields, storage layout changes, validator set format changes)
- Is the migration idempotent? (Can be re-run safely)
- Is the migration atomic with the activation? (Can the chain halt mid-migration?)

### 4b. Transition reorgs
- If a reorg happens across the upgrade epoch boundary, do both old and new rules apply correctly?
- Specifically: a block at epoch N (post-upgrade) that gets reorged back to epoch N-1 (pre-upgrade) — is the state consistently reverted to pre-upgrade rules?

### 4c. Consuming contracts
- If the upgrade changes opcode behavior (gas prices, semantics), do existing deployed contracts still work? This is a consensus concern because a contract that suddenly fails at the upgrade height can cause chain divergence if one client handles the failure differently from another.

Tag: `[HF-BOUNDARY:{issue}]`

## 5. Rollback and Upgrade Cancellation

If an upgrade fails post-deployment, the protocol may need to be rolled back.

- Is rollback supported? (Usually not — it requires a coordinated reorg)
- If the upgrade handler panics, does it halt the chain (Cosmos x/upgrade pattern) or revert? Halting is usually intentional; reverting silently is a bug.
- Emergency-pause switches: exist? Guarded by governance? Tested?

Tag: `[HF-ROLLBACK:{state}]`

## 6. Boundary Conditions

| State | Test | Expected |
|---|---|---|
| Genesis = fork block | chain starts at upgrade | handled |
| Reorg across fork | reorg to block before fork activation | state rolled back to pre-fork rules |
| Fork block + 1 | first post-fork block | uses post-fork rules cleanly |
| Missing client update | some nodes still on pre-fork version | they split off (this is the POINT of a hardfork) |
| Upgrade during chain halt | activation height reached while chain is halted | activation applies when chain resumes |

## 7. Output schema

- **Layer**: consensus (activation logic)
- **Bug class**: activation-gate / dormant-code / version-divergence / boundary-transition / migration-safety
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (against spec + other clients) > `[DIFF-PASS]` (differential vs alternative implementation) > `[LSP-TRACE]`
- **Severity baseline**: High by default; Critical if the bug can split the network at the upgrade epoch

## 8. Known bug exemplars

1. **Prysm Fusaka mainnet bug (December 4, 2025)** — v7.0.0 was shipped with the Fusaka code path. At Fusaka activation epoch 411392, Prysm's handling of outdated attestations triggered thousands of historical state replays, dropping participation to 75% and costing 382 ETH in validator rewards. Rated High (not Critical) because 9 other clients kept validating. [Crypto.news analysis](https://crypto.news/what-broke-ethereums-fusaka-upgrade/); [postmortem](https://bitcoinethereumnews.com/ethereum/ethereum-prysm-fusaka-mainnet-postmortem-42-epoch-window-shows-18-5-missed-attestations-and-382-eth-lost-in-validator-rewards/). **Skill catch point**: Section 2 — dormant code path that only activated at the upgrade epoch. Differential test against Lighthouse / Teku / Nimbus would have caught it.

2. **Nimbus Deneb consensus violation (v24.2.2 hotfix)** — Nimbus deviation from spec at the Deneb hardfork boundary. Hotfix released to address the violation. **Skill catch point**: Section 1b — activation atomicity; Section 3 — version gating against spec.

3. **Polygon Heimdall V2 upgrade triggered Bor/Erigon finality delay (September 2025)** — hardfork on Heimdall side caused downstream clients (Bor, Erigon) to experience finality delays. Cross-client upgrade coordination failure. [Cointelegraph](https://cointelegraph.com/news/polygon-finality-disruption-node-bug). **Skill catch point**: Section 3 — cross-client version coordination.

4. **Ethereum EIP-2929 activation (Berlin hardfork, 2021)** — introduced warm/cold storage access, changing gas costs for state-touching opcodes. Multiple client-specific implementation bugs were caught pre-activation via testnets. Demonstrates the **"dormant code" class** — the bugs only surfaced once the code path was exercised by real traffic at the activation height.

## 9. Fallback if primitives unavailable

- Grep for `ForkBlock`, `IsXxx(`, `ActivationEpoch`, `upgrade_handler`, `UpgradeHandler`, `PlanUpgrade`
- Identify each activation gate
- Read the gated code even if it's dormant
- Cross-reference the EIP / ADR / CIP numbers in comments

## Cross-references

- Related: `consensus-safety-invariants` (activation code must preserve safety invariants), `execution-client-hardening` (opcode repricing / new opcode support), `cross-environment-semantic-drift` (forks of upstream clients may have drifted activation logic)
- Consumed by: `depth-state-trace`, `depth-consensus-invariant`
- Severity: `docs/l1-mode/severity-matrix.md`
