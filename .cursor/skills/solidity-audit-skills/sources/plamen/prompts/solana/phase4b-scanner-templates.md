# Phase 4b: Scanner & Sweep Templates - Solana

> **Usage**: Orchestrator reads this file to spawn the 3 Blind Spot Scanners, Validation Sweep Agent, and Design Stress Testing Agent for Solana programs.
> Replace placeholders `{SCRATCHPAD}`, etc. with actual values.

---

## Processing Protocol (ALL Scanner & Sweep Agents)

Every agent spawned from this file MUST follow this protocol for each CHECK/step in their section:
1. **ENUMERATE targets**: List every entity the CHECK applies to as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

---

## Blind Spot Scanner A: Tokens & Parameters (Solana)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner A for a Solana program audit. Find what breadth agents NEVER LOOKED AT for tokens, accounts, and parameters.

## Your Inputs
Read:
- {SCRATCHPAD}/attack_surface.md (Account Inventory Matrix)
- {SCRATCHPAD}/findings_inventory.md (what WAS analyzed)
- {SCRATCHPAD}/constraint_variables.md (admin-changeable parameters)

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (accounts, tokens, parameters, call sites) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 1: Account & Token Coverage
Cross-reference attack_surface.md Account Inventory Matrix against findings_inventory.md:

For each account type (token accounts, PDAs, system accounts):
| Account/Token | Analyzed by Agent? | Finding IDs | Validation Dimensions Covered | Missing Dimensions |
|--------------|-------------------|-------------|-------------------------------|-------------------|

If ANY token account has 0 findings AND can receive unsolicited transfers â†’ BLIND SPOT.
If ANY account uses UncheckedAccount/AccountInfo AND has 0 validation findings â†’ BLIND SPOT.
If ANY token account has findings covering â‰¤2 of 5 R11 dimensions AND uncovered dimensions are applicable â†’ PARTIAL BLIND SPOT.

**Dimension coverage gate**: For each token with â‰¥1 finding, verify coverage breadth:

| External Token | R11-D1: Transferability | R11-D2: Accounting | R11-D3: Op Blocking | R11-D4: Loop/Gas | R11-D5: Side Effects | Dimensions Covered |
|----------------|------------------------|--------------------:|--------------------:|-----------------|---------------------|-------------------|

If ANY token has findings covering â‰¤2 of 5 dimensions AND the uncovered dimensions are applicable â†’ PARTIAL BLIND SPOT.
Applicable = the token type supports that interaction (e.g., NFTs don't have D4:Loop/Gas unless enumerable).

**Token-2022 specific**: For each mint - was Token-2022 extension possibility checked?
| Mint | Token-2022 Possible? | Extensions Checked? | Transfer Fee Impact? | Transfer Hook Impact? |

## CHECK 2: Governance-Changeable Parameter Coverage
For each parameter with an admin setter instruction in constraint_variables.md:

| Parameter | Setter Instruction | Increase Direction Analyzed? | Decrease Direction Analyzed? | Impact per Direction |
|-----------|-------------------|------------------------------|------------------------------|--------------------|

If EITHER direction is unanalyzed â†’ create analysis.
Apply Rule 13: Model who is harmed in each direction. An admin decreasing a threshold may harm users differently than increasing it.

**Apply Rule 14**: For each parameter:
- Does its setter enforce bounds? (min/max checks before writing to account data)
- Can the new value be set below accumulated state? (setter regression)
- Is there a related parameter that must maintain coherence? (constraint coherence)
- **Silent misconfiguration**: If the setter has NO bounds check, trace downstream math with an accepted-but-extreme value. Does the instruction revert, or does it silently produce wrong results? A setter that accepts any value AND downstream math silently breaks for part of the accepted range is a finding " even without an attacker.

## CHECK 2e: Approval/Delegate Sequence Conflicts (IF approve/delegate patterns detected in scope)
Skip this check if no `approve`, `delegate`, or `authorized_amount` patterns are detected in the scoped programs. If `{SCRATCHPAD}/niche_multi_step_safety_findings.md` exists and is non-empty, limit this to listing affected functions in a table [Function | Pattern | Note] " do NOT trace execution, compute impacts, or construct exploitation scenarios. The niche agent handles deep analysis.
For each multi-instruction transaction (composed CPIs, batch operations), enumerate all approve/delegate/authorize calls. If the same (delegate, token_account) pair is authorized more than once, verify amounts are additive or the second accounts for the first. Sequential overwrites â†’ FINDING.

## CHECK 2f: Infrastructure Address Targeting (IF on-behalf-of patterns detected in scope)
Skip this check if no `deposit_for`, `stake_for`, `delegate_to`, or similar on-behalf-of instruction patterns are detected. If `{SCRATCHPAD}/niche_multi_step_safety_findings.md` exists and is non-empty, limit this to listing affected functions in a table [Function | Target Param | Note] " do NOT trace execution or compute impacts.
For each public instruction that writes state keyed by an address/pubkey parameter (e.g., deposit_for(target), stake_for(target), delegate_to(target)): can any protocol PDA or singleton account be used as the target? If yes, what state is imposed on it, and does it break protocol operations? â†’ FINDING.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-A1] through [BLIND-A5]
- Use standard finding format with Solana rules (R1-R16, S1-S10)
- Note WHY breadth agents likely missed each

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_a_findings.md

