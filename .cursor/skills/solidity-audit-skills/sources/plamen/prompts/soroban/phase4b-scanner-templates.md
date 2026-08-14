# Phase 4b: Scanner & Sweep Templates - Soroban

> **Usage**: Orchestrator reads this file to spawn the 3 Blind Spot Scanners, Validation Sweep Agent, and Design Stress Testing Agent for Soroban contracts.
> Replace placeholders `{SCRATCHPAD}`, etc. with actual values.

---

## Processing Protocol (ALL Scanner & Sweep Agents)

Every agent spawned from this file MUST follow this protocol for each CHECK/step in their section:
1. **ENUMERATE targets**: List every entity the CHECK applies to as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

---

## Blind Spot Scanner A: Tokens & Parameters (Soroban)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner A for a Soroban contract audit. Find what breadth agents NEVER LOOKED AT for tokens, parameters, and storage classification.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_a_findings.md` with a one-line header `# Blind Spot Scanner A " Tokens & Parameters`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/attack_surface.md (Token/Asset Inventory Matrix)
- {SCRATCHPAD}/findings_inventory.md (what WAS analyzed)
- {SCRATCHPAD}/constraint_variables.md (admin-changeable parameters)
- {SCRATCHPAD}/state_variables.md (storage entries and their types)

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (tokens, assets, parameters, storage keys) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 1: SEP-41 Token Coverage
Cross-reference attack_surface.md Token/Asset Inventory Matrix against findings_inventory.md:

For each token interface (SEP-41 tokens, Stellar Asset Contracts, custom fungible tokens):
| Token/Asset | Analyzed by Agent? | Finding IDs | Validation Dimensions Covered | Missing Dimensions |
|-------------|-------------------|-------------|-------------------------------|-------------------|

If ANY token has 0 findings AND can receive unsolicited transfers (transfer_from with no check) â†’ BLIND SPOT.
If ANY token interaction skips balance reconciliation before and after â†’ BLIND SPOT.

**Dimension coverage gate**: For each token with â‰¥1 finding, verify coverage breadth:

| Token | R11-D1: Transferability | R11-D2: Accounting | R11-D3: Op Blocking | R11-D4: Loop/Ledger cost | R11-D5: Side Effects | Dimensions Covered |
|-------|------------------------|--------------------|--------------------|--------------------------|----------------------|--------------------|

If ANY token has findings covering â‰¤2 of 5 dimensions AND uncovered dimensions are applicable â†’ PARTIAL BLIND SPOT.

**SAC (Stellar Asset Contract) specific**: For each SAC interaction:
| SAC Address | Admin Call Possible? | Clawback Enabled? | Authorize/Deauthorize Checked? | Impact of Deauthorization on Protocol? |
|-------------|---------------------|-------------------|-------------------------------|----------------------------------------|

- Clawback-enabled SAC: if the SAC issuer claws back tokens held by the contract, does the contract's internal accounting reflect the balance change? â†’ BLIND SPOT if not covered.
- Deauthorization: if the SAC issuer deauthorizes the contract's trustline, transfers revert. Does the contract handle this gracefully or does it permanently lock funds?

**Approve race condition**: For each `approve` call on a SEP-41 token:
| Call Site | Current Allowance Assumed Zero? | Race-Condition-Safe (set to 0 first)? | Allowance Storage Type | Expiry Ledger Checked? |
|-----------|--------------------------------|--------------------------------------|------------------------|------------------------|

Temporary storage allowances expire silently " callers assuming a non-zero allowance after ledger gap â†’ BLIND SPOT.

## CHECK 2: Governance-Changeable Parameter Coverage
For each parameter with an admin setter function in constraint_variables.md:

| Parameter | Setter Function | require_auth Called? | Increase Direction Analyzed? | Decrease Direction Analyzed? | Impact per Direction |
|-----------|----------------|---------------------|------------------------------|------------------------------|--------------------|

If EITHER direction is unanalyzed â†’ create analysis.
Apply Rule 13: Model who is harmed in each direction. An admin decreasing a fee floor may harm the protocol differently than increasing it.

