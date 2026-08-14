---
name: "migration-analysis"
description: "Trigger Pattern Contract upgrades via update_current_contract_wasm, storage migration, deprecated functions, token migrations - Inject Into Breadth agents, depth-state-trace"
---

# Skill: Migration Analysis (Soroban)

> **Trigger Pattern**: Contract upgrades via `update_current_contract_wasm`, storage migration, deprecated functions, token migrations
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[MG-N]`
> **Rules referenced**: R4, R9, R10

```
update_current_contract_wasm|upgrade|migrate|deprecated|migrat|
legacy|v2|V2|old_token|new_token|storage_migration|DataKey::
```

**Key Soroban difference from EVM**: There is no proxy pattern (no `delegatecall`). There is no BPFLoaderUpgradeable (Solana model). Soroban contract upgrade uses `env.deployer().update_current_contract_wasm(new_wasm_hash)`, which replaces the contract's WASM bytecode while preserving ALL storage in-place. The contract address and all storage entries survive the upgrade unchanged. This means:
1. Storage migration (if needed) must be performed manually — there is no automatic migration callback.
2. If the new WASM reads storage with a different key schema or different data type than what old WASM wrote, the reads will fail or silently return defaults.
3. Instance data, Persistent data, and Temporary data all persist through an upgrade — their TTLs continue ticking independently.

---

## Step 1: Identify Upgrade and Migration Patterns

Find all upgrade-related patterns:

- `update_current_contract_wasm` calls (the actual WASM upgrade mechanism)
- Storage migration functions (functions that read old-format data and write new-format data)
- Deprecated functions still callable after upgrade
- Old storage key definitions that may conflict with new ones
- Token migrations (old Stellar classic asset → new SAC, or old custom token → new token)

For each transition:
| Old Entity | New Entity | Upgrade/Migration Function | Who Can Call It | Is Migration Atomic with Upgrade? |
|------------|-----------|--------------------------|----------------|----------------------------------|

**Critical question for each upgrade entry point**: Is the upgrade function properly access-controlled with `require_auth(&admin_address)`? An unprotected `update_current_contract_wasm` is a **CRITICAL** vulnerability allowing any caller to replace the contract with arbitrary WASM.

---

## Step 2: Storage Schema Compatibility

For each upgrade that changes storage data structures:

1. What data keys and types exist in the OLD WASM?
2. What data keys and types exist in the NEW WASM?
3. Are new fields ADDED to a new key (safe) or do they REPLACE existing keys with different types (breaking)?
4. Does the new WASM attempt to deserialize old data with a new struct layout?

```rust
// Example mismatch:
// V1 storage: DataKey::VaultState -> VaultStateV1 { owner: Address, balance: i128 }
// V2 storage: DataKey::VaultState -> VaultStateV2 { owner: Address, balance: i128, fee_rate: u32 }
// BREAKING: V2 reads VaultStateV2 from key DataKey::VaultState,
//           but the stored bytes are VaultStateV1 — deserialization fails (trap) OR
//           interprets the trailing bytes of balance as fee_rate (silent corruption).
```

| Storage Key | V1 Data Type (fields) | V2 Data Type (fields) | Compatible? | Migration Path |
|-------------|----------------------|----------------------|-------------|---------------|

**Soroban deserialization behavior on mismatch**:
- If new struct has MORE fields than stored data has bytes: Soroban SDK will likely panic (trap) at runtime when deserializing.
- If new struct has FEWER fields: the extra stored bytes may be silently ignored (data loss).
- If field TYPES change (e.g., `i128` → `u64`): deserialization may silently reinterpret bytes.

**Check for each storage key**: does V2 WASM read the same key as V1 WASM wrote? If both use the same key but different types, this is a migration hazard.

---

## Step 3: Trace Storage Access Paths Through Upgrade

For each contract function that accesses upgraded storage:

1. **Entry point**: What storage key does the user-facing function read/write?
2. **Internal flow**: What data type does the function deserialize from that key?
3. **External calls**: What type do external contracts (`invoke_contract`) expect from this contract?
4. **TTL**: What storage class (Instance / Persistent / Temporary) holds the data, and is the TTL extended during migration?

| Function | Storage Key Expected | Data Type Expected | Data Actually Stored (post-upgrade) | Mismatch? |
|----------|--------------------|--------------------|-------------------------------------|-----------|

### Step 3b: External Contract Side Effect Compatibility

When the upgrade changes the contract's behavior, check whether external callers handle the changes:

| External Caller | Pre-Upgrade Expected Return | Post-Upgrade Actual Return | Caller Handles Both? | Breaking? |
|----------------|---------------------------|---------------------------|---------------------|-----------|

**Pattern**: Contract upgrade changes function return values or events, but external contracts that call this contract via `invoke_contract` were written for the old interface. After upgrade, return values are misinterpreted by callers.

### Step 3c: Pre-Upgrade Storage Inventory

Before analyzing stranded asset paths, inventory all storage entries the contract owns:

| Storage Key | Storage Class | Stored Value Type | Post-Upgrade Logic Handles? | Withdrawal Path Post-Upgrade? |
|-------------|--------------|-------------------|----------------------------|------------------------------|
| {DataKey::Vault} | Persistent | VaultState | YES/NO | {function name or NONE} |
| {DataKey::UserBalance(addr)} | Persistent | i128 | YES/NO | {function name or NONE} |
| {DataKey::Config} | Instance | Config | YES/NO | {function name or NONE} |
| {DataKey::TempNonce} | Temporary | u64 | N/A (expires) | N/A |

**Pattern**: Upgrade changes which storage keys the contract reads/writes, but old keys still hold value. If new logic cannot read or close old keys, assets associated with them are stranded.

---

## Step 4: Stranded Asset Analysis

### 4a. Asset Inventory by Era

| Asset/Storage | V1 Write Path | V2 Write Path | V1 Withdraw Path | V2 Withdraw Path |
|---------------|--------------|--------------|-----------------|-----------------|
| {DataKey::Vault(user)} | deposit_v1() | deposit_v2() | withdraw_v1() | withdraw_v2() |
| {DataKey::Stake(user)} | stake() | stake() | unstake() | unstake() |

**Rule**: If V1 Write exists but V2 Withdraw does not handle V1 storage key/type -> potential stranding.

### 4b. Cross-Era Access Matrix

| Storage Era | State Condition | Available Withdraw/Close Paths | Works? | Reason |
|-------------|----------------|-------------------------------|--------|--------|
| V1 key format | V2 WASM deployed | withdraw_v2() reads DataKey::VaultV2 | Y/N | V1 used DataKey::VaultV1 — different key |
| V1 key format | Migration function exists | migrate_user(user) reads DataKey::VaultV1 | Y/N | {why} |
| V1 key format | Migration NOT called | withdraw_v2() | Y/N | Old data at old key, inaccessible |
| In-flight during upgrade | Partial operation state | ??? | Y/N | {why} |

**STRANDING RULE**: If ALL withdraw/close paths fail for any storage state combination -> **STRANDED ASSETS FINDING**

### 4c. Recovery Function Inventory

| Function | Who Can Call | What State Can Recover | Limitations |
|----------|------------|------------------------|-------------|
| migrate_user(user) | Any user / admin only | V1 user balances | One-time per user; must be called before TTL expires |
| emergency_withdraw() | Admin | Protocol-owned token balances | Requires active admin |
| update_and_migrate() | Admin | Performs upgrade + migration atomically | Is migration truly atomic? |

### 4d. Worst-Case Scenarios (MANDATORY)

**Scenario 1: V1 Storage + V2 WASM — No Migration Called**
```
State: User has balance stored at DataKey::BalanceV1(user_address) in Persistent storage
Event: Contract upgraded to V2; V2 uses DataKey::BalanceV2(user_address)
Question: Can user withdraw via V2 withdraw() function?
Trace: [document storage key lookup and deserialization in V2 withdraw()]
Result: [SUCCESS / STRANDED + amount]
```

**Scenario 2: In-Flight During Upgrade**
```
State: User submitted a multi-step operation (e.g., unlock request) at ledger N
       Contract stores pending operation at DataKey::PendingOp(user_address)