Return: 'DONE: {N} blind spots - Check1: {A} account/token gaps, Check2: {B} parameter gaps'
")
```

---

## Blind Spot Scanner B: Access Control, PDA Security & Remaining Accounts (Solana)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner B for a Solana program audit. Find what breadth agents NEVER LOOKED AT for access control, PDA security, and remaining_accounts.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md (instruction inventory)
- {SCRATCHPAD}/state_variables.md (account structures)
- Source files for all in-scope programs

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (guards, modifiers, overrides, functions) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 3: Access Control Gaps
For each instruction handler with signer checks:

| Instruction | Signer Required | Preconditions | User-Manipulable? | Analyzed? | Finding ID |
|------------|-----------------|---------------|-------------------|-----------|------------|

If precondition is user-manipulable AND no finding covers it â†’ BLIND SPOT.
Also flag: instructions that emit events but have NO signer/authority check AND do NOT modify meaningful state - these allow anyone to forge events that mislead off-chain indexers and UIs.
Also flag: any admin/authority-gated instruction that modifies program state but does NOT emit an event (via emit! or msg!). Admin parameter changes without events are unmonitorable.

## CHECK 4: PDA Seed Collision Analysis (S2)
For each PDA derivation in the codebase:

| PDA | Seeds | Bump Source | Can Different Inputs Produce Same PDA? | Analyzed? |
|-----|-------|-------------|----------------------------------------|-----------|

Check: Can two different logical entities map to the same PDA address through seed manipulation?
Check: Is the canonical bump (find_program_address) always used, or can user supply bump?

## CHECK 5: Remaining Accounts Validation (S6)
For each use of `ctx.remaining_accounts` or `remaining_accounts`:

| Instruction | Remaining Accounts Usage | Owner Checked? | Type Checked? | Signer Checked? | Analyzed? |
|------------|-------------------------|---------------|---------------|-----------------|-----------|

remaining_accounts bypass Anchor's automatic validation - ALL manual checks must be present.

## CHECK 5b: Override Safety
For each trait implementation (e.g., custom `Transfer`, `Close`, event handlers):

| Base Trait | Method | Override | Base Checks | Override Checks | Dropped? |
|-----------|--------|---------|------------|-----------------|----------|

## CHECK 5c: ATA Creation Variant Audit
For each Associated Token Account creation in initialization paths:

| Instruction | ATA Creation Call | Variant | Idempotent? | Front-Runnable? |
|------------|-------------------|---------|-------------|-----------------|

Grep source for:
- `associated_token::create` - NOT idempotent, will fail if ATA already exists â†’ front-runnable
- `associated_token::create_idempotent` - safe, succeeds even if ATA exists
- `create_associated_token_account` - check which variant

If any initialization instruction uses non-idempotent ATA creation â†’ BLIND SPOT (front-running DoS).

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-B1] through [BLIND-B5]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_b_findings.md

Return: 'DONE: {N} blind spots - Check3: {A} access control gaps, Check4: {B} PDA gaps, Check5: {C} remaining_accounts gaps, Check5b: {D} override gaps, Check5c: {E} ATA creation gaps'
")
```

