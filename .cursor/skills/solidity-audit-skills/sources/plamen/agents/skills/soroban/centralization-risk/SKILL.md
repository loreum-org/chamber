---
name: "centralization-risk"
description: "Trigger Pattern Protocol has privileged authorities (admin, operator, upgrade authority, governance) - Inject Into Breadth agents (optional), depth-state-trace"
---

# CENTRALIZATION_RISK Skill (Soroban)

> **Trigger Pattern**: Protocol has privileged authorities (admin, operator, upgrade authority, governance, multisig)
> **Inject Into**: Breadth agents (optional), depth-state-trace
> **Finding prefix**: `[CR-N]`
> **Rules referenced**: R2, R6, R9, R10, R13
> **Required**: NO (recommended when protocol has 3+ distinct privileged roles)

Covers: single points of failure, privilege escalation, contract upgrade risk, external governance dependencies, emergency powers. On Soroban, centralization risk has unique dimensions: `update_current_contract_wasm()` allows full contract replacement by the admin, Instance storage holds admin `Address` values (opaque — could be an account or another contract), no role-based modifiers like EVM's `onlyOwner` exist so access control is fully custom, and the `Address` type abstracts over both user accounts and contracts which can obscure who really controls a privilege.

---

## Step 1: Privilege Inventory

Enumerate ALL privileged functions by scanning for `require_auth` calls against stored admin/operator addresses:

| # | Function | Contract | Authority Field (storage key) | What It Controls | Impact If Abused |
|---|----------|---------|-------------------------------|------------------|-----------------|
| 1 | {fn_name} | {contract} | {Instance key e.g. "Admin"} | {parameter/state} | {worst case} |

**Soroban authority patterns to scan for**:
- `admin.require_auth()` — caller must be the stored admin address
- `let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap()` then `admin.require_auth()`
- `operator.require_auth()` — operator/keeper patterns stored in Instance or Persistent storage
- `e.current_contract_address().require_auth()` — contract authorizing itself (sub-contract call patterns)
- `update_current_contract_wasm(new_wasm_hash)` — upgrades the contract bytecode; whoever calls this controls all logic
- Multi-sig address: an `Address` that resolves to a Stellar multisig account (threshold signatures) vs a single keypair
- DAO/governance: an `Address` resolving to a Soroban governance contract

**Categorize each by impact**:
- **FUND_CONTROL**: Can move, lock, or drain contract token balances or native XLM
- **PARAMETER_CONTROL**: Can change fees, rates, thresholds, delays stored in Instance/Persistent storage
- **OPERATIONAL_CONTROL**: Can pause, unpause, add/remove pools/markets/validators
- **UPGRADE_CONTROL**: Can replace contract bytecode via `update_current_contract_wasm()`
- **MINT_CONTROL**: Can mint new tokens via SAC admin or custom token admin authority

---

## Step 2: Role Hierarchy and Separation

Map the role hierarchy:

| Role | Stored In (storage type + key) | Granted By | Can Grant Others? | Revocable? | Timelock? |
|------|-------------------------------|-----------|-------------------|-----------|-----------|
| {role} | {Instance/Persistent, key} | {granting function} | YES/NO | YES/NO | YES/NO ({mechanism}) |

### Soroban-Specific Hierarchy Checks

- [ ] Are FUND_CONTROL and UPGRADE_CONTROL held by different `Address` values?
- [ ] Does any single `Address` have both PARAMETER_CONTROL and FUND_CONTROL?
- [ ] Is the upgrade authority a multisig Stellar account (M-of-N threshold) rather than a single keypair?
- [ ] Are authority transfers behind timelocks (time-locked admin proposal pattern)?
- [ ] Can roles be revoked? Does revocation require the role-holder's cooperation?
- [ ] Is there a two-step authority transfer? (propose new admin → new admin accepts)
- [ ] Is the admin `Address` opaque — could it be a contract whose own admin is unknown?

