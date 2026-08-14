---
name: "contract-upgradeability"
description: "Trigger Pattern update_current_contract_wasm detected in codebase - Inject Into Breadth agents, depth-state-trace"
---

# CONTRACT_UPGRADEABILITY Skill (Soroban)

> **Trigger Pattern**: `update_current_contract_wasm` detected in codebase
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[CU-N]`
> **Rules referenced**: R6, R10, R12, R13

Soroban provides `env.deployer().update_current_contract_wasm(new_wasm_hash)` for in-place contract upgrades. This is more powerful than EVM proxy patterns — it directly replaces the executing contract's WASM bytecode without changing the contract address or storage. Unrestricted upgrade capability is an absolute control vector; the upgrade gate must be airtight.

## 1. Upgrade Access Control

Locate every call to `update_current_contract_wasm` and verify the auth gate:

| Location | Auth Check Present? | Auth Address | Auth Type | Sufficient? |
|----------|--------------------|--------------|-----------|-----------|
| `{file:line}` | YES/NO | `{admin / multisig / NONE}` | `require_auth` / `require_auth_for_args` / NONE | YES/NO |

**Minimum requirement**: The upgrade function MUST call `require_auth()` or `require_auth_for_args()` on a privileged address before calling `update_current_contract_wasm`.

**Patterns to flag as insufficient**:
- No auth check at all (anyone can upgrade)
- Auth check on a non-admin address (e.g., any token holder)
- Auth check after `update_current_contract_wasm` is called (too late — code already replaced)
- The privileged address is stored in Temporary storage (can be deleted/expired, unlocking upgrade for anyone)

**Also check**:
- Is the admin address itself protected from replacement without auth? (see Section 3)
- Can the upgrade function be called during initialization before admin is set? (init race)

## 2. Migration Safety

An upgrade replaces WASM but preserves ALL storage. If the new WASM has a different storage layout or new required keys, the upgrade function must handle migration:

| Concern | Addressed? | Evidence | Risk if Not Addressed |
|---------|-----------|----------|----------------------|
| New storage keys initialized after upgrade | YES/NO | `{fn:line or NONE}` | Panics on first access of uninitialized key |
| Removed storage keys cleaned up | YES/NO | `{fn:line or NONE}` | Bloat only (low risk unless size-bounded) |
| Struct fields added/removed (ABI break) | YES/NO | `{fn:line or NONE}` | Deserialization panic on old data |
| Version discriminator stored | YES/NO | `{fn:line or NONE}` | Cannot detect state of migration |

**Migration pattern check**:
```rust
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
    // Step 1: Auth gate
    let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap();
    admin.require_auth();
    // Step 2: Replace WASM
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    // Step 3: Migrate storage (if needed)
    // env.storage().instance().set(&DataKey::NewField, &default_value);
}
```

**Absence of migration**: If the upgraded WASM accesses storage keys or uses different struct layouts than the currently-stored data, ALL post-upgrade operations will panic. This is effectively a self-inflicted DoS on upgrade.

## 3. Admin Key Management

The admin address used to gate upgrades is itself a critical piece of state. Trace how it is set, updated, and protected:

| Operation | Location | Auth Required? | Two-Step Transfer? | Notes |
|-----------|----------|---------------|-------------------|-------|
| Initial admin set (init) | `{file:line}` | N/A (first call) | N/A | Is there a re-init guard? |
| Admin transfer/update | `{file:line}` | YES/NO | YES/NO | Single-step is dangerous |
| Admin stored in | `{DataKey}` | — | — | Instance/Persistent/Temporary? |

**Critical checks**:
- Admin stored as Temporary: if it expires, the contract becomes permanently non-upgradeable AND the upgrade slot is open to whoever sets themselves as admin via any unguarded init path
- Single-step admin transfer: `set_admin(new_admin)` without two-step handshake means a mistaken address transfer is irreversible
- Admin key not set on init: if the initialize function does not set the admin, the first caller of any admin function can claim admin
- Admin set to the zero address or contract address by accident

**Two-step transfer pattern (recommended)**:
```rust
// Step 1: current admin proposes new admin
pub fn propose_admin(env: Env, new_admin: Address) { ... }
// Step 2: new admin accepts
pub fn accept_admin(env: Env) { ... }
```

## 4. Upgrade Event Emission

The Soroban host automatically emits a `contract_upgraded` system event on WASM replacement. However, the contract should also emit its own application-level event for indexer/monitoring visibility:

| Concern | Status | Notes |
|---------|--------|-------|
| Host system event auto-emitted | ALWAYS (host behavior) | Not controllable by contract |
| Contract-level upgrade event emitted | YES/NO | Recommended for off-chain monitoring |
| Event includes new WASM hash | YES/NO | Enables tracing what was deployed |
| Event includes timestamp / ledger | YES/NO | Enables timeline reconstruction |

**Finding threshold**: Missing contract-level upgrade event is Low/Informational severity — the host event provides a baseline. Flag as Medium if the protocol's stated design includes monitoring hooks that depend on contract events.

## 5. Immutability Option

Some protocols intend to make contracts permanently immutable after a stabilization period. Check whether such a mechanism exists and is correctly implemented:

| Mechanism | Present? | Implementation | Correctness |
|-----------|---------|---------------|------------|
| Upgrade function can be permanently disabled | YES/NO | `{description or NONE}` | YES/NO/N/A |
| Immutability flag stored | YES/NO | `{DataKey}` | Stored as Persistent? |
| Immutability flag checked before upgrade | YES/NO | `{fn:line}` | Before or after auth? |

**Pattern**:
```rust
pub fn freeze_upgrades(env: Env) {
    admin.require_auth();
    env.storage().instance().set(&DataKey::Frozen, &true);
}

pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
    // Check frozen BEFORE auth (fail fast)
    let frozen = env.storage().instance().get::<_, bool>(&DataKey::Frozen).unwrap_or(false);
    require!(!frozen, "contract is immutable");
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
```

**Finding for incorrect ordering**: If the frozen check occurs AFTER `require_auth`, an admin can bypass the intent by upgrading before freezing. The frozen check must be unconditional and first.

## Finding Template

```markdown
**ID**: [CU-N]
**Severity**: [Critical if unguarded upgrade, High if admin management flaw, Medium if migration risk, Low if event/immutability]
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R6:✓/✗, R10:✓/✗, R12:✓/✗, R13:✓/✗]
**Location**: src/{contract}.rs:LineN
**Title**: {Missing auth / migration gap / admin flaw} in upgrade path — {impact}
**Description**: [Specific upgradeability issue with code reference]
**Impact**: [Unauthorized upgrade / post-upgrade DoS / admin key loss / irrecoverable state]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Upgrade Access Control | YES | ✓/✗/? | Every `update_current_contract_wasm` call |
| 2. Migration Safety | YES | ✓/✗/? | Storage layout compatibility |
| 3. Admin Key Management | YES | ✓/✗/? | Init, transfer, storage type |
| 4. Upgrade Event Emission | YES | ✓/✗/? | Contract-level event presence |
| 5. Immutability Option | IF freeze mechanism present or stated in docs | ✓/✗(N/A)/? | Freeze ordering and storage type |
