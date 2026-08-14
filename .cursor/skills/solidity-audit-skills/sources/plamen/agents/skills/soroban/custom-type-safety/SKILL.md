---
name: "custom-type-safety"
description: "Trigger Pattern contractimport! or contracttype detected - Inject Into Breadth agents, depth-external"
---

# CUSTOM_TYPE_SAFETY Skill (Soroban)

> **Trigger Pattern**: `contractimport!` or `#[contracttype]` detected in codebase
> **Inject Into**: Breadth agents, depth-external
> **Finding prefix**: `[CT-N]`
> **Rules referenced**: R4, R8, R10

Soroban contracts interact with external contracts through generated client bindings (`contractimport!`) and pass structured data across boundaries using `#[contracttype]` types. Both mechanisms carry security-relevant assumptions about versioning, type stability, and deserialization behavior that must be verified.

## 1. Import Dependency Audit

For every `contractimport!` macro invocation, identify what is being imported and whether it is pinned:

| Import Target | File/Path or Wasm Hash | Version Pinned? | Pinning Method | Stable? |
|--------------|----------------------|----------------|---------------|--------|
| `contractimport!("{target}")` | `{resolved path or hash}` | YES/NO | Hash / Path / None | YES/NO |

**Pinning methods (strongest to weakest)**:
1. **WASM hash**: `contractimport!(file = "...", sha256 = "0xabc...")` — exact bytecode pinning, most secure
2. **Specific file path in repo**: deterministic if the file is version-controlled alongside the contract
3. **Dynamic path or URL**: fetched at build time, non-deterministic — flag as HIGH risk

**Checks**:
- Is the imported contract itself audited / trusted?
- Does the import target a well-known protocol (e.g., the Stellar DEX, a lending protocol)? If so, any upgrade to that protocol silently changes the interface the importing contract relies on.
- For imported WASM: is the hash pinned in the build manifest? If the WASM file is replaced without updating the hash, the build fails (good). If no hash is required, the build silently uses a new version.

## 2. Type Boundary Safety

When values of `#[contracttype]` types cross contract boundaries via `invoke_contract`, the receiving contract must be able to deserialize them. Verify semantic meaning is preserved:

| Type | Crosses Boundary? | Sending Contract Version | Receiving Contract Version | Compatibility? |
|------|------------------|------------------------|--------------------------|---------------|
| `{StructName}` | YES/NO | `{version or hash}` | `{version or hash}` | YES/NO |

**Safety rules**:
- `#[contracttype]` types serialize to `ScVal` using field names as keys (for structs) or variant names (for enums). Adding fields with defaults is safe; removing fields or renaming them breaks existing serialized data.
- If both the sending and receiving contracts are part of the same audit scope, verify the types match exactly.
- If the receiving contract is external (different deploy), verify the external contract's expected type schema matches what the sending contract sends.

**Type confusion risk**: A `#[contracttype]` enum variant that serializes to the same `ScVal` representation as a variant in a different enum is a type confusion vector. This is rare but check when two enums use identical variant names or when raw `Val` conversions are used.

## 3. Stale Dependency Detection

An imported contract may have been upgraded since the `contractimport!` snapshot was taken. If the imported ABI has changed, calling the contract with the old-generated client will fail at runtime:

| Imported Contract | Import Snapshot Date / Hash | Currently Deployed Hash | ABI Drift? | Breaking Changes? |
|------------------|-----------------------------|------------------------|-----------|-----------------|
| `{contract name}` | `{date or hash from file}` | `{check stellar explorer or build_status}` | YES/NO/UNKNOWN | YES/NO/UNKNOWN |

**How to detect**:
1. Compare the WASM hash in the `contractimport!` statement against the currently deployed contract's WASM hash via the Stellar network
2. If hashes differ, inspect the changelog or diff the generated client bindings against the current contract interface
3. Flag any function signature changes: added required parameters, changed parameter types, removed functions

**Impact of stale imports**: Runtime deserialization errors (`InvalidAction` / `WasmError`) when calling functions whose signatures have changed. The contract compiles successfully but fails at runtime, potentially during critical operations.

