---
name: "flash-loan-interaction"
description: "Trigger Pattern FLASH_LOAN flag (required) or BALANCE_DEPENDENT flag (optional complement) - Inject Into Breadth agents, depth-token-flow, depth-edge-case"
---

# FLASH_LOAN_INTERACTION Skill (Soroban)

> **Trigger Pattern**: FLASH_LOAN flag (required) or BALANCE_DEPENDENT flag (optional complement)
> **Inject Into**: Breadth agents, depth-token-flow, depth-edge-case
> **Finding prefix**: `[FL-N]`
> **Rules referenced**: R2, R4, R10, R15

**Key Soroban difference from EVM**: There is no native flash loan protocol on Stellar (no Aave, no Uniswap V3 flash). Flash loan patterns on Soroban exist only if a specific Soroban lending contract implements them, typically as a "borrow-callback-repay" pattern using `invoke_contract` as the callback mechanism. The primary attack surface is NOT flash loans per se but **balance manipulation within a single transaction** — because Soroban executes contract calls atomically and an attacker can compose multiple `invoke_contract` calls in one transaction to manipulate state.

**Key Soroban difference from Solana**: There is no instruction composition at the transaction level (no ordered IX list). All manipulation must happen via nested `invoke_contract` calls from a single top-level call, OR via multiple separate transactions (not atomic). This limits same-transaction flash-attack composability compared to Solana but does not eliminate it.

**Step Priority**: Steps 5 (Defense Audit) and 5b (Defense Parity) are where HIGH/CRITICAL severity findings most commonly hide. Do NOT rush these steps. If constrained, skip conditional sections (0c, 4) before skipping 5, 5b, or 3d.

## 0. External Call Flash Susceptibility Check

Before analyzing the protocol's own flash loan paths, check whether external contracts the protocol calls have state manipulable by a third party within the same nested call sequence.

### 0a: External Interaction Inventory

| External Contract | Interaction Type | State Read by Our Contract | Can 3rd Party Manipulate That State in Same Tx? |
|------------------|-----------------|---------------------------|------------------------------------------------|
| {DEX/AMM/vault} | {swap/deposit/price query} | {reserves, price, balance} | {YES if spot state / NO if TWAP or ledger-gated} |

### 0b: Nested Call Flash Attack Modeling

For each external state marked YES in 0a, model:
1. **CALL 1 — BORROW**: Call flash-loan contract (if one exists) to borrow capital
2. **CALL 2 — MANIPULATE**: Nested call to external contract that changes state X (e.g., swap to move pool reserves)
3. **CALL 3 — VICTIM CALL**: Nested call to OUR contract that reads manipulated state X
4. **CALL 4 — RESTORE**: Reverse the external manipulation (reverse swap), if required for repayment
5. **CALL 5 — REPAY**: Repay flash loan within same transaction
6. **IMPACT**: What did the attacker gain from our contract acting on manipulated state?

**Key question**: Does our contract use **spot state** (balance/price readable in the same ledger, manipulable within the same transaction via nested calls) or **ledger-gated state** (written in a prior ledger, not manipulable in same transaction)?

<!-- LOAD_IF: DEX_INTERACTION -->
### 0c: DEX Price Manipulation Cost Estimation (Stellar SDEX / Soroban AMM)

For each external AMM whose spot state is read by the contract, estimate manipulation cost:

| Pool | Liquidity (USD) | Target Price Change | Est. Trade Size | Cost | Contract Extractable Value | Profitable? |
|------|----------------|--------------------:|----------------|------|---------------------------|-------------|
| {pool} | {TVL} | {%} | {USD} | {USD} | {USD} | {YES/NO} |

**Stellar SDEX note**: The Stellar DEX (classic orderbook) settles at ledger close and its mid-price cannot be manipulated within a single Soroban call — it is computed from the orderbook state at ledger close time. However, Soroban AMM pools (liquidity pools with on-chain reserves) CAN be manipulated within a nested call sequence. Distinguish SDEX-based prices from Soroban AMM-based prices.
<!-- END_LOAD_IF: DEX_INTERACTION -->

## 1. Flash-Loan-Accessible State Inventory

Enumerate ALL contract state that can be manipulated within a single transaction via flash-borrowed capital or nested `invoke_contract` calls:

| State Variable / Storage Key | Location | Read By | Write Path | Flash/Nested-Accessible? | Manipulation Cost |
|------------------------------|----------|---------|------------|--------------------------|-------------------|
| `token_balance` (via SAC query) | {storage} | {functions} | SAC transfer (anyone) | YES | 0 (unsolicited transfer) |
| `vault_total_value` | {storage key} | {functions} | deposit function | YES if permissionless | Deposit amount |
| AMM pool reserves | {external contract} | {functions} | Swap function | YES | Slippage cost |
| Oracle price | {external contract} | {functions} | Oracle update call | YES if same-ledger updatable | Market depth |
| Quorum / threshold state | {storage key} | {functions} | Stake/vote function | YES | Threshold amount |