Event: Contract upgraded at ledger N+1; V2 no longer reads DataKey::PendingOp
Question: Can user complete their operation at ledger N+2?
Trace: [document function path and storage access in V2]
Result: [SUCCESS / STRANDED + amount]
```

**Scenario 3: Storage Key Renamed**
```
State: V1 uses DataKey::Config for configuration struct ConfigV1
Event: V2 uses DataKey::Config for configuration struct ConfigV2 with additional fields
Question: Does V2 correctly read V1-written Config data?
Trace: [document deserialization: ConfigV2::from(stored_bytes) where stored_bytes is ConfigV1]
Result: [SUCCESS (if additive and defaults apply) / TRAP / SILENT_CORRUPTION]
```

**Scenario 4: TTL Expiry During Migration Window**
```
State: User's balance is in Persistent storage with a TTL set at V1 initialization
Event: Contract is upgraded; migration requires user to call migrate_user() within TTL window
Question: What happens if user does not call migrate_user() before TTL expires?
Trace: [document TTL of Persistent entries and whether upgrade extends TTLs]
Result: [DATA_WIPED_ON_EXPIRY / SAFE (TTL auto-extended by upgrade)]
```

### 4e. Step 4 Completion Checklist
- [ ] 4a: ALL storage keys inventoried with write/withdraw paths per era
- [ ] 4b: Cross-era access matrix completed for all state combinations
- [ ] 4c: Recovery functions enumerated with limitations
- [ ] 4d: All four worst-case scenarios modeled with traces
- [ ] For EVERY stranding possibility: recovery path exists OR finding created

---

## Step 4f: User-Blocks-Admin Scenarios

| Admin/Migration Function | Precondition Required | User Action That Blocks It | Timing Window | Severity |
|-------------------------|----------------------|---------------------------|---------------|----------|
| {admin_fn} | {precondition} | {user_action} | {window} | {assess} |

**Soroban-specific patterns**:
- User has a large balance in old-format storage -> migration function must iterate over user entries, which may exceed compute budget if too many entries exist
- User calls a function that creates storage with the old key format after the upgrade announcement but before the actual upgrade (extends the "old format exists" window)
- User purposely extends TTL of old-format storage entries to prevent their expiry and the associated cleanup path

---

## Step 5: Upgrade Authority Lifecycle

| Check | Status | Evidence |
|-------|--------|----------|
| Upgrade authority identified? | {address or NONE} | {source location} |
| Is upgrade gated by `require_auth`? | YES/NO | If NO: CRITICAL |
| Is authority a multisig (Stellar multisig or Soroban governance contract)? | YES/NO | |
| Is there a timelock on upgrade execution? | YES/NO | Duration: {N ledgers} |
| Can upgrade authority be transferred to zero/revoked? | YES/NO | If YES: is revocation safe post-migration? |
| Does the upgrade function also run migration logic? | YES/NO | Atomic upgrade+migrate is safer than separate steps |
| Can upgrade be performed with a WASM hash that produces a trap on first call? | YES/NO | Bricking risk |
| Are Instance-class storage TTLs extended during upgrade? | YES/NO | Contract instance TTL must not expire before users can act |

---

## Step 6: Downstream Integration Compatibility

| Contract Change | Downstream Consumer | Expected Interface | Post-Migration Actual | Breaking? |
|----------------|--------------------|--------------------|----------------------|-----------|
| {change} | External callers via invoke_contract | {expected function signature} | {actual function signature} | YES/NO |
| {change} | Indexers / Horizon event processors | {expected event structure} | {actual event structure} | YES/NO |
| {change} | Frontend SDK | {expected function and arg types} | {actual} | YES/NO |

**Pattern**: Contract upgrade changes function signatures, argument types, or event structures, but downstream consumers built against the old interface continue to call the new WASM with old argument encoding — calls may trap (wrong arg count) or silently pass with misinterpreted arguments.

**Soroban ABI note**: Soroban functions are identified by their name (as a Symbol). There is no ABI checksum like EVM function selectors. An upgraded function with the same name but different argument types will accept the old call encoding, potentially silently misinterpreting arguments.

---

## Key Questions (Must Answer All)
1. **Storage Compatibility**: Are ALL existing storage entries readable by the new WASM version?
2. **Key Stability**: Do ALL storage key definitions remain identical after upgrade?
3. **Migration Completeness**: Can ALL V1 storage entries be migrated or withdrawn via V2 paths?
4. **Stranded Assets**: Is there any combination of (old_storage_state + new_WASM) that traps user funds?
5. **Authority Security**: Is the upgrade function properly access-controlled and is the authority appropriately secured?
6. **TTL Safety**: Do storage entry TTLs survive the upgrade and migration window without expiry?

---

## Common False Positives
1. **Additive storage schema**: New fields added with new keys, old keys still readable by V2 — backward compatible
2. **Versioned deserialization**: Contract explicitly handles both V1 and V2 data layouts via enum variants
3. **Admin-controlled migration**: Stranded accounts recoverable via authority-gated migration function
4. **Atomic upgrade+migrate**: If `update_current_contract_wasm` is called within the same function that writes migrated storage, the migration is effectively atomic

---

## Finding Template

```markdown
**ID**: [MG-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see checklist below)
**Rules Applied**: [R4:___, R9:___, R10:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: src/{file}.rs:LineN

**Storage Transition**:
- Old: {old_key / old_type / old_storage_class}
- New: {new_key / new_type / new_storage_class}
- Mismatch Point: {where key or type diverges}

**Description**: {what is wrong}
**Impact**: {stranded funds, corrupted state, bricked contract, broken callers}
**Evidence**: {code showing mismatch}
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Identify Upgrade and Migration Patterns | YES | | |
| 2. Storage Schema Compatibility | YES | | |
| 3. Trace Storage Access Paths | YES | | |
| 3b. External Contract Side Effect Compatibility | YES | | |
| 3c. Pre-Upgrade Storage Inventory | YES | | |
| 4. Stranded Asset Analysis (4a-4e) | YES | | |
| 4f. User-Blocks-Admin Scenarios | YES | | |
| 5. Upgrade Authority Lifecycle | YES | | |
| 6. Downstream Integration Compatibility | YES | | |

If any step skipped, document valid reason (N/A, no upgrade function, immutable contract, single version, no external callers).