## 4. Custom Type Validation

`#[contracttype]` enums and structs must handle all serialization edge cases. Verify correct handling:

| Type | All Enum Variants Handled in Match? | Default/Fallback for Unknown Variants? | Deserialization Panic on Unknown? |
|------|-------------------------------------|---------------------------------------|----------------------------------|
| `{EnumName}` | YES/NO | YES/NO | YES/NO → FLAG if YES |

**Enum exhaustiveness**:
```rust
#[contracttype]
pub enum Status {
    Active,
    Paused,
    Closed,
}

// SAFE: all variants covered
match status {
    Status::Active => ...,
    Status::Paused => ...,
    Status::Closed => ...,
}

// RISKY: if a new variant is added to the external contract's Status,
// deserialization succeeds but the match panics
match status {
    Status::Active => ...,
    Status::Paused => ...,
    // Missing: Status::Closed → panic at runtime
}
```

**Struct field additions**: If an external contract's `#[contracttype]` struct gains new fields, the importing contract's deserialization will fail with a type mismatch unless it uses versioned types or handles extra fields gracefully.

**For each `#[contracttype]` enum used in deserialization**:
- Verify the match arm is exhaustive (no missing variants)
- Verify the type is used as received from the same contract version it was imported from

## 5. Val Conversion Safety

Direct `Val` conversions (e.g., `Val::from_val`, `TryFromVal`, raw `RawVal` casts) bypass the typed `#[contracttype]` system. These must be handled with explicit error checking:

| Location | Val Conversion | Error Handled? | Type Confusion Risk? |
|----------|---------------|---------------|---------------------|
| `{file:line}` | `{conversion expression}` | YES/NO | YES/NO |

**Unsafe patterns**:
- `val.unchecked_into::<i128>()` — no type check, interprets raw bits as i128 regardless of actual type
- `TryFromVal::try_from_val(&env, val).unwrap()` — panics on type mismatch instead of returning an error
- Using `Val::from_bool` / `Val::from_i32` on unverified external input

**Safe patterns**:
- `TryFromVal::try_from_val(&env, val).map_err(|_| Error::InvalidInput)?` — handles type mismatch gracefully
- Using `#[contracttype]` types for all cross-boundary data (avoids raw Val entirely)
- Validating the `Val` tag before conversion: `val.is_i32` / `val.get_tag() == Tag::I32Val`

**Type confusion attacks**: If an attacker can influence the `Val` type tag (e.g., by passing an `Address` where an `i128` is expected), raw conversion will interpret the `Address` bits as an integer, producing arbitrary numeric values — potential for balance manipulation, permission bypass, or incorrect calculation results.

## Finding Template

```markdown
**ID**: [CT-N]
**Severity**: [High if type confusion enables fund theft or auth bypass, Medium if stale import causes DoS, Low if missing variant or pinning only]
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R4:✓/✗, R8:✓/✗, R10:✓/✗]
**Location**: src/{contract}.rs:LineN (or Cargo.toml/build.rs for Section 1)
**Title**: {Unpinned import / stale dependency / Val type confusion / missing variant} in `{context}`
**Description**: [Specific type safety issue with import target, type name, or conversion expression]
**Impact**: [Runtime deserialization panic / incorrect value interpretation / type confusion enabling exploit]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Import Dependency Audit | IF `contractimport!` present | ✓/✗(N/A)/? | All import targets, pinning method |
| 2. Type Boundary Safety | IF types cross contract boundaries | ✓/✗(N/A)/? | All #[contracttype] types in cross-boundary calls |
| 3. Stale Dependency Detection | IF `contractimport!` present | ✓/✗(N/A)/? | Snapshot hash vs deployed hash |
| 4. Custom Type Validation | IF #[contracttype] enums used in match | ✓/✗(N/A)/? | All match arms exhaustive |
| 5. Val Conversion Safety | IF raw Val conversions present | ✓/✗(N/A)/? | All unchecked_into / try_from_val calls |
