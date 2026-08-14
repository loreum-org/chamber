---
name: "semi-trusted-roles"
description: "Trigger Pattern operator/keeper/crank require_auth checks, authority-gated functions - Inject Into Breadth agents, depth-state-trace"
---

# SEMI_TRUSTED_ROLES Skill (Soroban)

> **Trigger Pattern**: operator/keeper/crank `require_auth` checks, authority-gated functions, admin actions beyond pure parameter-setting
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[STR-N]`
> **Rules referenced**: R2, R6, R10, R13

```
operator|keeper|crank|authority|admin|require_auth|guardian|relayer|updater|manager
```

**Soroban role context**: No role-based modifiers. Access control is custom: stored `Address` from Instance/Persistent storage + `.require_auth()`. Address is opaque — may be keypair, Stellar multisig, or contract.

---

## Step 1: Inventory Role Permissions

In `{CONTRACTS}`, find all functions callable by `{ROLE_NAME}`. For each at `{ROLE_FUNCTIONS}`:
- Storage keys read/written (Instance/Persistent/Temporary)?
- Cross-contract calls (`invoke_contract` / `TokenClient`)?
- Parameters accepted from caller?
- Auth validation method? (stored Address + `require_auth()` vs inline vs direct check)

| Function | Auth Check | Storage Mutations | Cross-Contract Calls | Parameters |
|----------|-----------|-------------------|---------------------|------------|

**Auth patterns**: stored Address + `require_auth()`, `e.current_contract_address().require_auth()` (sub-invocation), NO auth on privileged state mutation (missing auth bug).

---

## Step 2: Analyze Within-Scope Abuse

For each permitted action, ask:

**Timing Abuse** (~5s ledger close, no mempool):
- Execute at harmful times? (front-running limited to validator/fee-bump ordering)
- Delay execution to harm users? (skip oracle updates, withhold cranks)
- Maximum harm window?

**Parameter Abuse**:
- Pass harmful values? (inflated amounts, wrong recipient, max slippage)
- Parameters validated on-chain or accepted implicitly?
- Supply attacker-controlled contract address?

**Sequence Abuse**:
- Execute functions out of order? (claim before distribute, settle before finalize)
- Skip required functions? (skip epoch advancement, skip price update)

**Omission Abuse**:
- Harm users by NOT executing? (skip reward distribution, delay settlement)
- Protocol degradation timeline if role stops?

---

## Step 3: Model Attack Scenarios

```
Scenario A: Timing Attack (Transaction Ordering)
1. {ROLE_NAME} observes pending user transaction
2. {ROLE_NAME} submits role_function() in same or prior ledger
3. State changes before user transaction executes
4. Impact: {TIMING_IMPACT}
Note: No public mempool. Requires role to be validator or fee-bumper.

Scenario B: Parameter Attack
1. {ROLE_NAME} calls {ROLE_FUNCTION} with {MALICIOUS_PARAMS}
2. Parameters not validated against {EXPECTED_CONSTRAINTS}
3. Impact: {PARAM_IMPACT}

Scenario C: Key Compromise
1. {ROLE_NAME} Address keypair compromised (or: Address is a contract that gets compromised)
2. Attacker can call: {ROLE_FUNCTIONS}
3. Maximum extractable value: {MAX_DAMAGE}
4. Recovery: {RECOVERY_PATH} — rotation function exists? If Address is upgradeable contract, who holds upgrade key?
```

---

## Step 4: Assess Mitigations

- Timelock on `{ROLE_NAME}` actions? (multi-ledger proposal+execute)
- `{ROLE_NAME}` a Stellar multisig (M-of-N) or governance contract?
- **Does a rotation/removal function EXIST?** If NO → FINDING: authority irrevocable. Min Medium if role modifies user state.
- Can admin rotate authority quickly for compromise response?
- Rate limits (per-ledger caps, cooldowns)?
- If immutable (no `update_current_contract_wasm`): can compromised role be replaced?

**Soroban patterns**: Two-step transfer (`propose_new_admin` + `accept_admin`), multisig Address. Role in Instance/Persistent storage takes effect immediately (no built-in delay).

---

## Step 5: Model User-Side Exploitation (Direction 2 — MANDATORY)

**Predictability Analysis**:
- Is the role's behavior predictable? (schedule, price triggers, queue length)
- Can users observe when the role will act? (on-chain state)
- Can users front-run/back-run via higher-fee transactions?

```
Scenario D: User Exploits Role Timing
1. User observes {ROLE_NAME} executes {ROLE_FUNCTION} when {CONDITION} met
2. User submits higher-fee tx to land before role in same ledger
3. User benefits from known state change. Impact: {USER_EXPLOIT_IMPACT}