**For each YES entry**: trace all contract functions that READ this state and make decisions based on it.

**Rule 15 check**: For each balance/oracle/threshold/rate precondition, model the nested call atomic sequence.

**Soroban balance read caveat**: `token::Client::balance(&env, &contract_address)` queries the SAC (Stellar Asset Contract) token balance. This reflects the CURRENT balance during the call, including any transfers made in nested calls earlier in the same transaction. It is therefore manipulable if the attacker can deposit tokens before the balance is read.

## 2. Atomic Attack Sequence Modeling (Nested Calls)

For each flash-loan-accessible state identified in Step 1:

### Attack Template (Single Soroban Transaction with Nested Calls)
```
Top-level transaction invokes attacker contract, which makes nested calls:
  CALL 1 — BORROW:     invoke_contract(flash_loan_contract, "borrow", [amount, token])
  [CALLBACK — protocol's callback is invoked by flash loan contract]
  CALL 2 — MANIPULATE:  invoke_contract(external_contract, "swap", [...]) — changes {state_variable}
  CALL 3 — VICTIM:     invoke_contract(victim_contract, "target_fn", [...]) — reads manipulated state
  CALL 4 — EXTRACT:    {what is gained} — quantify: {amount}
  CALL 5 — RESTORE:    invoke_contract(external_contract, "reverse_swap", [...]) — if needed for repayment
  CALL 6 — REPAY:      return {amount + fee} to flash loan contract (in callback return value)

  PROFIT: {extract - fee - tx_fee}
```

**Soroban callback model**: If the protocol implements flash loans, the borrower contract must be called back via `invoke_contract` from the lender. The lender verifies repayment either by (a) checking its own balance after the callback returns, or (b) trusting a return value from the callback. Verify which model is used:
- Balance check after callback: safe but requires SAC balance read
- Return-value trust: potentially unsafe if return value can be spoofed

**For each sequence, verify**:
- [ ] Can all calls execute within a single transaction's resource budget?
- [ ] Does any call fail under normal conditions?
- [ ] Is the manipulation detectable/preventable by the contract?
- [ ] What is the minimum flash-borrow amount needed?
- [ ] Does the call depth exceed Soroban's maximum call stack depth?

## 3. Cross-Call Flash Loan Chains

Model multi-call sequences within a single transaction (via nested `invoke_contract`):