---

## Blind Spot Scanner C: Upgrade Authority, CPI Completeness & Reachability (Solana)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner C for a Solana program audit. Find what breadth agents NEVER LOOKED AT for upgrade authority lifecycle, CPI validation completeness, and instruction reachability.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md (instruction inventory)
- {SCRATCHPAD}/state_variables.md
- Source files for all in-scope programs

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (roles, capabilities, functions, call paths) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 6: Upgrade Authority Lifecycle
For the program's upgrade authority:

| Program | Upgrade Authority | Can Transfer? | Can Revoke? | Circular Dependency? | Finding? |
|---------|------------------|---------------|-------------|---------------------|----------|

- Is upgrade authority a single EOA? (centralization risk)
- Can upgrade authority be transferred to zero address (making immutable)?
- Is there a timelock on upgrades?

For each admin/authority role within the program:
| Role | Grant Mechanism | Revoke Mechanism | Revoke Exists? | Self-Removal Blocked? |

## CHECK 7: CPI Target Validation Completeness
For each CPI in the codebase:

| CPI Site | Target Program ID | Hardcoded? | Validated How? | Can Be Substituted? | Gap? |
|----------|------------------|-----------|---------------|---------------------|------|

- Is the target program_id hardcoded or user-supplied?
- If hardcoded: is it the correct production address?
- If user-supplied: is owner/program_id validated?
- Are ALL accounts passed to CPI properly validated before the call?

## CHECK 8: Instruction Reachability Audit
For each instruction handler:

| Instruction | Called By (composability) | Guard Conditions | Reachable in Production? | Dead Code? |
|------------|--------------------------|-----------------|-------------------------|------------|

- Are there instruction handlers that are never called in the expected user flow?
- Could dead instructions be called by anyone if discovered?
- Do dead instructions modify critical state?

## CHECK 8b: Anchor Hidden IDL Instructions (IF Anchor program)
Skip if the program does not use Anchor (no `declare_id!` macro, no `#[program]` attribute).
Check Cargo.toml: if the `idl-build` feature is present OR `no-idl` is absent (IDL feature is ON by default):

| Check | Status | Finding? |
|-------|--------|----------|
| IDL feature enabled in Cargo.toml? | YES/NO | If YES: 7 hidden permissionless instructions exist on-chain (IdlCreateAccount, IdlCreateBuffer, etc.) " note for developers |
| `IdlCreateAccount` authority claimable by anyone? | YES (always, by design) | If program is deployed and IDL PDA unclaimed: LOW " attacker can claim IDL authority, upload fake IDL to explorers, block legitimate IDL upload |
| `IdlCreateBuffer` available as cosplay primitive? | YES (if IDL enabled) | Cross-reference with Section 3 of account-validation: any discriminator bypass finding is amplified (see account-validation skill) |

If IDL feature enabled â†’ recommend developers either: (a) disable IDL feature (`no-idl` in Cargo.toml), (b) claim IDL PDA immediately after deployment, or (c) upgrade to Anchor >= v0.31.0 which restricts `IdlCreateAccount` to program authority.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 9 findings [BLIND-C1] through [BLIND-C9]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_c_findings.md

