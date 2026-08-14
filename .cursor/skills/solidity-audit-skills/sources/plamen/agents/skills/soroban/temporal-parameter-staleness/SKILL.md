---
name: "temporal-parameter-staleness"
description: "Trigger Pattern interval|period|duration|delay|cooldown|lock_period|timelock|unbonding|claim_delay|withdraw_delay|maturity|ledger_sequence|timestamp - Inject Into Breadth agents, depth-state-trace"
---

# TEMPORAL_PARAMETER_STALENESS Skill (Soroban)

> **Trigger Pattern**: `interval|period|duration|delay|cooldown|lock_period|timelock|unbonding|claim_delay|withdraw_delay|maturity|ledger_sequence|timestamp`
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[TPS-N]`
> **Rules referenced**: R2, R8, R10, R13, R14

Cached parameters in multi-step operations become stale when authority changes them between steps. On Soroban, timing has unique properties: `env.ledger().timestamp()` provides Unix seconds (estimated, can lag wall clock), `env.ledger().sequence_number()` provides the exact ledger number (strictly monotonic), SCP consensus closes ledgers approximately every 5 seconds, and there is no concept of slots, epochs, or a clock sysvar. TTL (time-to-live) is measured in ledger numbers and can itself act as a timing mechanism.

---

## Step 1: Enumerate Multi-Step Operations

Find all operations that span multiple transactions (ledgers):

| Operation | Step 1 (Initiate) | Wait Condition | Step N (Complete) | Clock Source |
|-----------|-------------------|----------------|-------------------|-------------|
| {op_name} | {initiate_fn}() | {condition} | {complete_fn}() | ledger_sequence / timestamp |

For each multi-step operation:
- What parameters are read/cached at Step 1 (stored in Persistent/Instance storage)?
- What parameters are re-read at Step N?
- What parameters are used but NOT re-read at Step N?
- **Which clock source is used?** (`env.ledger().timestamp()` vs `env.ledger().sequence_number()`)

### Soroban Clock Semantics

| Clock Source | Type | Resolution | Monotonicity | Accuracy | Typical Use Case |
|-------------|------|-----------|-------------|----------|-----------------|
| `env.ledger().sequence_number()` | `u32` | ~5s per ledger | Strictly increasing | Exact (validator-produced) | Cooldowns, lock periods, rate-limiting |
| `env.ledger().timestamp()` | `u64` (Unix seconds) | ~5s | Mostly increasing (can lag) | Estimated by SCP; may lag wall clock by seconds to minutes during network stress | Human-readable delays, longer durations |

**Critical property**: Within a single transaction (a single invocation tree, including sub-invocations via `invoke_contract`), ALL calls see the same `env.ledger()` values — there is no intra-transaction timing variation. Multi-step timing attacks require separate ledgers (separate transactions).

**Timestamp vs sequence tradeoff**:
- `timestamp` is human-intuitive (seconds) but can lag real time during validator slowdowns
- `sequence_number` is exact but requires converting to human time (~5s per ledger, subject to change if Stellar network parameters change)
- Hardcoded `sequence_number` durations break if Stellar's ledger close time changes (currently ~5s, configurable by validators)

---

## Step 2: Identify Cached Parameters

For each parameter used across steps:

| Parameter | Storage Type + Key | Read At Step | Cached in User State? | Admin-Changeable? | Re-Validated At Completion? |
|-----------|-------------------|-------------|----------------------|------------------|-----------------------------|
| {param} | {Instance/Persistent, DataKey::Foo} | initiate() | YES/NO | YES/NO (which function) | YES/NO |

**Soroban caching patterns**:
- **Instance storage cache**: User's position struct stores a snapshot of config params at initiation time (e.g., `position.fee_rate = config.fee_rate` at deposit time)
- **Persistent storage cache**: Per-user Persistent entry stores the start ledger or timestamp (e.g., `user_position.start_ledger = env.ledger().sequence_number()`)
- **Re-read pattern**: Step N re-reads from Instance storage directly — no staleness for that param
- **Allowance TTL as cached permission**: An allowance stored in Temporary storage expires by `expiration_ledger` — if the operation takes longer than expected, the allowance expires and Step N fails

**Red flags**: Parameter is cached in user's Persistent entry at Step 1 AND admin can change the source config AND Step N does NOT re-read from source.

---

## Step 3: Model Staleness Impact

For each cached parameter that can become stale:

```
Scenario A: Parameter INCREASES between steps
1. User initiates at Step 1 — user Persistent entry stores param = X
2. Admin updates Instance config: param = X + delta
3. User completes at Step N — uses cached X from Persistent entry
4. Impact: {what happens with stale X when current config is X + delta}