### Contract Upgrade Authority Analysis (CRITICAL)

| Contract | Upgrade Guard | Type | Immutable? | Risk Level |
|---------|--------------|------|-----------|------------|
| {contract_id} | `update_current_contract_wasm` caller check | EOA / Multisig / DAO-contract / None | YES/NO | {assessment} |

**Risk levels**:
- **No upgrade function present**: Immutable. Verify by confirming `update_current_contract_wasm` is absent.
- **DAO/governance contract**: Low risk if governance has sufficient participation and timelock.
- **Stellar multisig (M-of-N, M >= 3)**: Low-Medium risk. Check threshold and signer count.
- **Stellar multisig (2-of-3 or lower)**: Medium risk. Two compromised signers replace the contract.
- **Single keypair**: **CRITICAL** risk. One compromised key replaces all contract logic.

---

## Step 3: Single Points of Failure

For each privileged role:

| Role | Key Compromise Impact | Mitigation | Residual Risk |
|------|----------------------|------------|---------------|
| {role} | {what attacker can do} | {multisig? timelock? immutable?} | {what remains} |

### Soroban-Specific SPOF Analysis

| Risk | Description | Severity |
|------|-------------|----------|
| **Upgrade authority compromise** | Attacker replaces contract wasm with malicious version. ALL contract state and funds at risk. | CRITICAL if single keypair, HIGH if multisig without timelock |
| **Admin address is a contract** | The admin `Address` resolves to another contract. That contract's own upgrade path is now the real privilege escalation vector. | Severity inherits from the outer contract's upgrade risk |
| **Single admin with FUND_CONTROL** | Admin can transfer all tokens out of the contract. | HIGH if single keypair, MEDIUM if multisig |
| **No admin rotation function** | Admin keypair loss = permanent loss of all admin capabilities. | HIGH — protocol becomes ungovernable |
| **SAC admin authority active** | Stellar Asset Contract admin can freeze/clawback user balances for the token. | HIGH if used in user-facing token flows |

**Severity assessment**:
- Single keypair with FUND_CONTROL or UPGRADE_CONTROL → **HIGH** centralization risk (minimum)
- Multisig with FUND_CONTROL but no timelock → **MEDIUM**
- Multisig + timelock with FUND_CONTROL → **LOW** (but document)
- No upgrade function + no privileged fund movement → **INFO**

---

## Step 4: External Governance Dependencies

Identify parameters or behaviors controlled by EXTERNAL governance:

| Dependency | External Entity | What They Control | Protocol Impact If Changed | Notification? |
|------------|----------------|-------------------|---------------------------|---------------|
| {dep} | {entity} | {parameter/behavior} | {impact on this protocol} | YES/NO |

**Soroban-specific external governance**:
- **Oracle contract governance**: Can upgrade oracle logic or change price feeds; protocol may lack staleness protection
- **SAC (Stellar Asset Contract)**: Issuer controls freeze/clawback; SAC upgrades via Stellar protocol upgrades
- **Stellar protocol upgrades**: Validator quorum can upgrade the Soroban host environment, changing resource costs, semantics, or adding new host functions
- **XLM network fee market**: Base reserve and minimum fee changes affect contract operation costs
- **External contract dependencies**: Any contract this protocol calls via `invoke_contract` — if that contract upgrades, behavior changes

**Check**:
- Can external governance changes break protocol invariants?
- Does the protocol verify called contract IDs? (If not, an external upgrade = arbitrary behavior change)
- Are external governance timelines aligned with this protocol's operational timelines?
- Does the protocol have circuit breakers for unexpected external changes?

---

## Step 5: Emergency Powers

Document emergency/pause capabilities:

| Emergency Function | Who Can Call | What It Affects | Recovery Path | Time to Recover |
|-------------------|-------------|-----------------|---------------|-----------------|
| {function} | {authority} | {scope} | {how to resume} | {estimate} |

### Soroban Emergency Patterns

