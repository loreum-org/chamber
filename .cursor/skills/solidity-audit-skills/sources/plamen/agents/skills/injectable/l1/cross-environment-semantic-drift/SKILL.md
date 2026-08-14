---
name: "cross-environment-semantic-drift"
description: "L1 trigger - audits L1/L2 boundary bugs, precompile context assumptions, integer width mismatches at environment boundaries, and EVM-on-non-EVM drift."
---

# Injectable Skill: Cross-Environment Semantic Drift

> **L1 trigger**: `L1_PATTERN=true` AND (fork of an EVM execution client OR L2-rollup detected OR EVM-on-non-EVM runtime OR precompile implementation in a non-EVM host detected)
> **Inject Into**: `depth-external` or `depth-state-trace`
> **Language**: Go, Rust, Solidity (for precompiles), C++
> **Finding prefix**: `[XE-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-external (boundary enumeration)
- Section 3: depth-state-trace (semantic diff tracing)
- Section 4: depth-edge-case (integer width / encoding boundaries)

## When This Skill Activates

Recon detects ONE of the following:

1. Target is a **fork of an EVM execution client** (op-geth, op-reth, arbitrum-nitro, base-node)
2. Target is an **L2 rollup** that re-implements EVM semantics (Optimism OVM, Arbitrum AVM, early zkEVMs)
3. Target runs **EVM on a non-EVM host** (Moonbeam on Polkadot-SDK, Frontier on Substrate, Neon on Solana)
4. Target implements **precompiles** that wrap native-host functionality
5. Target has **integer-width boundaries** between environments (128-bit Substrate balance vs 256-bit EVM value)

This is the most consequential "new class" skill: the most famous L1 bounties (Saurik's Optimism, pwning.eth's Moonbeam and Polkadot Frontier) are all in this category.

## 1. Boundary Enumeration

Map every semantic boundary in the target. A boundary is any place where code written against one execution model calls into code written against another.

### Boundary types

| Type | Example | Risk |
|---|---|---|
| **EVM ↔ host chain balance** | Optimism OVM_ETH wraps native ETH | Double-counting, wrong-account credit |
| **EVM ↔ precompile** | Moonbeam ERC-20 precompile wrapping GLMR | Call context confusion, allowance abuse |
| **EVM-256 ↔ host-N** | 256-bit value to 128-bit host balance | Truncation, wraparound |
| **Rollup sequencer ↔ L1 inbox** | Optimism deposit tx | Replay, double-credit |
| **Bridge contract ↔ bridge relay** | Any canonical bridge | Message forging, replay |
| **L2 state root ↔ L1 dispute game** | Arbitrum, Optimism | Invalid state root acceptance |

Write the boundary map to `scratchpad/xenv_boundaries.md` before proceeding.

## 2. Per-Boundary Semantic Check

For each boundary, apply the four-question checklist:

### Q1: What invariant does each side maintain?
Each side of the boundary has an invariant. Examples:
- EVM: `sum(balances) == initial_supply - burned + minted`
- Host: `sum(host_balances) == host_total_supply`
- Precompile: `msg.sender is the caller`

List both invariants explicitly.

### Q2: Does crossing the boundary preserve both invariants?
Trace a value / state update from one side to the other. Does the accounting on both sides end consistent?

**Known exemplar (Optimism SELFDESTRUCT)**: when a contract SELFDESTRUCTed, Optimism zeroed the contract's internal balance but forgot to remove the balance from the OVM_ETH ERC-20 total → the value was duplicated.

**Check pattern**: for every cross-boundary operation, write out pre-state and post-state on BOTH sides and verify conservation.

Tag: `[XE-CONS:{boundary}:{invariant}:{break-path}]`

### Q3: Does the boundary inherit the caller's context correctly?
Precompiles, system contracts, and host-function wrappers all face the question: "what does `msg.sender` / `caller` mean when I'm called via DELEGATECALL?"

**Known exemplar (Moonbeam delegatecall-to-precompile)**: pwning.eth showed that a malicious contract could DELEGATECALL into Moonbeam's native-token precompile, which then used the caller's identity without realizing the call-context had been rewritten. Attacker impersonated liquidity pools and drained them.

**Check pattern**: for every precompile / system contract, list what it does with `msg.sender`. Then ask: does it treat DELEGATECALL correctly? If the answer is "it doesn't know or doesn't check," that's a finding.

Tag: `[XE-CONTEXT:{precompile}:{delegatecall-handling}]`

### Q4: Do integer widths match across the boundary?
Cross-environment value passing often crosses integer-width boundaries. EVM uses uint256; Substrate uses u128; Solana lamports are u64.

**Known exemplar (Polkadot Frontier 128-bit truncation)**: msg.value is uint256 in Solidity; Substrate balance is u128. Frontier truncated the top bits when passing value into the host call. An attacker passed `2^128 + X`, the host saw `X`, but the contract saw `2^128 + X` — the contract credited itself with a massive amount while only `X` actually moved.

**Check pattern**: for every value passed across the boundary, list the source width and destination width. If source > destination, check for an explicit range check that rejects values above the destination's max. **Silent truncation is always a bug.**

Tag: `[XE-WIDTH:{src-width}→{dst-width}:{check-status}]`

### Q4a: FFI / ABI integer width

If the boundary crosses Rust/Go ↔ C/C++/CUDA instead of one VM ↔ another,
enumerate every integer type at the ABI:

- `long` / `unsigned long`
- `size_t`
- pointer-sized integers

Check whether the code assumes LP64 semantics while the deployment target may
be LLP64 (for example Windows). Any 64-bit semantic value passed through
`long`/`unsigned long` without an explicit width check is a truncation finding.

Tag: `[XE-FFI-WIDTH:{type}]`

## 3. Differential Diff Pattern (for forks)

If the target is a fork of an upstream EVM client (op-geth, op-reth), the highest-leverage analysis is diff-based:

1. `git diff upstream/main...HEAD -- core/vm/`
2. For every modified opcode or precompile, trace the behavior difference
3. Ask: does the modification preserve the upstream's invariants on both sides?

Many L2 bugs are "upstream-behavior-X was changed to Y to support L2 feature Z, but the change broke invariant W." This pattern catches the whole class.

Tag: `[XE-FORK:{opcode}:{upstream}:{fork}:{invariant-broken}]`

## 4. Encoding and Serialization Drift

Precompiles and cross-environment calls rely on stable encoding:

- **RLP vs SSZ**: Ethereum uses RLP for some things, SSZ for others. Mixing them is a bug source.
- **Endianness**: EVM is big-endian; Solana/Substrate use little-endian for some fields. Boundaries must agree.
- **Struct alignment**: cross-language struct passing (C ABI) must match.
- **String vs bytes**: Solidity string is UTF-8 bytes; some hosts enforce strict UTF-8 validation.

Tag: `[XE-ENCODE:{drift}]`

## 5. Rollup-Specific Patterns

For optimistic or zk rollups:

### 5a. Deposit / withdrawal replay
- Is each deposit identified by a unique nonce?
- Can a rollup operator replay a deposit message?
- Withdrawals: is the proof of inclusion on L2 validated against L1 state root?

### 5b. Sequencer trust
- Who can sequence? Is there a fallback if the sequencer is offline?
- Sequencer can censor — is there a forced-inclusion mechanism?

### 5c. Fraud proof / validity proof
- Optimistic: challenge window correctness, bond management, dispute game termination
- ZK: verifier contract correctness, public input binding

## 5d. Reorg-aware Off-chain Finality (Vector76 class)

Off-chain components that act on chain state — watchers, relayers, bridges, indexers, exchange deposit crediters — must wait for SAFE finality before treating a transaction as settled. Treating N=1 confirmations (or any depth below the protocol's finality guarantee) as final, and updating accounting before that, is the Vector76 / one-confirmation double-spend class: the observed block is reorged out, the off-chain side has already credited/released, and the value is gone.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find confirmation-check call-sites and settlement/accounting write-sites; on-demand single-symbol source reads for the confirmation-gate and reorg-handler functions only; never bulk-read large files.

**Heuristics**:
1. Grep for `confirmations`, `>= 1`, `>= confirmations`, `min_conf`, `finalized`, `safe_block`, `is_final`, `mark_*_settled`, `credit`, `release`, `settle`, `process_deposit`, `on_new_block`, `head`.
2. **Confirmation threshold**: locate every site that gates an irreversible off-chain action (credit funds, release escrow, mark settled, advance a bridge nonce) on a confirmation count or block tag. Flag any that act on `confirmations >= 1`, on `latest`/`head` rather than `finalized`/`safe`, or on a depth below the chain's documented reorg-resistance bound.
3. **Reorg handler presence**: verify the off-chain component subscribes to reorg/head-change events AND has a rollback path that un-credits / re-queues any accounting it performed on a now-orphaned block. A settlement path with NO corresponding reorg-rollback handler is a finding.
4. **PoW vs finalized-chain nuance**: on a probabilistic-finality chain, the threshold must be depth-based and policy-justified; on a finality-gadget chain, acting before the `finalized` tag (not merely `safe`) for value-bearing actions is the bug.

**Severity**: irreversible value action on sub-finality confirmation is High–Critical (double-spend / loss); a missing reorg-rollback on a settlement path is High.

Tag: `[REORG-PREMATURE-SETTLE:{site}:{threshold}]`, `[REORG-NO-ROLLBACK:{component}]`

## 6. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Max u256 value across u128 boundary | send type(uint256).max | rejected or wrapped deterministically | |
| SELFDESTRUCT in cross-env contract | destroy + transfer | consistent on both sides | |
| DELEGATECALL to native precompile | call from malicious contract | context preserved or rejected | |
| Zero-value cross-boundary call | value = 0 | no state change on either side | |
| Deposit replay | same deposit id twice | rejected | |
| Withdrawal without state inclusion | withdrawal with invalid proof | rejected | |

## 7. Output schema

- **Layer**: cross-environment
- **Bug class**: conservation-break / context-confusion / integer-width-drift / encoding-drift / rollup-specific
- **Preferred evidence tags**: `[DIFF-PASS]` (differential against upstream) > `[CONFORMANCE-PASS]` > `[LSP-TRACE]`
- **Severity baseline**: Critical (all three famous exemplars were Critical)

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **Optimism SELFDESTRUCT infinite ETH ($2,000,042 bounty, Saurik, February 2022)** — OVM 2.0 handling of SELFDESTRUCT with self as beneficiary doubled the balance each call instead of burning it. Caused by skipping the upstream geth branch that handles self-referential destruct. **THE canonical cross-env bug.** [Saurik writeup](https://www.saurik.com/optimism.html); [Optimism disclosure](https://optimismpbc.medium.com/disclosure-fixing-a-critical-bug-in-optimisms-geth-fork-a836ebdf7c94). **Skill catch point**: Section 3 (Differential diff pattern) — for every L1 fork, produce a delta-diff against upstream and manually review every opcode-handler change.

2. **Moonbeam delegatecall precompile bypass ($1M + $50k bounty, pwning.eth, May 2022)** — custom precompiles (XC-20, staking, democracy) did not distinguish CALL from DELEGATECALL. Malicious contract could DELEGATECALL the precompile, impersonate `msg.sender`, and access precompile storage of any user. Could drain ~$100M of liquidity. [Immunefi bugfix review](https://medium.com/immunefi/moonbeam-missing-call-check-bugfix-review-6279d609bdc5); [Moonbeam patch notice](https://moonbeam.network/blog/urgent-security-patch-for-custom-precompiles/). **Skill catch point**: Section 2 Q3 (context inheritance) — for every precompile, test whether DELEGATECALL invocation is handled. The direct answer-under-test is `context.call_type() != DELEGATECALL` at entry.

3. **Polkadot Frontier uint256→u128 truncation ($1M bounty, pwning.eth, June 2022)** — Substrate uses u128 balances; Frontier truncated EVM u256 transfer amounts. `transferFrom(type(uint128).max + 1)` truncated to 0 but bypassed validation. Attacker received huge credit. Affected Moonbeam, Astar, Acala — **~$200M at risk**. [Immunefi bugfix review](https://medium.com/immunefi/moonbeam-astar-and-acala-library-truncation-bugfix-review-1m-payout-41a862877a5b); [pwning.eth writeup](https://pwning.mirror.xyz/RFNTSouIIlHVNmTNDThUVb1obIeN5c1LAiQuN9Ve-ok). **Skill catch point**: Section 2 Q4 (integer width) — validation must run against source value, not truncated value.

4. **Astar Network Frontier integer truncation ($50k bounty, Zellic, November 2023)** — same class as #3 but recurred in Astar after the Polkadot Frontier patch. Demonstrates that per-integration checks are not enough — the skill must demand an audit of the Frontier library itself and every upstream consumer. [Zellic writeup](https://www.zellic.io/blog/finding-a-critical-vulnerability-in-astar/); [Immunefi bugfix review](https://medium.com/immunefi/astar-network-integer-truncation-error-bugfix-review-395e356b085c). **Skill catch point**: dependency-audit-nodeclient — produce reverse-dep graph of shared crypto/VM libraries; any library affecting ≥2 L1/L2 networks is a critical-review target.

5. **Starknet L1-L2 felt252 address mismatch** — Ethereum addresses are 160-bit; Starknet addresses are felt252 (2^251 + 17·2^192). L1→L2 messages passing addresses may map valid L1 addresses to null or unexpected L2 addresses due to field truncation. [Cairo Security Flaws — oxor.io](https://oxor.io/blog/2024-08-16-cairo-security-flaws/). **Skill catch point**: Section 2 Q4 — any implicit type conversion on an address/identifier across environments is a finding.

### Critical methodology addition from Round 4 (the Frontier recurrence)

**Insert as new Section 3b**: The Moonbeam/Astar/Acala/Polkadot-Frontier chain of four bounties across 18 months shows this class is **systemic**, not incidental. Per-integration audits missed it. The skill must:

1. Enumerate every EVM-on-non-EVM / L1-on-L1 boundary in the target
2. Identify the shared library implementing the boundary (often `paritytech/frontier` for Substrate-EVM chains, custom bridge contracts for L2s)
3. **Audit the shared library itself** — not just the integration
4. Test every public entry with `type(uint256).max`, `type(uint128).max + 1`, `type(uint64).max + 1` at the boundary
5. Cross-reference: if you find a Frontier-class bug in Project A, immediately check Projects B, C, D using the same library version

Tag: `[XE-SHARED-LIB:{library}:{consumers}]`

## 9. Fallback if primitives unavailable

- List all `precompile` / `precompiled_contract` implementations
- List all L1 ↔ L2 boundary functions (deposit, withdrawal, message relay)
- For each, read the implementation end to end
- Cross-reference against upstream base client if it's a fork

## Cross-references

- Related: `execution-client-hardening` (opcode semantics), `light-client-proof-verification` (rollup proof verification)
- Consumed by: `depth-external`, `depth-state-trace`
- Severity: `docs/l1-mode/severity-matrix.md`
