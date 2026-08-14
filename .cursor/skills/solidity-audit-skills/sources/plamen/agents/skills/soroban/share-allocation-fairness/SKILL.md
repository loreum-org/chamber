---
name: "share-allocation-fairness"
description: "Trigger Pattern SHARE_ALLOCATION flag detected in pattern scan - Inject Into Breadth agents, depth-edge-case"
---

# SHARE_ALLOCATION_FAIRNESS Skill (Soroban)

> **Trigger Pattern**: SHARE_ALLOCATION flag detected in pattern scan
> **Inject Into**: Breadth agents, depth-edge-case
> **Finding prefix**: `[SAF-N]`
> **Rules referenced**: R5, R10, R13, R14

```
shares|allocation|distribute|pro_rata|proportional|vest|reward_per_share|
mint|burn|reward_index|cumulative|checkpoint|epoch_reward
```

## Purpose

Analyze fairness of share/token allocation mechanisms on Soroban where users receive shares proportional to deposits, contributions, or participation — checking for late-entry advantages, storage-default manipulation, authorization bypass, and time-weighting omissions.

**Soroban arithmetic constraint**: ALL share math uses `i128` (signed 128-bit integer). There is no floating-point arithmetic. All pro-rata and time-weighted calculations must use multiply-then-divide integer patterns. Division truncates toward zero. Overflow with unchecked `*` on `i128` wraps silently in Rust release mode — use `checked_mul`.

---

## STEP 1: Classify Allocation Mechanism

Identify which pattern the protocol uses:

| Type | Soroban Pattern | Key Risk |
|------|----------------|----------|
| Pro-rata snapshot | Shares minted at fixed ratio via `mint()` on custom SEP-41 token at deposit time | Late depositors dilute early depositors' accrued value |
| Time-weighted | Per-user Persistent entry tracks `reward_per_share_paid: i128` and `accrued_rewards: i128` | Checkpoint manipulation, stale reward index |
| Epoch-based | Shares valued per ledger-sequence epoch; epoch tracked in Instance storage | Cross-epoch timing arbitrage at epoch transition ledgers |
| Queue-based | Ordered list in Instance/Persistent storage (Vec or linked entries) | Queue position gaming, partial processing fairness |

---

## STEP 2: Late Entry Attack Model

For each allocation entry function:

1. **Identify accrual source**: What generates value for existing share holders? (yield from cross-contract calls, fees collected at contract address, XLM/token rewards)
2. **Trace timing**: When does accrued value become claimable vs when can new shares enter? Is there a checkpoint function separate from deposit?
3. **Check for time-weighting**: Does allocation account for HOW LONG shares were held, or only THAT shares are held at checkpoint time?
4. **Model attack**: Can a depositor enter AFTER value accrues but BEFORE distribution, capturing value they did not earn?

| Entry Function | Accrual Source | Time-Weighted? | Late Entry Possible? | Impact |
|---------------|----------------|----------------|---------------------|--------|

**Soroban timing**: With ~5s ledger close time, timing attacks require multi-ledger execution. However, in high-value situations an attacker can monitor on-chain state and submit a transaction to land in the specific ledger just before a known distribution event.

#### STEP 2c: Cross-Address Deposit Model

For each entry function accepting a `recipient: Address` parameter that is NOT verified to be the function caller:

| Entry Function | Accepts Recipient != Caller? | Default State for New Persistent Entry | Exploitable? | Impact |
|---------------|------------------------------|---------------------------------------|-------------|--------|

**Check**: When a new Persistent entry is created for a recipient address:
- What are the DEFAULT values? (`reward_per_share_paid: i128 = 0`? `last_deposit_ledger: u32 = 0`?)
- If `reward_per_share_paid` starts at 0 while the global index is at N, the new entry holder is entitled to ALL historical rewards on their deposit — FINDING (late-entry variant)
- Can `deposit(recipient, amount)` where `recipient != caller` be used to create a new Persistent entry that captures historical rewards the recipient did not earn?
- Does the function use a new Persistent entry (first call creates with defaults) vs updating an existing one?

#### STEP 2d: Pre-Setter Timing Model

For each admin-settable reward/rate parameter stored in Instance storage:

| Parameter Setter | Staked-Before-Set? | Retroactive Rewards? | Fair? |
|-----------------|-------------------|---------------------|-------|

Model the sequence: user deposits (Persistent entry created with current index) → admin sets reward rate → rewards accrue.
- Does the user receive retroactive rewards for the period BEFORE the rate was set?
- Does a depositor AFTER rate-setting receive the same, more, or less?
- Is the global reward index updated atomically with the rate change (same transaction), or can a window exist?

### 2e. Pre-Configuration State Analysis

For the allocation mechanism identified in Step 1:

| Configuration Step | Storage Key Initialized | Functions Available Before Init | Exploitable Default? |
|-------------------|------------------------|--------------------------------|---------------------|

1. What is the deployment/initialization sequence? List all `initialize_*` functions in order.
2. For each step: what functions are callable BEFORE this initialization completes?
3. Are there reward/share calculations that read Instance storage keys that may not yet exist (returning `None`)?
4. Can a user call deposit/stake functions before all Instance storage keys are initialized and receive outsized rewards/shares due to `None` → `unwrap_or(0)` defaults?
5. Is there an `is_initialized` flag in Instance storage or an admin check that prevents interaction before configuration completes?

