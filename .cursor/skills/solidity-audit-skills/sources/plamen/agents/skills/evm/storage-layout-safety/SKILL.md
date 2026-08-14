---
name: "storage-layout-safety"
description: "Type Thought-template (instantiate before use) - Trigger Pattern STORAGE_LAYOUT flag detected"
---

# Skill: Storage Layout Safety

> **Type**: Thought-template (instantiate before use)
> **Trigger Pattern**: STORAGE_LAYOUT flag detected
> **Inject Into**: depth-state-trace, depth-edge-case
> **Finding prefix**: `[SLS-N]`
> **Rules referenced**: R1, R4, R8, R10, R14

Covers: memory vs storage confusion, lost writes, proxy/upgrade storage collisions, inline assembly slot safety, and storage semantic corruption.

This vulnerability class exists ONLY on EVM - type-safe VMs (Move, Solana's Borsh model) enforce layout correctness at the runtime level. EVM's untyped 256-bit slot model permits silent corruption when layouts diverge.

---

## Trigger Patterns
```
proxy|upgradeable|diamond|delegatecall|EIP1967|StorageSlot|
sstore|sload|assembly\s*\{|tstore|tload|reinitializer|
UUPSUpgradeable|TransparentUpgradeableProxy|BeaconProxy
```

---

## Step 1: Storage Surface Inventory

Map the contract's persistent state surface before analyzing bugs:

| # | Variable | Type | Slot Assignment | Written By | Read By | Proxy-Relevant? |
|---|----------|------|----------------|-----------|---------|-----------------|

For each state variable, determine:
- Sequential layout (compiler-assigned) vs manual slot (EIP-1967, custom `bytes32` constant)?
- Accessed via Solidity or via assembly `sstore`/`sload`?
- For structs: trace slot computation (base + offset). For mappings: `keccak256(key . slot)`. For arrays: `keccak256(slot) + index`.

Tag: `[TRACE:variable={name} → slot={computation} → writers={functions}]`

---

## Step 2: Memory vs Storage Confusion

For each function operating on structs or complex types:

### 2a. Reference Type Assignment
Trace every local variable of struct, array, or mapping type:
- Declared as `storage` or `memory`?
- If `memory`: is the function INTENDING to modify persistent state? If yes → lost write (copy modified in memory, never persisted).
- If `storage`: does every code path that modifies the reference complete without early return before the write?

### 2b. Parameter Data Location
For each function accepting struct/array parameters:
- Is the parameter `memory` or `calldata`?
- Does the function modify the parameter expecting persistence? `function update(MyStruct memory s)` modifies `s.field` but `s` is a memory copy - original unchanged.

### 2c. Library Forwarding
For libraries called via `using ... for`:
- Does the library function take `storage` or `memory` references?
- Mismatch between caller expectation and library signature → silent behavioral change.

Tag: `[TRACE:function={name} → var={var} → location={memory/storage} → write_persisted={YES/NO}]`

---

## Step 3: Proxy Storage Layout Analysis

### 3a. Implementation vs Proxy Slot Overlap
- Map slots used by PROXY (admin, implementation, beacon).
- Map slots used by IMPLEMENTATION (state variables from slot 0).
- Any overlap? For EIP-1967: verify randomized slots match spec (`bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)`).

### 3b. Upgrade Layout Continuity
For each upgrade path (V1 → V2):
- V1 variables in SAME slots in V2? (no reordering, no type changes, no removed mid-sequence variables)
- New variables APPENDED after existing? (not inserted)
- Inheritance order identical? (different order = different slot assignment)
- `__gap` storage slots reserved? New variables consuming gap correctly?

### 3c. Diamond / Namespaced Storage
For EIP-2535 or namespaced storage:
- Each facet uses unique namespace (keccak256 of distinct string)?
- Can two facets share the same namespace accidentally?
- Storage structs within namespace consistent across facet upgrades?

Tag: `[TRACE:proxy_slot={N} → impl_var={name} → collision={YES/NO}]`

---

## Step 4: Assembly Storage Safety

For each inline assembly block using `sstore` or `sload`:

### 4a. Slot Computation
- Target slot hardcoded, constant-derived, or influenced by external input?
- If input-influenced → can attacker target ARBITRARY slots? Is slot value bounded/validated before `sstore`?

### 4b. Value Encoding
- Correctly handles types < 32 bytes? (`sstore` writes full 32 bytes - masking/shifting correct for packed slots?)
- For packed storage (multiple variables in one slot): does assembly preserve neighboring values?

### 4c. Transient Storage (EIP-1153)
If `tstore`/`tload` used:
- Correctly distinguished from `sstore`/`sload`? (transient cleared after tx, permanent is not)
- Critical state accidentally stored with `tstore` instead of `sstore`?

Tag: `[BOUNDARY:user_input={MAX} → computed_slot={value} → target={what_gets_overwritten}]`

### 4d. Hardcoded Offset into ABI-Encoded Data

**Processing**: ENUMERATE all `calldataload`/`mload(add(` sites with literal offsets + all byte-slicing with hardcoded N on dynamic-type data → PROCESS each against the criteria below → COVERAGE GATE before moving to Step 5.

**Scope**: Any code that reads from ABI-encoded data using hardcoded byte offsets rather than following offset pointers. This includes:
- `calldataload(N)` in assembly (raw calldata)
- `mload(add(data, N))` in assembly (bytes memory/calldata variable)
- `data[N:]` or `data[N:N+32]` byte-slicing in Solidity with hardcoded N
- Hardcoded offset arithmetic into nested `bytes` fields after `abi.decode`

Grep: `calldataload\(` with a numeric literal, `mload(add(` with a literal offset on a bytes variable, fixed-offset byte-slicing on decoded `bytes` data.

| Read Site | Mechanism | Offset | Hardcoded? | Into Dynamic-Type Content? | Value Used For | Same Value Read via abi.decode? |
|-----------|-----------|--------|-----------|---------------------------|----------------|-------------------------------|

**Root cause**: ABI encoding is a convention, not enforced by the EVM. Dynamic types (`bytes`, `string`, `T[]`) use offset pointers — the content can be placed anywhere the pointer says. Hardcoded offsets assume canonical pointer values. A caller can supply non-canonical (but ABI-valid) encoding, making the hardcoded position contain attacker-controlled data instead of the expected field. This applies at every nesting level — top-level calldata, inner `bytes` fields, and nested structs.

**Three impact categories**:

**HIGH/CRITICAL — Dual-read divergence**: Hardcoded-offset read + the same value also read via `abi.decode` or pointer-following elsewhere. The two reads see different values. Enables: authorization bypass (auth sees attacker, execution sees victim), accounting divergence (check validates amount X, transfer uses amount Y).

**MEDIUM — Single-read assumption violation**: Hardcoded-offset read into dynamic-type content, value is security-critical, no dual-read exists but offset pointer is not validated as canonical. The contract reads attacker-controlled data as a trusted field. Latent Critical — any future addition of `abi.decode` on the same data creates dual-read divergence.

**MEDIUM — Revert injection / DoS**: Hardcoded-offset read lands on attacker-controlled data that triggers a revert (zero address, overflow, out-of-bounds). Legitimate calldata (via canonical encoding) would succeed, but attacker-crafted non-canonical encoding causes revert. Enables: griefing specific operations, front-run DoS if attacker can submit a malformed version of a victim's pending transaction.

**MEDIUM — Hash divergence**: Contract hashes raw calldata or portions of it (via assembly `keccak256` over `calldatacopy` or manual packing) for signature verification, deduplication, or identity. Non-canonical encoding produces different hashes for logically identical inputs — or identical hashes for different inputs if overlapping tail pointers are used. Breaks: signature verification, replay protection, UserOp-style identity schemes.

**Do not report if**: The read targets a static-type parameter in the ABI head area (position is fixed regardless of offset pointers), or the value is not security-critical, or the contract validates that the offset pointer equals the expected canonical value before reading.

**Additional note — memory vs calldata decoding inconsistency**: Non-canonical calldata that decodes successfully via `abi.decode` from calldata may fail when the same bytes are copied to memory and re-decoded — the Solidity memory decoder is stricter. Code that copies calldata to memory then decodes should be checked for this asymmetry.

Tag: `[TRACE:hardcoded_read({mechanism}, offset={N}) → dynamic_type_content={YES/NO} → dual_read={YES/NO} → impact={DIVERGENCE/ASSUMPTION/REVERT_DOS/HASH_DIVERGENCE}]`

---

## Step 5: Storage Semantic Corruption

### 5a. Deletion Consistency
When mapping entries or array elements are deleted:
- ALL auxiliary structures updated? (index arrays, counters, totals, role flags)
- `delete mapping[key]` clears value but leaves stale entries in enumeration arrays?

### 5b. Bit Packing / Bitmap Operations
For manual bit packing:
- Every write correctly MASKs target bits without corrupting neighbors?
- Stale bits cleared on deletion? (`|= (1 << n)` to set but `= 0` instead of `&= ~(1 << n)` to clear → clears ALL bits)

### 5c. Uninitialized Storage Reads
Variables read before explicit write:
- Default value (0, address(0), false) a VALID state the code handles correctly?
- `require(configuredValue > 0)` but never set → permanent DoS. `if (admin == address(0)) { unrestricted }` → open access until set.

Tag: `[TRACE:delete={op} → auxiliary={state} → updated={YES/NO} → consumer={func} → reads_stale={YES/NO}]`

---

## Key Questions (must answer all)
1. Does the contract use sequential layout, manual slots, or both?
2. For proxy patterns: do implementation variables overlap with proxy admin slots?
3. For assembly: can any `sstore` target be influenced by external input?
4. For struct operations: are all memory-reference modifications intentional (not lost writes)?
5. For deletion: are all auxiliary data structures updated when primary state is removed?

## Common False Positives
- **EIP-1967 compliant**: Standard randomized slots with verified computation → no collision
- **Intentional memory copy**: Read-only computation on a copy, no intent to persist → not a lost write
- **Reserved gaps with matching inheritance**: `__gap` consumed correctly → no layout shift
- **Audited library assembly**: Well-tested library (e.g., OpenZeppelin `StorageSlot`) → lower risk

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Storage Surface Inventory | YES | | All state variables with slots |
| 2. Memory vs Storage Confusion | IF structs/complex types | | Data location of all references |
| 3. Proxy Storage Layout | IF proxy/upgradeable | | Slot overlap, upgrade continuity |
| 4. Assembly Storage Safety | IF assembly with sstore/sload | | Slot computation, value encoding |
| 4d. Hardcoded Offset into ABI Data | IF calldataload/mload at hardcoded offset OR byte-slicing with literal offset on dynamic-type data | | Dual-read divergence, assumption violation, revert injection |
| 5. Storage Semantic Corruption | IF delete/restructure ops | | Auxiliary state consistency |