Scenario B: Parameter DECREASES between steps
1. User initiates at Step 1 — user Persistent entry stores param = X
2. Admin updates Instance config: param = X - delta
3. User completes at Step N — uses cached X
4. Impact: {what happens with stale X when current config is X - delta}
```

**BOTH directions are mandatory** — increase and decrease often have different impacts.

### Soroban-Specific Staleness Vectors

| Vector | Description | Severity Modifier |
|--------|-------------|-------------------|
| **TTL expiry window** | User position's Persistent entry expires (archived) during a long multi-step operation. Step N read panics or returns stale default. | HIGH if position data lost; MEDIUM if restorable |
| **Ledger sequence drift** | Protocol uses hardcoded ledger counts for delays; Stellar network changes average ledger time. Delays become longer or shorter than intended in wall-clock seconds. | Medium if delay is safety-critical (e.g., withdrawal delay shorter than market manipulation window) |
| **Timestamp lag** | `env.ledger().timestamp()` lags wall clock during network stress. Tight timestamp comparisons (<60s) may behave unexpectedly. | Medium if tight comparisons used |
| **Config upgraded mid-operation** | Admin upgrades contract wasm between Step 1 and Step N. New wasm reads cached params differently. | High — storage layout changes can corrupt cached position |
| **Instance TTL expiry** | Instance storage (holding config) expires during a long operation. Step N reads config and panics. | MEDIUM — affects all users simultaneously |

---

## Step 3b: Update Source Audit

For each parameter updated from an external source (oracle contract, price feed):
- Is the source the correct representation of what this parameter tracks?
- **Is the source contract address validated?** Can a fake oracle be substituted via a user-supplied address?
- Should this parameter be fixed for a period (e.g., per epoch cycle) rather than continuously refreshed?
- Which functions update it? Which SHOULD? Any mismatch?
- **Is there a `refresh` or `crank` function?** Who calls it and when? What is the protocol state if it is never called?

---

## Step 4: Retroactive Application Analysis

For fee/rate parameters that apply to existing state:

| Parameter | Storage Key | Applies To | Retroactive? | Impact |
|-----------|------------|-----------|--------------|--------|
| {fee_param} | {DataKey::FeeBps} | {what it affects} | YES/NO | {if retroactive: who is harmed} |

**Soroban retroactive patterns**:
- **Instance config update**: Admin changes `fee_bps` in Instance storage. All pending claims calculated at completion time using new rate — retroactively changes expected returns for users who initiated under old rate.
- **Cooldown ledger update**: Admin changes `cooldown_ledgers` in config. Users who initiated cooldown under old value may now need to wait longer or shorter — retroactive effect on in-flight positions.
- **Rate-at-close pattern**: If the protocol reads the current config rate at Step N (not the cached rate from Step 1), any admin change between steps applies retroactively to all pending operations.

**Rule 2 direction check**: Can the admin's parameter change make a user-facing function behave unexpectedly? (e.g., setting `cooldown_ledgers = 0` removes withdrawal protection entirely; setting `max_withdrawal = 0` blocks all withdrawals). Does the change retroactively affect users in active positions?

---

## Step 5: Assess Severity

For each staleness issue:
- **Who is affected?** (single user, all users with pending operations, protocol)
- **Is the impact bounded?** (capped by parameter range, max delay, etc.)
- **Can it be exploited intentionally?** (admin or operator timing changes to specific ledgers)
- **Is there a recovery path?** (cancel and re-initiate, admin override)
- **Ledger precision**: Given ~5s ledger close time, how precisely can an attacker time the exploitation?

### Severity Assessment (Rule 10 — Worst-State)

Use worst realistic operational state, not current on-chain snapshot:
```
Severity assessed at: pending_claims=MAX_USERS, fee_delta=MAX_FEE-MIN_FEE, tvl=$XXM
Rationale: Protocol designed for up to {N} concurrent pending operations per documentation
```

---

## Key Questions (must answer all)

1. What multi-step operations exist? (initiate/claim, deposit/cooldown/withdraw, propose/execute)
2. For each cached parameter: can admin change it between steps?
3. What happens if a delay DECREASES after initiation? (users can complete too early relative to new policy)
4. What happens if a delay INCREASES after initiation? (users locked longer than originally expected)
5. Are fees applied retroactively to existing positions or only to new ones?
6. Is there a maximum parameter range that bounds the staleness impact?
7. **Soroban-specific**: Does the protocol use `sequence_number` or `timestamp` for timing? If `timestamp`, is potential lag handled?
8. **Soroban-specific**: Does any Persistent storage entry have a TTL shorter than the longest expected operation? Can it expire mid-operation?
9. **Soroban-specific**: Is there a crank/refresh function? What happens if it is never called?
10. **Soroban-specific**: If the contract is upgraded between Step 1 and Step N, does the new wasm correctly interpret cached values from Persistent storage?

---

## Common False Positives

- **Immutable config**: If Instance storage has no update function or admin is revoked, no staleness
- **Bounded ranges**: If min/max bounds limit the change magnitude (enforced on-chain), impact may be Low
- **User can cancel**: If users can cancel pending operations and re-initiate, reduced severity
- **Timelock protection**: If parameter changes require a proposal+delay pattern, users have time to react
- **Same-transaction operations**: Operations completing within a single invocation tree cannot have clock staleness between steps
- **Re-read at completion**: If Step N re-reads directly from Instance storage (not a cached copy in Persistent), no staleness for that parameter

---

## Instantiation Parameters

```
{CONTRACTS}           - Contracts to analyze
{MULTI_STEP_OPS}      - Identified multi-step operations
{CACHED_PARAMS}       - Parameters cached at initiation (stored in user Persistent entries)
{ADMIN_PARAMS}        - Admin-changeable parameters in Instance storage
{DELAY_PARAMS}        - Delay/cooldown parameters (in ledger_sequence counts or timestamp seconds)
{FEE_PARAMS}          - Fee/rate parameters that may apply retroactively
{CLOCK_SOURCE}        - Clock source used (sequence_number / timestamp)
```

---

## Output Schema

| Field | Required | Description |
|-------|----------|-------------|
| multi_step_ops | yes | List of multi-step operations found |
| cached_params | yes | Parameters cached across steps (stored in which storage type + key) |
| staleness_vectors | yes | How cached params can become stale |
| retroactive_fees | yes | Fees applied retroactively |
| clock_source_audit | yes | Which clock source is used and whether appropriate |
| ttl_expiry_risks | yes | Storage entries that could expire mid-operation |
| finding | yes | CONFIRMED / REFUTED / CONTESTED |
| evidence | yes | Code locations with line numbers |
| step_execution | yes | Status for each step |

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Enumerate Multi-Step Operations | YES | | |
| 2. Identify Cached Parameters | YES | | |
| 3. Model Staleness Impact (both directions) | YES | | |
| 3b. Update Source Audit | YES | | |
| 4. Retroactive Application Analysis | YES | | |
| 5. Assess Severity | YES | | |

### Cross-Reference Markers

**After Step 2**: If cached parameters are admin-changeable → MUST complete Step 3 with BOTH increase and decrease scenarios.

**After Step 4**: Cross-reference with SEMI_TRUSTED_ROLES for admin functions that change these parameters.

**After Step 3**: If protocol uses `timestamp` for comparisons tighter than 60 seconds → FLAG clock lag concern.

**After Step 1**: If any Persistent storage entry has a TTL shorter than the longest expected operation → cross-reference with TTL expiry risk (Step 3 vector: TTL expiry window).