If users can interact during partial initialization AND default storage values create unfair advantage → FINDING (minimum Medium, Rule 13: design gap).

---

## STEP 3: Queue Position and Batch Processing

For protocols with queue-based or batch processing:

1. **Ordering fairness**: Is queue order FIFO (append-only Vec in Instance storage), arbitrary (admin-chosen), or manipulable (fee-based ledger ordering)?
2. **Partial processing**: Can processing handle some entries but not others within a batch? (Resource metering limits force partial processing — who gets processed first?)
3. **Cross-batch state**: Does processing order within a batch affect allocation ratios? (first processed gets better rate if rate changes with each step)
4. **Deposit splitting**: Can a user split one large deposit into many small Persistent entries to gain queue advantage or bypass per-entry limits?

**Resource-aware batching**: If batch processing iterates over a Vec stored in Instance storage:
- What is the max batch size before exceeding the transaction's CPU instruction or memory budget?
- Can an attacker bloat the queue with dust deposits to force partial processing?
- Does partial processing create unfair ordering advantages for early entries?
- If the Vec grows unboundedly, does Instance storage size (and thus TTL extension fees) scale unboundedly?

---

## STEP 4: Share Redemption Symmetry

Check that entry and exit use consistent valuation:

1. **Mint vs burn ratio**: Are shares minted at the same exchange rate they can be burned? (check share price formula in both deposit and withdraw functions)
   - With `i128` math: does rounding in deposit vs withdraw consistently favor one party?
   - Example: deposit mints `floor(amount * total_shares / total_value)` shares; withdraw gives `floor(shares * total_value / total_shares)` tokens — rounding may always favor the protocol
2. **Pending claims**: Can unclaimed reward tokens tracked in Persistent storage dilute active shares' value? (rewards owed to specific users but still counted as TVL)
3. **Withdrawal ordering**: Does withdrawal order create unfair priority? (first to withdraw gets full value; later withdrawers face depleted vault if cross-contract positions haven't been unwound)

**Token admin risks in Soroban**:
- **Custom token mint authority**: If the protocol controls a custom SEP-41 token's admin, can it mint additional shares outside the deposit logic? Is minting gated to the deposit function only?
- **SAC freeze/clawback**: If the share token is a SAC-wrapped asset, the Stellar issuer can freeze or clawback individual user balances, preventing them from redeeming shares — denial of service on targeted users
- If SAC freeze authority is active: who controls it? Can it be revoked? FINDING if freeze can target individual users holding shares.

#### STEP 4b: Aggregate Constraint Coherence (Rule 14)

For independently-settable allocation rates/shares (e.g., per-pool weights, fee splits, distribution percentages stored as separate Instance storage keys):

| Rate/Weight Setter | Aggregate Constraint | Enforced On-Chain? | What if Sum Exceeds/Falls Short? |
|-------------------|---------------------|-------------------|--------------------------------|

**Soroban-specific**: If weights are stored as separate Instance storage keys (one per pool), the setter function may update ONE key without reading and summing ALL keys to validate the aggregate. This is especially problematic when each setter only receives its own key as context.

If aggregate constraint NOT enforced and rates independently settable → FINDING (Rule 14).

**Also check**: Can admin set a weight to 0 for an active pool? What happens to users with deposits in that pool? (Rule 14 setter regression — setting weight below accumulated state causes division-by-zero or zero-allocation for existing depositors)

---

## Output

For each finding, specify:
- Allocation mechanism type (pro-rata, time-weighted, queue, epoch)
- Whether time-weighting is present or missing
- Concrete attack sequence with numerical `i128` example (token amounts in smallest unit, e.g., stroops for XLM)
- Who benefits and who is harmed
- Whether the attack requires precise ledger ordering (high-fee transaction) or is achievable with normal timing

---

## Finding Template

```markdown
**ID**: [SAF-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see checklist below)
**Rules Applied**: [R5:___, R10:___, R13:___, R14:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: src/{file}.rs:LineN
**Title**: {fairness violation type}
**Description**: {specific issue with i128 numerical example}
**Impact**: {quantified at worst-state parameters — who loses how much, in stroops or token units}
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Classify Allocation Mechanism | YES | | |
| 2. Late Entry Attack Model | YES | | |
| 2c. Cross-Address Deposit Model | YES | | Check recipient != caller patterns |
| 2d. Pre-Setter Timing Model | YES | | Model deposit-before-rate-set sequence |
| 2e. Pre-Configuration State Analysis | YES | | Deployment window + uninitialized storage defaults |
| 3. Queue Position and Batch Processing | IF queue/batch detected | | Include resource-aware batch analysis |
| 4. Share Redemption Symmetry | YES | | Include custom token mint + SAC freeze check |
| 4b. Aggregate Constraint Coherence | IF multiple settable weights | | Rule 14 enforcement check |

If any step skipped, document valid reason (N/A, no queue, single pool, no settable weights).