**Apply Rule 14**: For each parameter:
- Does its setter enforce bounds? (min/max checks before writing to storage)
- Can the new value be set below accumulated state? (setter regression " e.g., max_supply set below total_supply)
- Is there a related parameter that must maintain coherence? (constraint coherence)
- **Silent misconfiguration**: If the setter has NO bounds check, trace downstream math with an accepted-but-extreme value. Does the function panic or silently produce wrong results? A setter that accepts any value AND downstream math silently breaks for part of the accepted range is a finding " even without an attacker.

**Retroactive effects**: For each parameter that affects in-flight operations (pending withdrawals, active positions, locked balances):
- If the parameter changes between the start and end of a user action sequence, does the user face unexpected outcomes? â†’ FINDING if retroactive change is possible and harmful.

## CHECK 3: Storage Type Classification Audit
For each piece of state stored in the contract:

| Storage Key | Current Type (Instance/Persistent/Temporary) | Correct Type? | Data Criticality | TTL Risk |
|-------------|---------------------------------------------|--------------|-----------------|---------|

Classification rules:
- **Instance storage**: Lives as long as the contract instance. Correct for: contract config, owner, global parameters. WRONG for: per-user balances, timelocks, escrow amounts (all users share the same TTL " if anyone extends instance TTL, all live; if no one does, all expire together).
- **Persistent storage**: Has its own TTL per key. Correct for: per-user balances, per-position state, timelocks, long-lived records. WRONG for: high-churn temporary data that inflates ledger state.
- **Temporary storage**: Exists only for the current ledger (or until TTL expires, typically 1 ledger). Correct for: re-entrancy locks, flash-loan flags, session nonces. WRONG for: timelocks, escrow amounts, voting state, any data that must survive across transactions.

If ANY critical state (user balances, timelocks, escrow, voting) uses Temporary storage â†’ HIGH/CRITICAL BLIND SPOT (permanent silent data loss on TTL expiry).
If ANY per-user balance uses Instance storage â†’ MEDIUM BLIND SPOT (premature global expiry if no one triggers extension).

## CHECK 4: TTL Management Coverage
For each Persistent or Instance storage entry:

| Storage Entry | extend_ttl Called? | Where Called? | threshold Value | extend_to Value | Sufficient Margin? |
|--------------|-------------------|---------------|----------------|----------------|-------------------|
| | | | | | |

- Is `extend_ttl` called for critical Persistent storage entries proactively (e.g., on every write or read)?
- If `extend_ttl` is missing for critical state: what happens when the ledger entry expires? Does the contract silently treat the missing entry as default (zero balance, no lock)? â†’ BLIND SPOT.
- Are `threshold` and `extend_to` values reasonable relative to the protocol's expected operation window? Too-low values mean frequent expiry; too-high values inflate ledger fees.
- **User-triggered TTL renewal**: Must users call a dedicated function to renew their own storage? If yes, what happens if they forget? If their balance entry expires, can they re-initialize and claim a fresh state?
- **Instance TTL dependency**: If the contract's Instance storage expires (contract_instance().extend_ttl not called), ALL contract execution halts. Verify a heartbeat or keeper mechanism exists.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-A1] through [BLIND-A5]
- Use standard finding format with Soroban security rules
- Note WHY breadth agents likely missed each

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_a_findings.md

Return: 'DONE: {N} blind spots - Check1: {A} token/SAC gaps, Check2: {B} parameter gaps, Check3: {C} storage type gaps, Check4: {D} TTL management gaps'
")
```

---

## Blind Spot Scanner B: Access Control, Cross-Contract Calls & Upgrade Safety (Soroban)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner B for a Soroban contract audit. Find what breadth agents NEVER LOOKED AT for access control completeness, cross-contract call safety, upgrade protection, and Instance storage bounds.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_b_findings.md` with a one-line header `# Blind Spot Scanner B " Access Control & Upgrade Safety`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md (function inventory)
- {SCRATCHPAD}/state_variables.md (storage entries)
- {SCRATCHPAD}/attack_surface.md
- Source files for all in-scope contracts

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (functions, call sites, roles, storage entries) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 5: require_auth Coverage Matrix
For each state-modifying function in the contract:

| Function | Modifies State? | require_auth Called? | Whose Auth? | User-Manipulable Precondition? | Analyzed? | Finding ID |
|----------|----------------|---------------------|------------|-------------------------------|-----------|------------|

Rules:
- Every function that writes to storage or transfers tokens MUST call `require_auth` for the relevant address.
- `require_auth` must be called for the AFFECTED address " not merely the caller. If `transfer(from, to, amount)` only checks `env.invoker()` rather than `from.require_auth()`, any approved invoker can drain arbitrary `from` accounts.
- `require_auth_for_args` vs `require_auth`: verify the correct variant is used. `require_auth_for_args` scopes authorization to specific arguments; `require_auth` authorizes any call. If a function should scope authorization to specific amounts or assets, bare `require_auth` is insufficient.
- Admin-only functions: verify the admin identity is loaded from storage (not from a function argument) before calling `require_auth`.
- Also flag: functions that emit events but perform NO state write AND have no auth check " these allow anyone to forge events that mislead off-chain indexers and frontends.
- Also flag: admin setter functions that modify protocol parameters but do NOT emit an event. Admin parameter changes without events are unmonitorable.

## CHECK 6: Cross-Contract Call Safety
For each cross-contract invocation (`invoke_contract` or `try_invoke_contract`):

| Call Site | Target Contract | Uses try_invoke_contract? | Error Handled? | Partial State Written Before Call? | Re-entrancy Guard? | Stale contractimport? |
|-----------|----------------|--------------------------|---------------|-----------------------------------|--------------------|----------------------|

Rules:
- `invoke_contract` panics on failure " if any state was written BEFORE the call, the panic reverts the entire transaction (Soroban's atomic model). Verify this is the intended behavior. If partial commits are possible, it is a BLIND SPOT.
- `try_invoke_contract` returns a `Result` " verify the error is properly handled and does NOT leave the contract in an inconsistent state (e.g., tokens deducted but cross-contract credit not applied).
- **Stale contractimport**: If the contract was compiled against an older version of an imported contract's interface (using `contractimport!`), function signatures may have changed. Verify the imported WASM hash matches the currently deployed contract.
- **Re-entrancy via cross-contract**: Soroban does not have EVM-style re-entrancy, but a cross-contract call CAN call back into the original contract within the same transaction. Verify state is fully settled before any outbound call that could trigger a callback.
- **Auth forwarding**: Does the cross-contract call need `require_auth` from the user? Verify the auth context is forwarded correctly; missing auth forwarding causes silent permission escalation.
- **Originate-side nested-pull auth**: When THIS contract invokes an intermediary/vault that then pulls tokens/assets one frame deeper via a nested `transfer(from = this_contract, ...)` (e.g. a `deposit(assets, this, this, this)` where operator == from == this_contract), the direct-caller auto-authorization does NOT cover that nested sub-invocation. The calling function MUST pre-declare the nested frame with `env.authorize_as_current_contract(...)` (aka `authorize_pull`) BEFORE the call. A plain SEP-41 `.approve()` is NOT sufficient: `approve` writes an allowance that only `transfer_from` reads, whereas a `transfer` never consults allowances — so the pull reverts under enforcing auth despite the approval. Fill this row for every function that invokes an intermediary which nests a pull-from-self:

| Call Site | Intermediary | Nested `transfer(from=self)`? | `authorize_as_current_contract`/`authorize_pull` pre-declared? | Relies only on `.approve()`? | Reverts under enforcing auth? |
|-----------|-------------|-------------------------------|----------------------------------------------------------------|------------------------------|-------------------------------|

- **Originate-side DIFFERENTIAL**: Compare EVERY sibling call site that performs the same nested-pull pattern. If one sibling pre-declares (`authorize_as_current_contract`/`authorize_pull`) and another only calls `.approve()` (or declares nothing), the sibling missing the pre-declaration reverts under enforcing auth in production — flag it as a finding, EVEN IF the consumer-side user `require_auth` is present. Divergent auth-handling across siblings that share the nested-pull pattern is the tell.
- **Test-harness masking trap**: `env.mock_all_auths_allowing_non_root_auth()` fabricates the missing sub-authorization, so a passing test suite does NOT prove the originate-side auth is present. Plain `mock_all_auths()` (root-only) would reject the un-declared nested pull. If tests pass only under the non-root-allowing variant, treat the originate-side auth as UNPROVEN and audit it from source, not from test outcomes.

## CHECK 7: Contract Upgrade Protection
For each contract with upgrade capability (`update_current_contract_wasm`):

| Contract | Upgrade Function | require_auth Called? | Auth Actor | Migration Logic Present? | Data Layout Compatible? | Timelock? |
|----------|-----------------|---------------------|-----------|--------------------------|------------------------|-----------|

Rules:
- `update_current_contract_wasm` replaces the contract's WASM bytecode. If not guarded by `require_auth`, anyone can upgrade the contract.
- Post-upgrade: verify the new WASM's storage layout is compatible with existing data. A storage key that was `DataKey::Balance(Address)` in v1 and `DataKey::UserBalance(Address)` in v2 will silently read zero after upgrade.
- Migration function: if the upgrade changes storage structure, a migration function must be called to transform existing data. Verify the migration is atomic with the upgrade or that there is no window where the new code reads old (now-misinterpreted) data.
- Timelock: is there a delay between announcing an upgrade and applying it? Without a timelock, a compromised admin can upgrade to malicious code without user recourse.
- **Constructor re-initialization**: After `update_current_contract_wasm`, can the `initialize` (or equivalent) function be called again? If so, can an attacker reset admin/config to attacker-controlled values?
- **Constructor NON-execution after upgrade (CAP-0058)**: When a contract's code is updated, the `__constructor` is NOT called. If the new WASM expects state initialized by `__constructor` that the old WASM did not have, the new code reads uninitialized storage (`None` / zero). Trace all state variables consumed by the new code " if any are only set in `__constructor` or a new `initialize` function, verify the deployment/migration process explicitly calls the initialization. Uninitialized state can silently break invariants or bypass checks.

## CHECK 8: Instance Storage Bounds
For each use of Vec or Map stored in Instance storage:

| Storage Key | Type (Vec/Map) | Max Entries Bounded? | Growth Mechanism | DoS via ResourceLimitExceeded? | Analyzed? |
|-------------|---------------|---------------------|-----------------|-------------------------------|-----------|

Rules:
- Instance storage is loaded in its entirety on every contract invocation. Unbounded Vecs or Maps in Instance storage grow indefinitely and eventually exceed Soroban's per-transaction resource limits (CPU instructions, memory, read bytes), causing all contract calls to fail with `ResourceLimitExceeded`.
- Identify: who can add entries to the Vec/Map? Is it permissionless? Can an attacker add entries at low cost?
- Calculate: at what approximate entry count does the resource limit become binding? Is that count reachable given the protocol's operation model?
- Also check: maps used for per-user state stored in Instance storage (should use Persistent storage with per-key TTL instead).

**Persistent storage single-entry growth**: Also check for Vec/Map stored as a SINGLE Persistent storage key that grows with user activity. Even though Persistent storage has no shared size limit, each individual ledger entry has a ~64KB size limit. A single `DataKey::AllUsers` containing a growing `Vec<Address>` will eventually hit this limit. The correct pattern is variable DataKeys (one Persistent entry per user/item), NOT a single entry holding all items.

| Persistent Key | Type (Vec/Map) | Grows With Users? | Entries Before ~64KB | Pattern |
|---------------|---------------|-------------------|---------------------|---------|

If ANY Persistent entry holds a growing collection with permissionless append â†’ flag as DoS risk (same severity as Instance storage DoS).

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-B1] through [BLIND-B5]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_b_findings.md

Return: 'DONE: {N} blind spots - Check5: {A} require_auth gaps, Check6: {B} cross-contract call gaps, Check7: {C} upgrade protection gaps, Check8: {D} instance storage bounds gaps'
")
```

---

## Blind Spot Scanner C: Overflow Safety, Panic Handling & Temporary Storage Misuse (Soroban)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner C for a Soroban contract audit. Find what breadth agents NEVER LOOKED AT for arithmetic safety, panic handling, and Temporary storage misuse for critical data.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_c_findings.md` with a one-line header `# Blind Spot Scanner C " Overflow & Panic Safety`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md
- {SCRATCHPAD}/state_variables.md
- Source files for all in-scope contracts (including Cargo.toml)

## Processing Protocol (MANDATORY " applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (arithmetic sites, unwrap sites, storage entries) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 9: Overflow Safety Verification
First, read Cargo.toml for the `overflow-checks` profile setting:

| Profile | overflow-checks | Status |
|---------|----------------|--------|
| release | true/false/missing | SAFE/UNSAFE/UNKNOWN |

If `overflow-checks = false` in the release profile (or the flag is absent, defaulting to false for release builds), ALL arithmetic in the contract runs without overflow protection â†’ systematic BLIND SPOT requiring per-expression audit.

For each arithmetic expression NOT protected by overflow-checks:

| Location | Expression | Types (i128/u128/u64/i32/etc.) | Overflow Possible? | Underflow Possible? | Boundary Input | Analyzed? |
|----------|-----------|-------------------------------|-------------------|--------------------|--------------|---------|

Special attention:
- **i128 boundary**: Soroban uses `i128` for amounts. `i128::MAX` = 170141183460469231731687303715884105727. Adding two large positive i128 values can overflow even though i128 is large.
- **u32/u64 to i128 cast**: Widening casts are safe. Narrowing casts (i128 â†’ u64) silently truncate if the value exceeds u64::MAX " verify with `u64::try_from` not `as u64`.
- **Division before multiplication**: Solidity-style precision loss applies in Rust too. `(a / b) * c` loses precision vs `(a * c) / b`. Identify all fee/share calculations for ordering issues.
- **checked_add / checked_mul / saturating_***: If overflow-checks are off, are the critical financial calculations using checked or saturating variants explicitly?

## CHECK 10: Panic vs Error Handling
For each use of `unwrap()`, `expect()`, and `panic!()` in the contract:

| Location | Pattern | Input Source | Can Input Be Attacker-Controlled? | Should Use panic_with_error!? | Analyzed? |
|----------|--------|-------------|----------------------------------|------------------------------|-----------|

Rules:
- `unwrap()` on a `None` or `Err` value panics with an opaque error " callers (including off-chain tools) cannot distinguish contract logic errors from resource-limit errors. Use `panic_with_error!(env, ContractError::XYZ)` instead.
- `expect("msg")` is equivalent to `unwrap()` for on-chain purposes " the message is only visible in test mode, not on-chain.
- Bare `panic!("msg")` is also opaque on-chain.
- **Attacker-controlled panics**: If an attacker can supply an input that triggers `unwrap()` on a `None` value (e.g., looking up a non-existent key from a user-supplied argument), they can DoS any transaction that depends on this contract call returning successfully.
- **Option::unwrap on storage reads**: `env.storage().persistent().get::<K, V>(&key).unwrap()` " if the key has expired (TTL) or was never set, this panics. Verify all storage reads use `get()` with a fallback or `has()` before `get().unwrap()`.
- **Authorized panics**: Identify `unwrap()` calls that are intentionally panic-on-invariant-violation (acceptable). Document why they are safe. Unintentional panics on user-supplied paths are findings.

## CHECK 11: Temporary Storage for Critical Data
For each piece of state stored using `env.storage().temporary()`:

| Storage Key | Data Criticality | Can Expire Mid-Operation? | What Happens on Expiry? | Finding? |
|-------------|-----------------|--------------------------|------------------------|---------|

Rules:
- **Timelocks in Temporary storage**: A timelock stored in Temporary storage expires after its TTL. If the lock entry disappears, the contract reads it as absent/zero " a user locked until ledger 500000 is suddenly unlocked if the Temporary entry expires at ledger 499000. â†’ CRITICAL finding.
- **Escrow amounts in Temporary storage**: If an escrow balance is stored in Temporary storage and expires, the contract may allow a user to re-initialize their escrow to zero and withdraw the underlying tokens, or it may silently lose track of the locked amount. â†’ CRITICAL finding.
- **Voting state in Temporary storage**: Votes cast in Temporary storage expire before tallying " silent vote disappearance without any on-chain signal. â†’ HIGH/CRITICAL finding.
- **Re-entrancy guards in Temporary storage**: This is CORRECT usage " a re-entrancy guard should be Temporary so it is cleared after the transaction.
- **Session nonces in Temporary storage**: Correct usage if nonces are single-transaction.
- **Allowances in Temporary storage** (SEP-41 `approve`): Allowance that expires mid-operation window causes `transfer_from` to fail silently if caller does not check for zero allowance. Document expiry ledger boundary.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 9 findings [BLIND-C1] through [BLIND-C9]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_c_findings.md

Return: 'DONE: {N} blind spots - Check9: {A} overflow/arithmetic gaps, Check10: {B} panic handling gaps, Check11: {C} temporary storage critical data gaps'
")
```

---

## Validation Sweep Agent - Soroban

```
Task(subagent_type="general-purpose", prompt="
You are the Validation Sweep Agent for a Soroban contract audit. You perform mechanical checks across every function in scope.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/validation_sweep_findings.md` with a one-line header `# Validation Sweep Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## INPUT FILTERING
When cross-referencing against findings_inventory.md, focus on Medium+ severity findings only. Low/Info findings do not need cross-validation sweeps " the attention cost of processing 50+ findings outweighs the marginal value of sweeping Low/Info patterns.

## Your Inputs
Read:
- {SCRATCHPAD}/function_list.md (function inventory)
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)
- {SCRATCHPAD}/state_variables.md
- Source files for all in-scope contracts

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
Soroban-specific: check `checked_add/sub/mul` vs unchecked arithmetic, i128/u64 narrowing casts at boundaries.
Also check: for each loop with accumulator variables, verify ALL accumulators are updated per iteration. A loop that increments one counter but not a co-dependent tracking variable produces double-counting on subsequent iterations.
Ledger number comparisons: `env.ledger().sequence()` returns a `u32`. Verify comparisons against stored ledger numbers use the same type and that wrapping (u32::MAX) is considered for long-lived contracts.

## CHECK 2: Validation Reachability
Trace ALL function paths for validation bypass:
- Can a sequence of function calls skip a validation that a single call enforces?
- Do internal helpers assume a validation was applied by the caller?
- Can ledger sequence ordering (current_ledger bypasses, timestamp-based checks) be manipulated?
- Do any `#[contractimpl]` trait implementations have different validation behavior than the primary impl block for the same logical function?

## CHECK 3: Guard Coverage Completeness
For every access control check applied to at least one function:

| Guard | Applied To | NOT Applied To (same state writes) | Missing? |
|-------|-----------|--------------------------------------|----------|

Check: if `function_a` requires admin `require_auth` and writes `config.fee`, does `function_b` also require admin auth when writing `config.fee`?

## CHECK 4: Cross-Function Action Parity
For each user action (deposit, withdraw, stake, unstake, claim, lock, unlock):

| Action | Function A | Protection | Function B | Same Protection? | Gap? |
|--------|-----------|------------|-----------|-----------------|------|

Check: same economic action across different entry points should have equivalent protections, validations, and storage updates.

## CHECK 5: Cross-Contract Call Parameter Validation
For every cross-contract invocation that passes user-supplied or function-argument parameters:

| Function | Call Target | Parameter Source | Validated Before Call? | What Is Unvalidated? |
|----------|------------|-----------------|----------------------|---------------------|

Trace parameters backward to source. Flag any user-controlled parameter passed to a cross-contract call without validation.

**Address verification**: For every cross-contract call, list all addresses passed:
| Call Site | Address | Source (storage/arg/env) | Validated as Contract? | Impact if Attacker-Controlled |
|-----------|---------|--------------------------|----------------------|------------------------------|

## CHECK 6: Helper Function Call-Site Parity

For EVERY internal helper that transforms values (normalization, scaling, encoding, share calculation):

| Helper Function | Purpose | Call Sites | Consistent Usage? | Missing/Inconsistent Site |
|----------------|---------|-----------|-------------------|--------------------------|

**Methodology**:
- Grep for ALL call sites of each helper (normalize, scale, to_shares, to_assets, to_stroop, from_stroop, or any protocol-specific transform pair).
- For each PAIR of inverse helpers (deposit-side / withdrawal-side): verify every value that passes through one also passes through its inverse at the appropriate point.
- For each call site: does it apply the helper to the same variable type with the same parameters as other call sites?
- Flag: a value that is scaled at entry but not unscaled at exit (or vice versa).
- Flag: a helper called with different parameters at different sites when the same parameters are expected.
- For paired operations that share state (lock/unlock, deposit/withdraw, open/close): if either transforms an input before use, verify the paired operation applies the same transformation at the same logical point.

**Concrete test**: If `shares_from_assets(amount, total_shares, total_assets)` is called at 3 deposit sites but `assets_from_shares(shares, total_shares, total_assets)` is called at only 2 of 3 corresponding withdrawal sites, the missing site produces values at the wrong scale.

## CHECK 7: Write Completeness for Accumulators (uses pre-computed invariants)

Read `{SCRATCHPAD}/semantic_invariants.md` (pre-computed by Phase 4a.5 agent). For each variable with POTENTIAL GAP flagged:

| Variable | Flagged Gap | Confirmed? | Finding? |
|----------|-----------|-----------|----------|

Verify each flagged gap: does the value-changing function actually modify the tracked value without updating the accumulator? Filter false positives (e.g., view-only reads, functions that indirectly trigger an update). Confirmed gaps â†’ FINDING.

## CHECK 8: Conditional Branch State Completeness

For EVERY state-modifying function that contains an if/else, match arm, or early return:

| Function | Branch Condition | State Written in TRUE Branch | State Written in FALSE Branch | Asymmetry? |
|----------|-----------------|-----------------------------|-----------------------------|------------|

**Methodology**:
- For each conditional branch in a state-modifying function, enumerate ALL storage writes in the TRUE path.
- Enumerate ALL storage writes in the FALSE path (including the implicit "nothing happens" path for early returns).
- If a storage entry is written in one branch but NOT the other, and both branches represent valid execution paths (not error/panic) â†’ flag as potential stale state.
- Special focus: functions where TTL extension, timestamp updates, or balance checkpoints are inside a conditional block but downstream consumers assume they always executed.
- Special focus: functions where an "inactive" or "paused" branch updates a sequence number but NOT a corresponding accumulator, or vice versa.

**Concrete test**: If `function_a` writes `last_update_ledger = env.ledger().sequence()` inside an `if amount > 0` block, what value does `last_update_ledger` retain when `amount == 0`? Trace all consumers of `last_update_ledger` " do they produce correct results with the stale value?

Tag: [TRACE:branch=false â†’ stateVar={old_value} â†’ consumer computes {wrong_result}]

## CHECK 9: Validation Semantic Adequacy

For EVERY validation that protects against value loss (slippage checks, balance thresholds, minimum output assertions):

| Validation | What It Measures | What It Should Measure | Match? |
|-----------|-----------------|----------------------|--------|

**Classification** " for each validation, determine:
- Does it check ABSOLUTE state (total balance) or RELATIVE change (delta per operation)?
- Does it check AGGREGATE result (batch total) or PER-ITEM result (individual operation)?
- Does it check a PROXY metric (correlated value) or the DIRECT metric (actual value at risk)?

If the validation uses absolute/aggregate/proxy AND the protected operation is per-item or requires delta measurement â†’ FINDING: validation measures the wrong granularity. A batch of operations where each individually loses value but the aggregate stays flat passes an aggregate check but fails a per-item check.

**Unit-scale axis** (per validation): for any `x < floor` / `x >= min_out` / slippage comparison, identify the TOKEN each side is denominated in. If one side derives from an INPUT amount (`x rate`) and the other is an OUTPUT/received amount, verify BOTH sides share the SAME token's decimal scale. Flag ONLY when the two sides are PROVABLY different token decimal scales â€” a floor in the input token's decimals compared against an output in a different token's decimals is a finding (too loose if output higher-dec, too tight if lower-dec).

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## SELF-CONSISTENCY CHECK (MANDATORY before output)

For each finding you produce: if your own analysis identifies that the missing pattern/guard/check is FUNCTIONALLY REQUIRED to be absent (e.g., adding it would cause panics, break composability, or make the function unreachable), your verdict MUST be REFUTED, not CONFIRMED with caveats. A finding that says "X is missing" and also explains "adding X would break Y" is self-contradictory " resolve the contradiction before outputting.

## Output
Write to {SCRATCHPAD}/validation_sweep_findings.md:

### Sweep Summary
| Check | Functions Scanned | Findings | False Positives Filtered |

### Findings
Use finding IDs [VS-1], [VS-2], etc. Maximum 12 findings.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} functions swept, {M} boundary issues, {K} reachability gaps, {J} guard gaps, {P} parity gaps, {Q} cross-contract parameter gaps, {R} helper parity gaps, {S} conditional branch gaps'
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

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/sibling_propagation_findings.md` with a one-line header `# Sibling Propagation Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md (all findings with verdicts)
- Source files for all in-scope contracts