Scenario E: User Griefs Role Preconditions
1. {ROLE_FUNCTION} requires state: {PRECONDITION}
2. User manipulates state to violate {PRECONDITION}
3. Role tx panics; protocol enters degraded state. Impact: {GRIEF_IMPACT}

Scenario F: User Forces Suboptimal Role Action
1. User manipulates on-chain state to make worst option appear best
2. {ROLE_NAME} (honest policy) chooses suboptimal path. Impact: {SUBOPTIMAL_IMPACT}

Scenario G: Stale Rate via Discrete Updates
1. Exchange rate only updates when {ROLE_NAME} calls {UPDATE_FUNCTION}
2. User enters at stale rate, role updates, user exits. Impact: {RATE_ARBIT_IMPACT}
```

---

## Step 6: Precondition Griefability Check

For each function callable by `{ROLE_NAME}`:

| Function | Preconditions | User Can Manipulate? | Grief Impact |
|----------|--------------|---------------------|--------------|

**Soroban griefing**: Persistent storage record proliferation exceeding resource budget during role iteration? TTL expiry on user entries causing `unwrap()` panics in role functions?

---

## Step 6b: Admin/Privileged Function Griefability (EXHAUSTIVE)

Enumerate ALL authority-gated functions:

| Function | Authority Type | Preconditions | User Can Manipulate? | Grief Impact |
|----------|---------------|--------------|---------------------|--------------|

**Completeness check**: Total authority-gated: {N}, analyzed: {M}. If M < N → analyze missing.

**Soroban-specific checks**:
- Can users create Persistent entries that block admin cleanup/migration? (N entries = N resource units)
- Can in-flight multi-ledger operations (pending withdrawal, partial unstake) block admin actions?
- Can users revoke allowances just before contract `transfer_from`, causing admin crank to fail?
- Can unsolicited token `transfer` to contract bloat tracked balance beyond admin's expected range?

---

## Common False Positives

- **Read-only functions**: no abuse vector
- **Idempotent functions**: timing abuse limited
- **User-initiated dependency**: role requires user to initiate first — front-running may not apply
- **Economic alignment**: staked collateral / fee-funded role has cost for malicious action
- **Immutable address**: hardcoded Address — rotation N/A, but compromise risk permanent

---

## Finding Template

```markdown
**ID**: [STR-N]
**Severity**: Critical/High/Medium/Low/Info
**Step Execution**: (see below)
**Rules Applied**: [R2:___, R6:___, R10:___, R13:___]
**Location**: src/{file}.rs:LineN
**Title**: {what role can do / what user can exploit}
**Description**: {specific abuse vector with code reference}
**Impact**: {quantified damage at worst-state parameters}
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Inventory Role Permissions | YES | | |
| 2. Analyze Within-Scope Abuse | YES | | |
| 3. Model Attack Scenarios (A, B, C) | YES | | |
| 4. Assess Mitigations | YES | | |
| 5. Model User-Side Exploitation (D, E, F, G) | **YES** | | **MANDATORY** — never skip |
| 6. Precondition Griefability Check | **YES** | | **MANDATORY** — never skip |
| 6b. Admin Instruction Griefability | **YES** | | **MANDATORY** — never skip |

### Cross-Reference Markers

**After Step 4**: DO NOT STOP HERE — Steps 5-6 analyze the reverse direction.
**After Step 5**: Cross-reference with TOKEN_FLOW_TRACING for token-related griefing vectors. IF role actions are time-predictable → document ledger-ordering (fee-bump) vectors.
**After Step 6**: IF any precondition is user-griefable → severity >= MEDIUM. Document protocol degradation timeline if role is blocked indefinitely.
**After Step 6b**: IF admin iterates over user-created Persistent entries → check for unbounded iteration / resource exhaustion.

### Output Format for Step Execution
```markdown
**Step Execution**: check1,2,3,4,5,6,6b | (no skips for this skill)
```