Return: 'DONE: {N} blind spots - Check6: {A} authority lifecycle gaps, Check7: {B} CPI validation gaps, Check8: {C} reachability gaps, Check8b: {D} IDL instruction gaps'
")
```

---

## Validation Sweep Agent - Solana

```
Task(subagent_type="general-purpose", prompt="
You are the Validation Sweep Agent for a Solana program audit. You perform mechanical checks across every instruction in scope.

## INPUT FILTERING
When cross-referencing against findings_inventory.md, focus on Medium+ severity findings only. Low/Info findings do not need cross-validation sweeps - the attention cost of processing 50+ findings outweighs the marginal value of sweeping Low/Info patterns.

## Your Inputs
Read:
- {SCRATCHPAD}/function_list.md (instruction inventory)
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)
- {SCRATCHPAD}/state_variables.md
- Source files for all in-scope programs

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (validations, operators, guards, functions) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 1: Boundary Operator Precision
For every comparison operator in validation logic (`>`, `<`, `>=`, `<=`, `==`, `!=`):

| Location | Expression | Operator | Boundary Value | Behavior AT Boundary | Off-by-One? |
|----------|-----------|----------|---------------|---------------------|-------------|

Test: what happens when the value equals the boundary exactly?
Solana-specific: check `checked_add/sub/mul` vs unchecked arithmetic, `as` casts at boundaries.
Also check: for each `while`/`for` loop with accumulator variables, verify ALL accumulators are updated per iteration. A loop that increments one counter but not a co-dependent tracking variable produces double-counting on subsequent iterations.

## CHECK 2: Validation Reachability
Trace ALL instruction handler paths for validation bypass:
- Can a multi-instruction transaction skip a validation that a single instruction enforces?
- Do internal functions assume a validation was applied by the caller instruction?
- Can instruction ordering bypass time-based checks?

## CHECK 3: Guard Coverage Completeness
For every access control check applied to at least one instruction:

| Guard | Applied To | NOT Applied To (same state writes) | Missing? |
|-------|-----------|--------------------------------------|----------|

Check: if `instruction_a` requires `authority` signer and writes `pool.total`, does `instruction_b` also require authority when writing `pool.total`?

## CHECK 4: Cross-Instruction Action Parity
For each user action (deposit, withdraw, stake, unstake, claim):

| Action | Instruction A | Protection | Instruction B | Same Protection? | Gap? |
|--------|-------------|------------|--------------|-----------------|------|

Check: same economic action across different instructions should have equivalent protections.

## CHECK 5: CPI Parameter Validation
For every CPI that passes user-supplied or instruction-supplied parameters:

| Instruction | CPI Target | Parameter Source | Validated? | What's Unvalidated? |
|------------|-----------|-----------------|-----------|-------------------|

Trace parameters backward to source. Flag any user-controlled parameter passed to CPI without validation.

**Account meta enumeration**: For every CPI, list ALL AccountMeta entries:
| CPI | Account | Source | is_signer | is_writable | Validated? | Impact if Attacker-Controlled |

## CHECK 6: Helper Function Call-Site Parity

For EVERY internal helper that transforms values (normalization, scaling, encoding, formatting):

| Helper Function | Purpose | Call Sites | Consistent Usage? | Missing/Inconsistent Site |
|----------------|---------|-----------|-------------------|--------------------------|

**Methodology**:
- Grep for ALL call sites of each helper (normalize, denormalize, scale, unscale, to_lamports, from_lamports, to_shares, to_assets, or any protocol-specific transform pair)
- For each PAIR of inverse helpers (normalize/denormalize, encode/decode): verify every value that passes through one also passes through its inverse at the appropriate point
- For each call site: does it apply the helper to the same variable type with the same parameters as other call sites?
- Flag: a value that is normalized at entry but not denormalized at exit (or vice versa)
- Flag: a helper called with different parameters at different sites when the same parameters are expected
- For paired operations that share state (create/consume, deposit/refund, lock/unlock, open/close): if either operation transforms an input before use, verify the paired operation applies the same transformation at the same logical point - not later, not earlier, not skipped

**Concrete test**: If `normalize_amount(amount, decimals)` is called at 3 deposit sites but `denormalize_amount(amount, decimals)` is called at only 2 of 3 corresponding withdrawal sites, the missing site produces values at the wrong scale.