## Methodology

For each Medium+ CONFIRMED or PARTIAL finding in findings_inventory.md:

1. Extract the ROOT CAUSE PATTERN in one sentence (e.g., 'storage write inside conditional block that can be skipped', 'paired operation asymmetry between deposit/withdraw paths', 'require_auth called for caller instead of affected address')
2. Grep ALL other functions in scope for the SAME pattern (same storage types, same code structure, same operation sequence)
3. For each sibling function found: does it exhibit the SAME bug?
4. If YES and no existing finding covers it â†’ new finding [SP-N]

| Finding | Root Cause Pattern | Sibling Functions | Same Bug? | New Finding? |
|---------|-------------------|------------------|-----------|-------------|

## Output
Write to {SCRATCHPAD}/sibling_propagation_findings.md
Use finding IDs [SP-1], [SP-2], etc. with standard finding format.
Maximum 8 findings " prioritize by severity.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |
|------------|----------|--------------------:|---------|----------|-------------------|-------------------|

Return: 'DONE: {N} root cause patterns extracted, {M} sibling functions found, {K} new findings'
")
```

---

## Design Stress Testing Agent - Soroban (Budget Redirect)

```
Task(subagent_type="general-purpose", prompt="
You are the Design Stress Testing Agent for a Soroban contract audit.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/design_stress_findings.md` with a one-line header `# Design Stress Testing Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/constraint_variables.md
- {SCRATCHPAD}/function_list.md
- {SCRATCHPAD}/attack_surface.md
- {SCRATCHPAD}/state_variables.md
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)

