---
name: "execution-client-hardening"
description: "L1 trigger - audits execution engine (EVM interpreter, WASM, SVM) for memory corruption, gas mispricing (EXTCODESIZE class), opcode semantics, and VM invariant breaks."
---

# Injectable Skill: Execution Client Hardening

> **L1 trigger**: `L1_PATTERN=true` AND (`core/vm/` OR `revm` OR `interpreter` OR `opcodes.go` OR `evm-exec` OR `svm/` OR `move-vm` OR `wasmi` detected in recon subsystem map)
> **Inject Into**: `depth-state-trace` or `depth-external`
> **Language**: Go, Rust, occasionally C++
> **Finding prefix**: `[EX-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-state-trace (VM state transitions)
- Sections 3, 4: depth-edge-case (opcode semantics)
- Section 5: depth-external (gas metering)
- Section 6: depth-consensus-invariant (cross-client consistency)

## When This Skill Activates

Recon identifies a VM / execution engine. Covered VMs: EVM (all execution clients), SVM (Solana), Move VM (Aptos, Sui), WASM runtimes (NEAR, Polkadot), custom VMs. Client-vs-client divergence in VM behavior is Critical — historically several Ethereum consensus splits were VM implementation bugs.

## 1. Opcode Coverage Mapping

Enumerate every opcode / instruction the VM supports. For EVM, consult the latest Yellow Paper + EIPs. For others, the spec document.

| Opcode | Gas cost | Stack delta | State touched | Notes |
|---|---|---|---|---|

This mapping grounds later checks. A new client must implement every opcode; a fork client must not accidentally remove or reprice any opcode.

Tag: `[OPCODE-COVERAGE:{missing-or-extra}]`

## 2. Gas / Resource Metering

Every operation must be priced to cover its real cost. Historical bugs: Ethereum Shanghai attacks (2016) — EXTCODESIZE was too cheap relative to disk I/O.

### Patterns to check
- **Disk-touching opcodes**: SLOAD, SSTORE, EXTCODESIZE, EXTCODECOPY, EXTCODEHASH, BALANCE. Gas cost must reflect the (possibly cold) storage fetch.
- **Recursive opcodes**: CALL, DELEGATECALL, CALLCODE, STATICCALL. Gas forwarding (63/64 rule) correctness.
- **Memory-expanding opcodes**: MLOAD, MSTORE, RETURNDATACOPY, MCOPY. Memory expansion gas must be computed before the access.
- **Hashing**: KECCAK256 cost proportional to input size.
- **Log emission**: LOG0-LOG4 cost proportional to data size.

### Warm/cold access (EIP-2929)
- Access list enforcement: first touch is cold (more expensive), subsequent warm
- Is the access list correctly reset per transaction?
- On reverted subcalls, does the access list roll back correctly?

Tag: `[GAS-MISPRICE:{opcode}:{actual-cost}:{charged-cost}]`

## 3. Opcode Semantics

For each opcode, the semantics must match the spec exactly. Common drift points:

### 3a. SELFDESTRUCT
- Pre-Cancun: destroys contract, transfers balance
- Post-Cancun (EIP-6780): only transfers balance if called in same tx as creation
- Bug class: incorrect balance accounting (see Optimism OVM_ETH exemplar)

### 3b. CREATE / CREATE2
- Address calculation: CREATE = hash(sender, nonce); CREATE2 = hash(0xff, sender, salt, init_code_hash)
- Collision handling: what happens if the computed address already has code/balance/nonce?
- Init code size limit (EIP-3860)

### 3c. RETURNDATACOPY
- Out-of-bounds access must revert (EIP-211)
- Returns empty buffer if no return data (not panic)

### 3d. PUSH0 (EIP-3855)
- Valid only post-Shanghai. Pre-Shanghai must be invalid.

### 3e. TLOAD / TSTORE (EIP-1153)
- Transient storage; resets per transaction
- Interaction with reverts

### 3f. MCOPY (EIP-5656)
- Memory copy, post-Cancun

### 3g. BLOBHASH / BLOBBASEFEE (EIP-4844)
- Blob-related

Tag: `[OPCODE-SEM:{opcode}:{drift}]`

## 4. Precompiles

Precompiles are native implementations of common functions at fixed addresses.

### Check per precompile
- Is the precompile address correct? (e.g., 0x01 ECRECOVER, 0x02 SHA256, ...)
- Is the gas cost formula correct? Many precompiles have length-dependent gas.
- Is the input validated? Precompile panics crash the client.
- **Context-dependent inputs** (like Moonbeam's precompile-delegatecall bug): does the precompile care whether it's invoked via CALL vs DELEGATECALL? If yes, is it enforced?

Tag: `[PRECOMPILE:{address}:{issue}]`

## 5. Memory Safety

For Go clients, memory safety is largely on the runtime. For Rust clients (reth, revm), `unsafe` blocks in the VM are a bug source.

**Check**:
- Every `unsafe` in the interpreter hot path
- Every raw pointer manipulation
- Every length-based slicing — off-by-one crashes the VM

Interaction with `rust-unsafe-audit` skill.

## 5b. Interned/Compacted Identity Coherence

**Trigger**: The code assigns a compact numeric index or handle to a named
entity (a type, account, resource, module, or similar) — typically to avoid
storing the full name/key repeatedly — and one or more OTHER structures cache
data derived from that entity, keyed by the compact index rather than by the
entity's original identity. Common in interning tables, symbol/type caches,
and any "intern this name once, refer to it by a small integer afterward"
optimization (for example, a Move VM-style loader that interns module/type
identities into a numeric table).

**Why this is structurally distinct from §8's cache lifecycle set-cover**:
§8 concerns a SINGLE bounded cache whose OWN entries go stale or grow
unbounded. This section concerns MULTIPLE structures that share one index/
handle space, where one structure can be reset/compacted while a SIBLING
structure — keyed by the same index space — is not, so a recycled index
silently points a stale consumer at a different entity's data. This is an
asymmetric-invalidation bug across coupled structures, not a single eviction
policy gap, and set-cover on one structure's legs will not catch it.

**Methodology**:

1. **Enumerate every structure keyed by the index/handle space** — not just
   the primary interning map. Grep for the index type's name (e.g. a
   `TypeIndex`, `ModuleHandle`, or similar newtype) across the codebase and
   list every map/vector/cache that uses it as a key, not just the one that
   assigns it.
2. **For every reset / flush / compact / GC path on ANY of those structures**,
   verify that ALL of them are invalidated together, in the SAME atomic step.
   A reset that clears the primary interning table but leaves a derived cache
   populated (or vice versa) is the bug.
3. **Check whether index/handle assignment can restart from a low or
   previously-used value after a partial reset** (e.g. a counter reset to 0,
   or a freelist that recycles slots). If assignment can produce a value that
   used to belong to a different entity, and any sibling structure still holds
   an entry under that recycled value, a lookup now silently resolves to the
   WRONG entity's data instead of erroring.
4. **Trace whether any derived identity is computed by looking up the
   recycled index in a structure that is NOT part of the reset** — e.g. a
   storage/lookup key, a resource type, or a permission/capability scope
   derived by indexing into a stale sibling structure. This is the concrete
   exploitation mechanism: the recycled index doesn't just serve stale bytes,
   it makes the system compute a DIFFERENT identity than the one the caller
   intended (structurally analogous to a native-vs-wrapped token mixup, where
   the same numeric handle is silently resolved against the wrong underlying
   asset).

**Required check**: for the primary index/handle-assigning structure and every
sibling structure found in step 1, confirm they are reset by the SAME
function/transaction boundary, not by independently-triggered paths. Two
reset paths that are supposed to stay in lockstep but are invoked from
different call sites are a red flag even if both eventually run.

Tag: `[IDENTITY-COHERENCE:{index-space}:{structures-affected}]`

Severity baseline: High to Critical when the recycled index can be attacker-
influenced (attacker controls timing/ordering of the partial reset and the
next allocation) and the derived identity affects storage/permission
resolution; Medium when reachable only through operator/admin-triggered
resets.

## 6. Cross-Client Consistency (for forks and alt-clients)

If the target is a fork of an upstream execution client:

1. `git diff upstream/main...HEAD -- core/vm/` (or equivalent)
2. For each modified opcode, cross-check against the reference (EVM reference implementation `py_ecc` or `execution-spec-tests`)
3. For each precompile, test with reference vectors

Tag: `[VM-DRIFT:{opcode-or-precompile}]`

## 7. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Empty code | contract with 0 bytes | spec-defined | |
| Max code size | 24576 bytes (EIP-170) | accepted | |
| Code size + 1 | 24577 bytes | rejected on CREATE | |
| Gas = 0 | call with 0 gas | out-of-gas | |
| Stack overflow | 1025 items on stack | revert, not panic | |
| Stack underflow | POP on empty stack | revert, not panic | |
| Memory OOB | MLOAD from MAX_U256 | out-of-gas (memory expansion cost) | |
| SELFDESTRUCT after state change | tx does CREATE then SELFDESTRUCT | correct accounting (post-EIP-6780) | |

## 8. Output schema

- **Layer**: execution
- **Bug class**: gas-misprice / opcode-semantics / precompile / memory-safety / cross-client-drift
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (execution-spec-tests / Hive) > `[DIFF-PASS]` (Fluffy-style differential) > `[LSP-TRACE]`
- **Severity baseline**: Critical for cross-client divergence; High for gas mispricing; Medium for precompile bugs without fund loss

## 9. Known bug exemplars (v0.2 — Round 4 verified)

1. **2016 Shanghai EXTCODESIZE DoS (block 2283416)** — EXTCODESIZE cost ~20 gas but required a disk read of contract code. Attacker invoked it ~50k times per block, forcing 50k disk reads and 20-60s block validation times. Parity unaffected, Geth crawled to a halt. **Fix codified as [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929) years later.** [EF blog](https://blog.ethereum.org/2016/09/22/ethereum-network-currently-undergoing-dos-attack); [ethos.dev Shanghai attacks](https://ethos.dev/shanghai-attacks). **Skill catch point**: Section 2 — the **gas-per-disk-read ratio** is the core invariant. Any opcode where (disk_reads × disk_latency) >> (gas_cost × gas_rate) is a gas-mispricing finding.

2. **Geth RETURNDATACOPY corruption (CVE-2020-26241, Fluffy OSDI '21)** — precompile `dataCopy` did shallow copy of input; subsequent memory write aliased RETURNDATA, causing divergence from other clients. Found via multi-tx differential fuzzing. [Fluffy paper](https://www.usenix.org/system/files/osdi21-yang.pdf). **Skill catch point**: Section 4 (precompiles) — every opcode that writes to RETURNDATA must fully copy, not alias.

3. **Geth transfer-after-destruct (CVE-2020-26265, Fluffy OSDI '21)** — transfer semantics to already-destructed contract diverged between Geth and OpenEthereum. Caused mainnet hard fork event 4 months after disclosure. **Skill catch point**: Section 3a (SELFDESTRUCT semantics) — model contract lifecycle transitions (create → live → destruct → resurrect) and verify each produces identical output across clients.

4. **Aptos MoveVM integer overflow DoS (October 2022)** — MoveVM arithmetic lacked overflow guard; crafted input triggered DoS / chain halt potential. Patched. [CyberExpress report](https://thecyberexpress.com/critical-vulnerability-in-aptos-movevm-patched/). **Skill catch point**: Section 5 (memory safety / arithmetic) — every VM arithmetic op must use `checked_*` or explicit modular arithmetic. Every `as` cast between integer widths is a narrowing-overflow candidate.

5. **Moonbeam precompile CALL/DELEGATECALL confusion ($1M + $50k bounty, pwning.eth, 2022)** — Moonbeam's custom precompiles (XC-20, staking, democracy) did not distinguish CALL from DELEGATECALL. A malicious contract could DELEGATECALL the precompile and impersonate `msg.sender` of the original caller, accessing precompile storage of any user. [Immunefi bugfix review](https://medium.com/immunefi/moonbeam-missing-call-check-bugfix-review-6279d609bdc5). **Skill catch point**: Section 4 — for every custom precompile, assert `context.call_type() != DELEGATECALL` at entry. See also `cross-environment-semantic-drift`.

### Critical methodology addition from Round 4 (gas-per-disk-read ratio)

**Insert as new Section 2f**: The Shanghai lesson has been re-learned multiple times. The core invariant:

```
For every opcode O:
  worst_case_wall_clock(O) <= gas_cost(O) / target_gas_rate
