---
name: "sep41-token-safety"
description: "Trigger Pattern SEP-41 token patterns detected (approve/transfer/transfer_from/allowance/balance) - Inject Into Breadth agents, depth-token-flow, depth-edge-case"
---

# SEP41_TOKEN_SAFETY Skill (Soroban)

> **Trigger Pattern**: SEP-41 token patterns detected (`approve`/`transfer`/`transfer_from`/`allowance`/`balance`)
> **Inject Into**: Breadth agents, depth-token-flow, depth-edge-case
> **Finding prefix**: `[ST-N]`
> **Rules referenced**: R4, R5, R10, R11, R13, R15

SEP-41 is Soroban's token interface standard, analogous to ERC-20. It introduces Soroban-specific behaviors that differ from ERC-20: allowances use Temporary storage with `expiration_ledger`, the `approve` function can be front-run similarly to ERC-20, and the Stellar Asset Contract (SAC) bridges Stellar classic assets into Soroban with additional accounting complexity.

## 1. Approve Race Condition

The `approve(from, spender, amount, expiration_ledger)` function overwrites the current allowance without checking the existing value. This is the ERC-20 approve race condition, present identically in SEP-41:

| Token Contract | `approve` Guarded? | Guard Type | Effective? |
|---------------|-------------------|-----------|-----------|
| `{contract}` | YES/NO | `require!(current == 0)` / none | YES/NO |

**Attack sequence**:
1. Owner approves spender for 100 tokens
2. Owner submits new approval for 50 tokens
3. Spender front-runs the new approval and spends the 100-token allowance
4. New 50-token approval is set
5. Spender spends 50 more tokens — net: 150 tokens spent, 50 intended

**Soroban-specific note**: Soroban does not have a traditional mempool — transaction ordering is determined by validators, not fee-based priority. However, multi-operation transactions and DEX routing can create ordering dependencies. The race condition is lower likelihood than on EVM but the vulnerability exists.

**Check for**:
- Does `approve` allow setting non-zero over non-zero without an intermediate zero-set step?
- Does the protocol documentation warn users about the race condition?
- Are there any off-chain tools (like `increaseAllowance` / `decreaseAllowance` equivalents) to safely adjust allowances?

## 2. Allowance Expiry

SEP-41 allowances include an `expiration_ledger` parameter stored alongside the allowance amount. When the ledger passes `expiration_ledger`, the allowance is treated as zero. Verify expiry is handled correctly:

| Contract | Allowance Expiry Checked Before Use? | Expired Allowance Returns 0 or Panics? | Protocol Communicates Expiry to Users? |
|---------|--------------------------------------|---------------------------------------|---------------------------------------|
| `{contract}` | YES/NO | `{behavior}` | YES/NO |

**Allowance storage**: SEP-41 standard stores allowances in Temporary storage with TTL linked to `expiration_ledger`. When `expiration_ledger` passes, the Temporary entry may be pruned, and the `allowance()` call returns zero automatically.

**Checks**:
- Does the calling contract handle the case where a previously valid allowance has expired and `transfer_from` now fails?
- Is `expiration_ledger` validated to be in the future when `approve` is called? Setting `expiration_ledger` in the past silently creates an already-expired allowance
- For protocol-controlled allowances (e.g., a contract that approves tokens on behalf of users): does the contract re-approve if the allowance has expired?

**Edge case**: `expiration_ledger = 0` behavior — verify whether the token contract treats 0 as "no expiry" or "expired at ledger 0" (already expired). Inconsistency here could cause silent allowance failures.

## 3. Transfer Auth Propagation

SEP-41 `transfer(from, to, amount)` requires `from.require_auth()`. `transfer_from(spender, from, to, amount)` requires `spender.require_auth()` and checks the allowance. Trace auth through the contract's transfer chains:

| Calling Function | Transfer Type | Auth Address | `require_auth` Called? | Correct Subject? |
|-----------------|--------------|-------------|----------------------|-----------------|
| `{fn}` | `transfer` / `transfer_from` | `{from or spender}` | YES/NO | YES/NO |

**Patterns to check**:
- A contract calling `token.transfer(user, contract, amount)` on behalf of a user — does it call `user.require_auth()` first, or does it rely on the token contract to enforce it?
- Sub-invocation auth propagation: if a function calls `token.transfer` inside a `invoke_contract` chain, is the `AuthorizedInvocation` tree constructed to include the token transfer?
- `transfer_from` where the spender is the calling contract itself (valid for vault patterns) — is the allowance actually set, or does the contract assume it already is?

## 4. SAC Interaction

The Stellar Asset Contract (SAC) wraps Stellar classic XLM and issued assets as SEP-41 tokens. Contracts that interact with SAC face unique considerations:

