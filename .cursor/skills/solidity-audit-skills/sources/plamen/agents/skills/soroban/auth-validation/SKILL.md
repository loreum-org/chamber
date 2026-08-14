---
name: "auth-validation"
description: "Trigger Pattern Always required for Soroban audits - Inject Into Breadth agents, depth agents"
---

# AUTH_VALIDATION Skill (Soroban)

> **Trigger Pattern**: Always required for Soroban audits
> **Inject Into**: Breadth agents, depth agents
> **Finding prefix**: `[AV-N]`
> **Rules referenced**: R4, R6, R10, R13

Soroban's authorization model differs fundamentally from EVM: instead of `msg.sender`, callers invoke `require_auth()` or `require_auth_for_args()` on an `Address`. Missing or incorrectly scoped auth is the most common critical bug class on Soroban.

## 1. Auth Inventory

For EVERY `pub fn` in each contract, determine whether it modifies state and whether auth is present:

| Function | Modifies State? | Modifies Balance/Config/Ownership? | `require_auth` Present? | Auth Address | Missing? |
|----------|----------------|-------------------------------------|------------------------|-------------|----------|
| `{fn_name}` | YES/NO | YES/NO | YES/NO | `{address_var or NONE}` | FLAG if modifies state but NO auth |

**Critical patterns to flag**:
- Any function writing to storage without a prior `require_auth()` call
- Any function that transfers funds or mints tokens without auth
- Any function that updates privileged config (admin, fee, whitelist) without auth

**Soroban note**: `require_auth()` panics if the address has not authorized the invocation. It does NOT return a bool — absence means the call proceeds without authorization.

## 2. Auth Tree Propagation

When a contract calls another contract via `invoke_contract`, the auth context must propagate to sub-calls. Trace each cross-contract invocation:

| Calling Fn | Sub-Contract Invocation | Auth Expected in Sub-Call? | `AuthorizedInvocation` Provided? | Sub-Call Protected? |
|------------|------------------------|---------------------------|----------------------------------|---------------------|
| `{fn}` | `invoke_contract({contract}, {fn})` | YES/NO | YES/NO | YES/NO |

**Attack surface**: If a top-level function calls `require_auth(user)` but then invokes a sub-contract on behalf of the user without passing the correct `AuthorizedInvocation` tree, the sub-contract cannot verify the user actually authorized the sub-call.

**Check for**:
- `require_auth()` at top level but no auth context propagated to sub-contract invocations
- Sub-contracts that perform privileged operations but rely on the caller to have checked auth (missing defense-in-depth)
- `invoke_contract_check_auth` used as a bypass for normal `require_auth` flow
- **Frame-descent (originate side)**: when the current contract invokes an intermediary that then pulls tokens/assets via a nested `transfer(from = this_contract, ...)`, that nested frame is NOT auto-authorized by the direct-caller rule — verify the originating function pre-declares it (`authorize_as_current_contract` / equivalent). Differentially compare EVERY sibling that performs the same nested-pull pattern; if one sibling pre-authorizes and another does not, the omission is a finding.

## 3. Custom Account Contracts (`__check_auth`)

For any contract implementing the `CustomAccountInterface` (contains `__check_auth`):

| Check | Present? | Correct? | Notes |
|-------|----------|---------|-------|
| Signature verification against stored public keys | YES/NO | YES/NO | |
| Replay protection (nonce or sequence number) | YES/NO | YES/NO | |
| Signature threshold enforcement (multi-sig) | YES/NO | YES/NO | |
| `context.signature_payload` used (not raw payload) | YES/NO | YES/NO | |
| Auth invocation tree validated against expected function | YES/NO | YES/NO | |

**Critical**: `__check_auth` is called by the host to verify whether an address has authorized an invocation. Bugs here allow bypassing authorization for ALL operations that use this account contract.