## CHECK 7: Write Completeness for Accumulators (uses pre-computed invariants)

Read `{SCRATCHPAD}/semantic_invariants.md` (pre-computed by Phase 4a.5 agent). For each variable with POTENTIAL GAP flagged:

| Variable | Flagged Gap | Confirmed? | Finding? |
|----------|-----------|-----------|----------|

Verify each flagged gap: does the value-changing instruction/CPI actually modify the tracked value without updating the variable? Filter false positives (e.g., view-only reads, instructions that indirectly trigger an update). Confirmed gaps â†’ FINDING.

## CHECK 8: Conditional Branch State Completeness

For EVERY state-modifying instruction that contains an if/else, match arms, or early return:

| Function | Branch Condition | State Written in TRUE Branch | State Written in FALSE Branch | Asymmetry? |
|----------|-----------------|-----------------------------|-----------------------------|------------|

**Methodology**:
- For each conditional branch in a state-modifying instruction, enumerate ALL state writes in the TRUE path
- Enumerate ALL state writes in the FALSE path (including the implicit "nothing happens" path for early returns)
- If a state variable is written in one branch but NOT the other, and both branches represent valid execution paths (not error/revert) â†’ flag as potential stale state
- Special focus: instructions where fee accrual, timestamp updates, or checkpoint writes are inside a conditional block but downstream consumers assume they always executed
- Special focus: instructions where a "pause" or "skip" branch updates timestamps/counters but NOT accumulators, or vice versa

**Concrete test**: If `instruction_a` writes `last_update = now` inside an `if amount > 0` block, what value does `last_update` retain when `amount == 0`? Trace all consumers of `last_update` - do they produce correct results with the stale value?

Tag: [TRACE:branch=false â†’ stateVar={old_value} â†’ consumer computes {wrong_result}]

## CHECK 9: Validation Semantic Adequacy

For EVERY validation that protects against value loss (slippage checks, balance thresholds, minimum output assertions):

| Validation | What It Measures | What It Should Measure | Match? |
|-----------|-----------------|----------------------|--------|

**Classification** " for each validation, determine:
- Does it check ABSOLUTE state (total balance) or RELATIVE change (delta per operation)?
- Does it check AGGREGATE result (batch total) or PER-ITEM result (individual operation)?
- Does it check a PROXY metric (correlated value) or the DIRECT metric (actual value at risk)?

If the validation uses absolute/aggregate/proxy AND the protected operation is per-item or requires delta measurement â†’ FINDING: validation measures the wrong granularity. A batch of operations where each individually loses value but the aggregate stays flat (cross-subsidized by profitable operations or prior balance) passes an aggregate check but fails a per-item check.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## SELF-CONSISTENCY CHECK (MANDATORY before output)

For each finding you produce: if your own analysis identifies that the missing pattern/modifier/guard is FUNCTIONALLY REQUIRED to be absent (e.g., adding it would cause reverts, break composability, or make the function unreachable), your verdict MUST be REFUTED, not CONFIRMED with caveats. A finding that says "X is missing" and also explains "adding X would break Y" is self-contradictory - resolve the contradiction before outputting.

## Output
Write to {SCRATCHPAD}/validation_sweep_findings.md:

### Sweep Summary
| Check | Instructions Scanned | Findings | False Positives Filtered |