```

Where `target_gas_rate` is the protocol's gas-per-second target (Ethereum: ~10M gas / 12s = 833k gas/s).

Check: for every opcode that touches disk, network, or complex computation, compute `worst_case_wall_clock / gas_cost`. Any ratio suggesting the opcode can be invoked enough times per block to violate the gas-rate budget is a finding.

Tag: `[GAS-RATIO:{opcode}:{worst-ns}:{gas-cost}:{violates?}]`

## 9. Unused Configuration Parameter Audit

A parameter declared in `struct Config` / `Params` / `ChainSpec` that is never read is often a missing enforcement — the developer intended the parameter to cap something but forgot to wire it in. This class hides real resource-bound vulnerabilities.

**Methodology**:
1. Find every public field in the protocol's `Config` / `Params` / `ConsensusParams` / `ChainConfig` struct.
2. For each field, grep the entire codebase for read sites. Use pre-baked `{SCRATCHPAD}/scip/xref_map.md` or Grep on `.{field_name}`. (MCP tools are unavailable in subagent contexts per Claude Code bug #25200.)
3. A field with ZERO read sites in any validator / enforcer / adjuster is a finding.
4. A field read only in test / debug / display code is a finding — it means production doesn't enforce it.
5. Pay special attention to fields with names like `max_*`, `min_*`, `limit_*`, `cap_*`, `ceiling_*`, `floor_*`, `bound_*` — these are almost always intended as enforcement.
6. A field read only in ONE branch of a condition may be dead in the hot path.

**Required artifact**: `{SCRATCHPAD}/config_parameter_usage.md`:

```markdown
| Field | Declared at | Read sites (count) | Enforced? | Notes |
|---|---|---|---|---|
| max_validators | ChainConfig:L42 | 3 | YES | EndBlocker.apply_updates |
| max_difficulty_adjustment_factor | ChainConfig:L51 | 0 | **NO** | **UNUSED — difficulty spike unbounded** |
| min_commit_depth | ChainConfig:L63 | 1 (test only) | **NO** | read only in test_harness.rs |
| max_commitment_txs_per_block | ChainConfig:L89 | 0 | **NO** | **UNUSED — commitment flood possible** |
```

Every "NO" row is a finding. Severity depends on what the parameter was supposed to bound — parameters that would have capped a resource are Medium to High.

**False positives**: parameters read only by genesis (legitimately one-time), parameters read transitively through a cloned config struct (grep misses it — verify with SCIP), parameters reserved for future versions (should be commented `// reserved`, otherwise flag).

Tag: `[CONFIG-UNUSED:{field_name}]`, `[CONFIG-TEST-ONLY:{field_name}]`

## 10. Fallback if primitives unavailable

- Find the opcode dispatch table (`switch op` in Go, `match opcode` in Rust)
- Read each arm
- Cross-reference against the spec (latest Yellow Paper section)
- Grep for `SELFDESTRUCT`, `CREATE2`, `MCOPY` individually

## Cross-references

- Related: `cross-environment-semantic-drift` (L1/L2 semantic differences), `consensus-safety-invariants` (cross-client divergence is a consensus bug), `rust-unsafe-audit` (for Rust VMs)
- Consumed by: `depth-state-trace`, `depth-external`, `depth-consensus-invariant`
- Severity: `docs/l1-mode/severity-matrix.md`