| Pattern | Description | Risk |
|---------|-------------|------|
| **Global pause flag** | Instance storage has `paused: bool`. All user functions check it. | Standard — check: can users emergency-withdraw when paused? |
| **SAC freeze** | SAC admin freezes user balances for the protocol's token. | HIGH if no unfreeze path independent of admin |
| **Admin-only withdrawal** | Admin can drain contract token accounts. | CRITICAL if single keypair |
| **TTL expiry as implicit pause** | Contract Instance TTL expires; all `instance().get()` calls panic. Protocol effectively pauses if not extended. | MEDIUM — check: who can call `extend_ttl()` and under what conditions? |

**Check**:
- [ ] Can pausing strand user funds permanently? (Rule 9 — stranded asset severity floor: minimum MEDIUM)
- [ ] Is there a maximum pause duration enforced on-chain?
- [ ] Can users exit during pause (emergency withdraw function)?
- [ ] If Instance storage TTL expires: does the contract degrade gracefully or panic?
- [ ] If no exit during pause → apply Rule 9

---

## Step 6: Authority Revocation Assessment

For each authority type, assess revocation status and path:

| Authority | Current State | Revocation Path | Should Be Revoked? | Risk If Not Revoked |
|-----------|--------------|-----------------|-------------------|-------------------|
| Upgrade authority | {active/none — function present?} | Remove `update_current_contract_wasm` call or gate to `Address::zero()` | {assessment} | {risk level} |
| Admin (FUND_CONTROL) | {active} | Two-step transfer to burn address or DAO | {assessment} | {risk level} |
| SAC admin/freeze | {active/none} | Stellar issuer account deauthorization | {assessment} | {risk level} |
| Operator/keeper | {active} | Setter function to zero/None | {assessment} | {risk level} |

**Rule 13 check**: Is the authority retention documented? If the protocol claims to be "decentralized" or "trustless" but retains upgrade or fund-control authority, apply the 5-question test:
1. Who is harmed by this authority retention?
2. Can affected users avoid the harm?
3. Is the authority retention documented in protocol docs?
4. Could the protocol achieve the same goal without this authority?
5. Does the protocol fulfill its stated trustlessness completely?

---

## Output Schema

```markdown
## Finding [CR-N]: Title

**Verdict**: CONFIRMED / PARTIAL / REFUTED
**Step Execution**: check1,2,3,4,5,6 | skip(reason) | uncertain
**Severity**: Critical/High/Medium/Low/Info
**Location**: contract name or function name

**Centralization Type**: FUND_CONTROL / PARAMETER_CONTROL / OPERATIONAL_CONTROL / UPGRADE_CONTROL / MINT_CONTROL
**Affected Role**: {authority_name} (Address type: keypair / multisig / contract)
**Mitigation Present**: {Stellar multisig / DAO contract / timelock / Immutable / NONE}

**Description**: What is wrong
**Impact**: What can happen if authority is compromised or acts maliciously
**Recommendation**: How to mitigate (add timelock, remove upgrade function, use multisig, separate roles)
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Privilege Inventory (all functions with require_auth) | YES | | |
| 2. Role Hierarchy and Separation | YES | | |
| 3. Single Points of Failure (per role) | YES | | |
| 4. External Governance Dependencies | YES | | |
| 5. Emergency Powers and Recovery Paths | YES | | |
| 6. Authority Revocation Assessment | YES | | |

### Cross-Reference Markers

**After Step 1**: Cross-reference with auth validation — is `require_auth()` called on the stored admin, or on the transaction signer directly (bypassing stored admin check)?

**After Step 2**: If upgrade authority is a single keypair → immediate finding (minimum HIGH).

**After Step 3**: If admin `Address` is itself a contract, trace that contract's upgrade path — severity inherits.

**After Step 5**: If no emergency withdraw exists AND pause is possible → Rule 9 stranded asset finding.

**After Step 6**: If protocol claims trustlessness but retains mutable authorities → Rule 13 anti-normalization finding.