## CHECK 1: Design Limit Stress (Resource Focus)
For each bounded parameter (max users, max entries, max iterations, max Vec size):

| Parameter | Design Limit | CPU Instructions at Limit | Read Bytes at Limit | Within Soroban Budget? | Admin Usable at Limit? |
|-----------|-------------|--------------------------|--------------------|-----------------------|----------------------|

Soroban resource limits per transaction (approximate):
- CPU instructions: ~100M (varies by ledger configuration)
- Read bytes: ~200KB
- Write bytes: ~66KB
- Read ledger entries: 40
- Write ledger entries: 25
- Transaction size: ~70KB

Tag: [BOUNDARY:param=MAX_VALUE â†’ resource_cost]

If ANY parameter at its design maximum causes resource exhaustion for a routine user operation â†’ FINDING (DoS via ResourceLimitExceeded).

**TTL gaming stress**: Can an attacker force bulk TTL expirations to invalidate critical state?
- Can they prevent `extend_ttl` from being called by griefing keeper transactions?
- If user storage entries expire en masse (e.g., during a network pause), what is the recovery path?

## CHECK 2: Rule 13 Design Adequacy
For each user-facing function, verify it fulfills its stated purpose completely:

| Function | Stated Purpose | Fulfills Completely? | User States Without Exit? | Gap Description |
|---------|---------------|---------------------|--------------------------|-----------------|

