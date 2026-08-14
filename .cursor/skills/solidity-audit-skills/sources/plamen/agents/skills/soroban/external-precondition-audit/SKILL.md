---
name: "external-precondition-audit"
description: "Trigger Pattern Any env.invoke_contract() or env.try_invoke_contract() detected in contract - Inject Into Breadth agents"
---

# Skill: External Precondition Audit (Soroban)

> **Trigger Pattern**: Any `env.invoke_contract()` or `env.try_invoke_contract()` detected in contract
> **Inject Into**: Breadth agents
> **Finding prefix**: `[EPA-N]`
> **Rules referenced**: R1, R4, R8, R10, R16
> **Constraint**: Interface-level inference only — no production fetch required

```
invoke_contract|try_invoke_contract|contractimport!|ContractClient|
external_contract|token::Client|token_contract|SorobanInterface
```

For every external contract the protocol invokes:

## 1. External Call Target Inventory and Validation

| External Contract | Address Source | Hardcoded? | Validated Against Constant? | Upgradeable? | Risk if Substituted |
|------------------|---------------|-----------|---------------------------|-------------|-------------------|

**Address validation check**: For each `invoke_contract` call, is the target contract address:
- Hardcoded as a constant or loaded from admin-controlled storage with access control? -> SAFE
- Read from user-supplied input without validation? -> **CRITICAL**: attacker substitutes malicious contract
- Loaded from contract storage but settable by an unauthorized caller? -> **HIGH**: arbitrary external call

**Upgradeability assessment**: Soroban contracts can be upgraded via `update_current_contract_wasm()` if the contract has an upgrade entry point. Is the external contract upgradeable?
- If YES: its behavior can change after audit. Apply Rule 4 (adversarial assumption on future behavior).
- If NO (no upgrade entry point or upgrade authority revoked): behavior is fixed, trust boundary is clear.

**`contractimport!` macro risk**: Contracts imported via `contractimport!` bind the caller to the interface of the external contract at compile time. If the external contract upgrades and changes its interface, calls will fail. More critically, if the imported interface definition does not match the deployed contract's actual interface, calls may succeed with incorrect semantics (wrong argument order, wrong return type interpretation).

## 2. invoke_contract vs try_invoke_contract — Error Handling

Soroban provides two call modes with fundamentally different error semantics:

| Call Site | Mode Used | Error Handled? | On Panic: | Risk |
|-----------|----------|----------------|-----------|------|
| {location} | invoke_contract / try_invoke_contract | YES/NO | propagates trap / returns Err | {describe} |

**`invoke_contract` (trap mode)**: If the external call fails (panic, host error), the ENTIRE transaction reverts. This is safe against partial state corruption but means any external contract can DoS the protocol by reverting.

**`try_invoke_contract` (Result mode)**: Returns `Ok(val)` or `Err(...)`. The calling contract's state changes are NOT automatically reverted on error — the calling contract must handle the error explicitly and decide whether to revert or continue.

**Critical check for `try_invoke_contract`**:
- [ ] Is the `Err` branch handled explicitly?
- [ ] Does the calling contract revert (panic) on external error, or continue with partial state?
- [ ] If it continues: what state was already written before the external call? Is that state now inconsistent?

**Attack pattern (partial state corruption)**:
1. Protocol calls `try_invoke_contract` to external token
2. External call fails (returns `Err`)
3. Protocol writes partial state without reverting (e.g., records a deposit but token transfer failed)
4. User's accounting shows balance but tokens were never transferred

## 3. Return Value Consumption

| Call Site | Return Type | Protocol Uses Return Value? | Failure Mode if Unexpected |
|-----------|------------|---------------------------|---------------------------|

For each return value:
- What happens if the external call returns 0? (division by zero, incorrect accounting)
- What happens if it returns an unexpected type? (Soroban SDK will trap on deserialization mismatch)
- What happens if `try_invoke_contract` returns `Err`? Does the protocol handle this case explicitly?
- Are return values deserialized with a type assertion that could trap on malformed data from an upgraded contract?
- For each external data structure received (Vec, array, Map, list): (a) What ordering/uniqueness does the consuming code assume? (b) Does the external contract's spec guarantee that ordering? (c) What happens if the assumption is violated (unsorted, duplicates, gaps)?

## 4. State Dependency Mapping

| Protocol State | Depends on External Contract State | External State Can Change Without Our Knowledge? |
|---------------|-----------------------------------|--------------------------------------------------|

For each dependency: model what happens when the external contract state changes between our contract's read and use.

**Soroban-specific concerns**:
- Soroban contracts within the SAME transaction can call the same external contract before and after our contract — state may differ between our calls
- Storage TTL: if an external contract's data entry has expired (TTL exhausted), reading it returns the default value, not the last written value. This can silently return zero or empty data.
- A contract call that reads external state, then performs computation, then re-reads external state may see inconsistent state if another contract in the same transaction modified the external state between reads.

### 4b. Oracle Data Quality Checks (IF oracle consumed)

| Oracle Address | Type | Confidence Checked? | Staleness Checked? | Address Validated? |
|---------------|------|--------------------|--------------------|-------------------|

Checks:
1. Is the price/rate value validated for bounds before use (not zero, not negative, not impossibly large)?
1b. Price magnitude bounds: does the protocol enforce an upper bound or deviation check on price values? If no circuit breaker exists (e.g., reject price if >N× previous price or a configured ceiling), flag the absence — extreme-but-positive prices from oracle glitches or flash crashes pass the zero/negative check but can still cause mass liquidation or inflated borrowing.
2. Is staleness enforced? (compare oracle's `timestamp` field against `env.ledger().timestamp()` with max age)
3. Can the oracle address be substituted by an attacker (see Section 1)?
4. What happens if the oracle contract's storage entry has expired (returns default value)?

Tag: `[TRACE:oracle read → price={X} at timestamp={T} vs current={U} → {accepted/rejected}]`

## 5. XLM Reserve and Storage TTL Considerations

After each external call that modifies storage:

| External Call | Creates/Extends Storage? | Who Pays TTL Extension Fees? | TTL Sufficient? |
|--------------|-------------------------|------------------------------|----------------|

**Soroban-specific**: External contracts may create or extend storage entries on behalf of the calling contract. Storage entries have TTLs; if not extended, data expires and is wiped. If an external call creates state that the calling contract later depends on, but the TTL is not extended, that state may vanish.

**XLM reserve for contract instances**: Each deployed contract and each storage entry requires XLM held in reserve. If the protocol relies on an external contract maintaining state, verify that the external contract's reserve is adequate and not drainable by an attacker.

## Finding Template

```markdown
**ID**: [EPA-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see checklist below)
**Rules Applied**: [R1:___, R4:___, R8:___, R10:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: src/{file}.rs:LineN
**Title**: {missing call validation / partial state on try_invoke error / stale external state}
**Description**: {specific issue with code reference}
**Impact**: {what attacker can achieve via the external call weakness}
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. External Call Target Inventory and Validation | YES | | Address source for every invoke_contract |
| 2. invoke_contract vs try_invoke_contract Error Handling | YES | | Every try_invoke_contract error branch checked |
| 3. Return Value Consumption | IF return value used | | |
| 4. State Dependency Mapping | YES | | |
| 4b. Oracle Data Quality Checks | IF oracle consumed | | Price bounds, staleness, TTL expiry |
| 5. XLM Reserve and Storage TTL | YES | | Storage entries created by external calls |

If any step skipped, document valid reason (N/A, no external calls, immutable target with no state dependency).