**Specific checks**:
- Verify the function uses `context.signature_payload` (the canonical payload) rather than constructing its own hash
- Verify nonce is incremented atomically to prevent replay
- For multi-sig: verify the threshold check uses `>=` not `>` (off-by-one)
- Verify `sub_invocations` in the auth tree are validated, not just the top-level call
- **Sub-invocation auth bypass (host issue #788)**: When contract B calls contract A with different `require_auth` argument sets in the same transaction, a custom auth contract that approves one call may inadvertently authorize both. Verify the `__check_auth` implementation distinguishes between different invocation contexts.
- **Spending limits**: If the custom account implements spending limits, verify limits are checked BEFORE authorization and decremented atomically. A gap between check and decrement allows multiple calls within one transaction to bypass the limit.
- **Session keys / delegated auth**: If the custom account supports session keys, verify (1) session key scope is enforced (only authorized functions/amounts), (2) session keys expire, (3) revocation is immediate (not deferred to next transaction)

## 4. Auth Argument Matching (`require_auth_for_args`)

`require_auth_for_args` binds authorization to specific argument values. Verify the correct arguments are passed:

| Function | Uses `require_auth_for_args`? | Arguments Passed | Arguments That Should Be Bound | Mismatch? |
|----------|------------------------------|-----------------|-------------------------------|-----------|
| `{fn}` | YES/NO | `{args list}` | `{expected critical args}` | FLAG if mismatch |

**Attack**: If `approve(spender, amount)` calls `require_auth_for_args(owner, (spender, wrong_amount))`, an attacker can get the owner to authorize a small amount but then pass a larger amount in the actual call.

**Pattern to check**:
- Does `require_auth_for_args` bind ALL security-critical parameters (amounts, recipients, token addresses)?
- Are the bound arguments the actual runtime values, not hardcoded or stale values?
- Is the args tuple in the same order as the function signature (order matters for serialization)?
- **Determinism requirement**: The mapping between invocation arguments and auth arguments MUST be deterministic. If `require_auth_for_args` computes its argument set from mutable state that could change between the user signing and the transaction executing, the auth can be bypassed or a different operation authorized than what was signed.

## 5. Missing Auth Patterns

Exhaustively check for state modifications without any form of auth:

| Pattern | Location | Auth Present? | Finding? |
|---------|----------|--------------|---------|
| Balance modification (`token.transfer`, `token.mint`, `token.burn`) | `{file:line}` | YES/NO | `[AV-N]` if NO |
| Config update (`admin`, `fee_rate`, `paused`, whitelist) | `{file:line}` | YES/NO | `[AV-N]` if NO |
| Ownership transfer or role grant | `{file:line}` | YES/NO | `[AV-N]` if NO |
| Emergency/pause functions | `{file:line}` | YES/NO | `[AV-N]` if NO |
| Initialization functions (callable once) | `{file:line}` | YES/NO | `[AV-N]` if NO |

**Init function special case**: Soroban contracts frequently have an `initialize()` or `init()` function that stores the initial admin. If this function has no auth check AND no "already initialized" guard, anyone can reinitialize the contract and replace the admin.

Check the initialization guard pattern:
```rust
// SAFE: checks not-yet-initialized
if env.storage().instance().has(&DataKey::Admin) {
    panic!("already initialized");
}
// UNSAFE: no guard → anyone can reinitialize
```

## Finding Template

```markdown
**ID**: [AV-N]
**Severity**: [Critical if balance/ownership, High if config, Medium if view-only privileged]
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R4:✓/✗, R6:✓/✗, R10:✓/✗, R13:✓/✗]
**Location**: src/{contract}.rs:LineN
**Title**: Missing `require_auth` on `{fn_name}` allows unauthorized {action}
**Description**: [Specific missing auth with code reference showing the unguarded state mutation]
**Impact**: [What attacker achieves: fund theft, admin takeover, config manipulation, unauthorized minting]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Auth Inventory | YES | ✓/✗/? | Every pub fn with state modification |
| 2. Auth Tree Propagation | IF cross-contract calls present | ✓/✗(N/A)/? | Every invoke_contract |
| 3. Custom Account Contracts | IF `__check_auth` present | ✓/✗(N/A)/? | Full check_auth implementation audit |
| 4. Auth Argument Matching | IF `require_auth_for_args` used | ✓/✗(N/A)/? | Verify all critical args bound |
| 5. Missing Auth Patterns | YES | ✓/✗/? | Balances, config, init functions |