Special Soroban cases:
- **Locked state with no emergency exit**: If a user's funds are locked (timelock, vesting, escrow) and the contract has no admin emergency release, what happens if the contract is upgraded incompatibly or the Instance storage expires?
- **Auth tree deadlock**: If admin is a multisig contract that itself depends on this contract's state, can a state transition lock out the admin?

## CHECK 3: Constraint Coherence (Rule 14)
For each pair of independently-settable limits:

| Limit A | Setter A | Limit B | Setter B | Relationship Required? | Enforced On-Chain? | What Breaks if Desync? |
|---------|---------|---------|---------|----------------------:|-------------------|-----------------------|

Tag: [TRACE:limitA=X, limitB=Y â†’ outcome]

Examples: max_positions vs per_position_min_amount; total_supply_cap vs individual_mint_limit; vote_threshold vs quorum_requirement.

## CHECK 4: Yield/Reward Timing Fairness
For each yield distribution, reward streaming, or vesting mechanism:

| Mechanism | Distribution Event | Entry Window | Sandwich Possible? | Fairness Gap? |
|-----------|-------------------|-------------|-------------------|--------------|

1. Can a user deposit IMMEDIATELY BEFORE a reward distribution (keyed by ledger sequence) and capture a disproportionate share?
2. Is there a cooldown, lock period, or time-weighted balance that prevents ledger-sandwich attacks?
3. For streaming/vesting: can a user enter AFTER streaming starts but before it ends and capture already-vested gains at the current share price?
4. **Ledger-atomic sandwiching**: Unlike EVM (where block timestamps are coarse), Soroban ledgers close approximately every 5 seconds. Verify whether a user can atomically deposit and withdraw within the same reward period by submitting both transactions in the same ledger batch.
5. Trace: if user deposits at ledger L, reward distribution at ledger L+1, user withdraws at ledger L+2 " what is the user's profit vs a user deposited for the full period? If disproportionate â†’ FINDING.

Tag: [TRACE:deposit_at=L, distribution_at=L+1, withdraw_at=L+2 â†’ profit={X} vs long_term_user={Y} â†’ fairness_ratio={Z}]

## CHECK 5: Instance Storage Inflation Attack
For each entry stored in Instance storage that can be written by users or permissionless callers:

| Instance Entry | Writable By | Entry Count Bounded? | Inflation Attack Vector | Max Reachable Size | DoS Threshold? |
|---------------|------------|---------------------|------------------------|--------------------|---------------|

An attacker who inflates Instance storage forces all future contract invocations to read that bloated state on every call, increasing read-byte costs for every user until the contract hits the resource ceiling and becomes unusable. Verify:
- Is the entry count capped on-chain?
- Is there a cost (fee, stake) to add entries that disincentivizes inflation?
- Can the admin prune entries without user consent?

Tag: [BOUNDARY:instance_entries=MAX â†’ read_bytes_exceeded â†’ all_calls_fail]

## Output
Write to {SCRATCHPAD}/design_stress_findings.md:
- Maximum 8 findings [DST-1] through [DST-8]

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} design stress findings'
")
```