| Concern | Addressed? | Evidence |
|---------|-----------|----------|
| SAC balance includes trust line state (frozen/unauthorized) | YES/NO | `{fn:line or NONE}` |
| Classic Stellar operations affecting SAC balance not reflected in Soroban state | YES/NO | `{fn:line or NONE}` |
| Clawback feature of issued assets handled | YES/NO | `{fn:line or NONE}` |
| Issuer authorization revocation handled | YES/NO | `{fn:line or NONE}` |
| Token address permanence (classic re-issuance / migration) | YES/NO | `{fn:line or NONE}` |

**SAC-specific risks**:
- **Trust line authorization**: A classic Stellar account can have its trust line for an asset revoked by the issuer. After revocation, `transfer` to that account fails silently or panics. Contracts that assume all transfers succeed need to handle this.
- **Clawback**: Some Stellar assets have clawback enabled. An issuer can call `clawback` to reduce a Soroban contract's balance without any Soroban transaction. This means a contract's `balance()` can decrease between two Soroban transactions with no on-Soroban event.
- **Balance source of truth**: SAC reads balances from the underlying Stellar ledger state. If a classic operation changes the balance, the Soroban contract sees the new balance immediately — this can break invariants if the contract caches balances.
- **Token address permanence**: On Stellar, classic assets can be re-issued or migrated, changing their effective on-chain identity. Contracts that derive storage keys, registry lookups, or deployment salts from token addresses may become unreachable if a token's address changes. Verify whether token address references can be updated or if the protocol documents this as a known limitation.

## 5. Balance Verification

When a contract accepts token deposits, it should verify the actual balance received rather than trusting the `amount` parameter:

| Function | Reads Balance After Transfer? | Trusts Amount Parameter? | Fee-on-Transfer Risk? |
|----------|------------------------------|--------------------------|----------------------|
| `{fn}` | YES/NO | YES/NO | YES/NO |

**Note**: Standard Soroban tokens (non-SAC) do not support fee-on-transfer. However:
- SAC-wrapped assets with clawback can reduce effective received amount
- Custom token implementations may deviate from the standard
- Protocols that accept arbitrary SEP-41 tokens should always read balance before and after transfer

**Safe pattern**:
```rust
let balance_before = token.balance(env.current_contract_address());
token.transfer_from(&spender, &from, &env.current_contract_address(), &amount);
let balance_after = token.balance(env.current_contract_address());
let received = balance_after - balance_before;
// Use `received` not `amount` for accounting
```

## 6. Burn Authorization

`burn(from, amount)` and `burn_from(spender, from, amount)` must enforce proper authorization:

| Function | Auth Check | Auth Subject | Correct? |
|----------|-----------|-------------|---------|
| `burn` call at `{file:line}` | `from.require_auth()` | `from` | YES/NO |
| `burn_from` call at `{file:line}` | `spender.require_auth()` + allowance check | `spender` | YES/NO |

**Checks**:
- `burn` without `require_auth` on `from` → anyone can burn any user's tokens
- `burn_from` without allowance check → bypasses the approval mechanism
- Protocol contracts that call `burn` to destroy tokens: verify they call `from.require_auth()` or that `from` is the calling contract itself (self-burn is always permitted)
- `burn` combined with minting: verify the net supply change is intentional and correctly accounted

## Finding Template

```markdown
**ID**: [ST-N]
**Severity**: [Critical if token theft, High if allowance bypass or burn exploit, Medium if expiry/SAC risk, Low if approve race]
**Step Execution**: ✓1,2,3,4,5,6 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R4:✓/✗, R5:✓/✗, R10:✓/✗, R11:✓/✗, R13:✓/✗, R15:✓/✗]
**Location**: src/{contract}.rs:LineN
**Title**: {Approve race / Expired allowance / Auth bypass / SAC risk / Burn exploit} in `{fn_name}`
**Description**: [Specific SEP-41 interaction flaw with code reference]
**Impact**: [Token theft / silent transfer failure / incorrect accounting / unauthorized burn]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Approve Race Condition | YES | ✓/✗/? | All `approve` call sites |
| 2. Allowance Expiry | YES | ✓/✗/? | All `transfer_from` paths and approve expiration_ledger handling |
| 3. Transfer Auth Propagation | YES | ✓/✗/? | All `transfer` and `transfer_from` invocations |
| 4. SAC Interaction | IF SAC tokens are involved | ✓/✗(N/A)/? | Trust line, clawback, balance caching |
| 5. Balance Verification | IF contract accepts deposits | ✓/✗(N/A)/? | Balance-before vs balance-after pattern |
| 6. Burn Authorization | IF `burn` or `burn_from` present | ✓/✗(N/A)/? | Auth on all burn call sites |