### Findings
Use finding IDs [VS-1], [VS-2], etc. Maximum 12 findings.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} instructions swept, {M} boundary issues, {K} reachability gaps, {J} guard gaps, {P} parity gaps, {Q} CPI parameter gaps, {R} helper parity gaps, {S} conditional branch gaps'
")
```

---

## Sibling Propagation Agent

> **Trigger**: Always runs IN PARALLEL with Validation Sweep (iteration 1 only).
> **Purpose**: Propagate confirmed root cause patterns to sibling functions. Extracted from Validation Sweep to avoid positional attention degradation (was CHECK 9 of 9 " highest cognitive load in worst attention position).
> **Budget**: Scanner-tier (part of fixed base count, not depth budget).

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Sibling Propagation Agent. For each Medium+ CONFIRMED or PARTIAL finding, you search the entire codebase for sibling functions exhibiting the SAME root cause pattern.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md (all findings with verdicts)
- Source files for all in-scope programs

## Methodology

For each Medium+ CONFIRMED or PARTIAL finding in findings_inventory.md:

1. Extract the ROOT CAUSE PATTERN in one sentence (e.g., 'state variable updated inside conditional block that can be skipped', 'paired operation asymmetry between deposit/withdraw paths')
2. Grep ALL other instructions in scope for the SAME pattern (same account types, same code structure, same operation sequence)
3. For each sibling instruction found: does it exhibit the SAME bug?
4. If YES and no existing finding covers it â†’ new finding [SP-N]

| Finding | Root Cause Pattern | Sibling Instructions | Same Bug? | New Finding? |
|---------|-------------------|---------------------|-----------|-------------|

## Output
Write to {SCRATCHPAD}/sibling_propagation_findings.md
Use finding IDs [SP-1], [SP-2], etc. with standard finding format.
Maximum 8 findings " prioritize by severity.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |
|------------|----------|--------------------:|---------|----------|-------------------|-------------------|

Return: 'DONE: {N} root cause patterns extracted, {M} sibling instructions found, {K} new findings'
")
```

---

## Design Stress Testing Agent - Solana (Budget Redirect)

```
Task(subagent_type="general-purpose", prompt="
You are the Design Stress Testing Agent for a Solana program audit.

## Your Inputs
Read:
- {SCRATCHPAD}/constraint_variables.md
- {SCRATCHPAD}/function_list.md
- {SCRATCHPAD}/attack_surface.md
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)

## CHECK 1: Design Limit Stress (CU Focus)
For each bounded parameter (max accounts, max iterations, max users):

| Parameter | Design Limit | CU at Limit | 200k CU Limit OK? | 1.4M Tx Limit OK? | Admin Usable at Limit? |
|-----------|-------------|-------------|-------------------|-------------------|----------------------|

Tag: [BOUNDARY:param=MAX_VALUE â†’ CU cost]

## CHECK 2: Rule 13 Design Adequacy
For each user-facing instruction, verify it fulfills its stated purpose completely:

| Instruction | Stated Purpose | Fulfills Completely? | User States Without Exit? | Gap Description |
|------------|---------------|---------------------|--------------------------|-----------------|

## CHECK 3: Constraint Coherence (Rule 14)
For each pair of independently-settable limits:

| Limit A | Limit B | Relationship Required? | Enforced On-Chain? | What Breaks if Desync? |
|---------|---------|----------------------:|-------------------|----------------------|

Tag: [TRACE:limitA=X, limitB=Y â†’ outcome]

## CHECK 4: Yield/Reward Timing Fairness
For each yield distribution, reward streaming, or vesting mechanism:

| Mechanism | Distribution Event | Entry Window | Sandwich Possible? | Fairness Gap? |
|-----------|-------------------|-------------|-------------------|--------------|

1. Can a user deposit IMMEDIATELY BEFORE a yield/reward distribution and capture a disproportionate share?
2. Is there a cooldown, lock period, or time-weighted balance that prevents sandwich timing attacks?
3. For streaming/vesting: can a user enter AFTER streaming starts but before it ends and capture already-vested gains at the current (inflated) share price?
4. For multi-step distributions (vest â†’ claim â†’ transfer): can timing between steps be exploited?
5. Trace: if user deposits at T, distribution occurs at T+1 block, user withdraws at T+2 - what is the user's profit vs a user who was deposited for the full period? If disproportionate â†’ FINDING

Tag: [TRACE:deposit_at=T, distribution_at=T+1, withdraw_at=T+2 â†’ profit={X} vs long_term_user={Y} â†’ fairness_ratio={Z}]

## Output
Write to {SCRATCHPAD}/design_stress_findings.md:
- Maximum 8 findings [DST-1] through [DST-8]

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} design stress findings'
")
```