| Step | Contract Called | State Before | State After | Enables Next Step? |
|------|----------------|-------------|------------|-------------------|
| CALL 1 | {contract_A.function_X} | {state} | {state'} | YES — changes {X} |
| CALL 2 | {contract_B.function_Y} | {state'} | {state''} | YES — enables {Y} |
| CALL N | {contract_N.function_Z} | {state^N} | {final} | EXTRACT profit |

**Key question**: Can calling function A then function B in the same nested call sequence produce a state that neither call alone could create?

**Soroban call depth limit**: Soroban enforces a maximum contract call depth. Deep nesting chains are limited. Count the nesting depth of the proposed attack and verify it is within the limit.

### 3b. Flash-Loan-Enabled Cooldown DoS

For each permissionless function with a cooldown stored in contract storage that affects OTHER users (ledger-sequence-based or timestamp-based global cooldown): can an attacker use a flash-loan nested call sequence to trigger the cooldown, blocking legitimate callers?

| Function | Cooldown Scope | Shared Across Users? | Flash-Triggerable? | DoS Duration |
|----------|---------------|---------------------|-------------------|-------------|

If global/shared AND permissionless AND triggerable via nested calls -> FINDING (R2, minimum Medium).

### 3c. No-Op Resource Consumption

For each state-modifying function with a limited-use resource (cooldown, one-time flag, ledger-sequence-bound action): can it be called with parameters producing zero economic effect (amount=0, self-transfer, no-op swap) while consuming the resource?

| Function | Resource Consumed | No-Op Parameters | Resource Wasted? | Impact |
|----------|------------------|-----------------|-----------------|--------|

If a no-op call consumes a resource that blocks legitimate use -> FINDING (R2, resource waste).

### 3d. External Flash x Cooldown Cross-Reference (MANDATORY)

For EACH external contract flagged as flash-susceptible in Section 0:

| External Contract | Flash-Accessible Action | Cooldown Affected (from 3b) | Combined Severity |
|------------------|------------------------|------------------------------|-------------------|

If YES: (1) permanent or temporary consumption? (2) on-chain reset path? (3) combined severity = HIGHER of the two. Tag: `[TRACE:flash({external})->call({cooldown_fn})->cooldown consumed->{duration}]`. If no cooldown from 3b: N/A.

<!-- LOAD_IF: BALANCE_DEPENDENT -->
## 4. Flash Loan + Token Donation Compound Attacks

Combine flash-borrowed capital with unsolicited Soroban token transfers (SAC `transfer` is permissionless — anyone knowing the contract address can transfer tokens to it):

| Donation Target | Flash Loan Action | Combined Effect | Profitable? |
|-----------------|-------------------|-----------------|-------------|
| Vault token balance (SAC query) | Deposit/withdraw | Rate manipulation | {YES/NO} |
| AMM pool token account | Swap | Price oracle manipulation | {YES/NO} |
| Governance staking balance | Vote/propose | Quorum manipulation | {YES/NO} |

**Check**: Can flash-borrowed tokens be transferred (not deposited via protocol) to the protocol's token account using `token::Client::transfer`, to manipulate `token::Client::balance()` accounting, then extracted via a subsequent nested call within the same transaction?

**Soroban-specific**: SAC `transfer` is always permissionless for the token holder. Any contract or account with a token balance can transfer to any other address. If the protocol reads `token::Client::balance()` to measure deposits, it is susceptible to donation attacks.
<!-- END_LOAD_IF: BALANCE_DEPENDENT -->

## 5. Flash Loan Defense Audit

For each flash-loan-accessible attack path identified:

| Defense | Present? | Effective? | Bypass? |
|---------|----------|------------|---------|
| Re-entrancy guard (storage flag set before external call, checked on re-entry) | YES/NO | {analysis} | {if YES: how} |
| Ledger-sequence-based cooldown (`env.ledger().sequence()`) | YES/NO | Sequences required: {N} | Same-ledger bypass? |
| TWAP instead of spot price | YES/NO | TWAP window: {N ledgers} | Short TWAP vulnerable? |
| Balance snapshot (pre/post call comparison using SAC balance) | YES/NO | {analysis} | {if YES: how} |
| Flash loan fee exceeds profit | YES/NO | Fee: {X}, max profit: {Y} | Fee < profit? |
| Restricted call depth (only allows direct calls, no nested re-entry) | YES/NO | Checks call depth or auth | Spoofable? |

**Soroban re-entrancy note**: Soroban does NOT automatically prevent re-entrant calls the way some EVM frameworks do. A contract calling an external contract via `invoke_contract` can have that external contract call back into the original contract if it holds a reference to it. Guards must be implemented manually using a storage flag (set at function start, cleared at end). Verify this pattern is used where external calls are made.

### 5b. Defense Parity Audit (Cross-Function)

For each user-facing action available in multiple function variants:

| Action | Function A | Flash Defense | Function B | Flash Defense | Parity? |
|--------|-----------|---------------|-----------|---------------|---------|
| {action} | {fn_name} | {defense list} | {fn_name} | {defense list} | {GAP if different} |

**Key question**: If `deposit` has a ledger-sequence cooldown but `deposit_v2` has NONE for the same economic action — can an attacker use `deposit_v2` as the undefended path? For each GAP: can the undefended function achieve the same outcome as the defended one?

## Finding Template

```markdown
**ID**: [FL-N]
**Severity**: [based on profitability and fund impact]
**Step Execution**: S0,1,2,3,4,5 | X(reasons) | ?(uncertain)
**Rules Applied**: [R2:Y, R4:Y, R10:Y, R15:Y]
**Location**: src/{file}.rs:LineN
**Title**: Nested call composition enables [manipulation] via [mechanism]
**Description**: [Full nested call sequence with amounts]
**Impact**: [Quantified profit/loss with realistic flash-borrow amounts]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 0. External Call Flash Susceptibility Check | YES | Y/X/? | For each external contract interaction |
| 1. Flash-Loan-Accessible State Inventory | YES | Y/X/? | |
| 2. Atomic Attack Sequence Modeling | YES | Y/X/? | For each accessible state |
| 3. Cross-Call Flash Loan Chains | YES | Y/X/? | |
| 3b. Flash-Loan-Enabled Cooldown DoS | YES | Y/X/? | Shared cooldown functions |
| 3c. No-Op Resource Consumption | YES | Y/X/? | Zero-effect calls consuming resources |
| 3d. External Flash x Cooldown Cross-Ref | YES | Y/X/? | Cross-reference 0 x 3b |
| 4. Flash Loan + Token Donation Compounds | IF BALANCE_DEPENDENT | Y/X(N/A)/? | |
| 5. Flash Loan Defense Audit | YES | Y/X/? | For each attack path |
| 5b. Defense Parity Audit | YES | Y/X/? | For each action in multiple function variants |
