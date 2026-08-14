# Phase 4b: Scanner & Sweep Templates - DAML

> **Usage**: Orchestrator reads this file to spawn the 3 Blind Spot Scanners, Validation Sweep Agent, and Design Stress Testing Agent for DAML/Canton contracts.
> Replace placeholders `{SCRATCHPAD}`, etc. with actual values.

---

## Processing Protocol (ALL Scanner & Sweep Agents)

Every agent spawned from this file MUST follow this protocol for each CHECK/step in their section:
1. **ENUMERATE targets**: List every entity the CHECK applies to as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

---

## Blind Spot Scanner A: Choices & Assets (DAML)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner A for a DAML/Canton contract audit. Find what breadth agents NEVER LOOKED AT for choice consume-modes, asset value conservation, locking, and metadata immutability.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_a_findings.md` with a one-line header `# Blind Spot Scanner A - Choices & Assets`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/attack_surface.md (Section B - choice/asset semantics; consuming vs nonconsuming value-movers)
- {SCRATCHPAD}/findings_inventory.md (what WAS analyzed)
- {SCRATCHPAD}/state_variables.md ((Template,field) entries, amount/accumulator/lock fields)
- {SCRATCHPAD}/function_list.md (each choice + consume-mode + controller)

## Processing Protocol (MANDATORY - applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (choices, asset-bearing templates, accumulators, lock fields) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 1: Consume-Mode Coverage
Cross-reference attack_surface.md Section B against findings_inventory.md.

For each value-moving choice (split, merge, transfer, issue, redeem, settle):
| Choice (Template.Choice) | Consume-Mode (consuming/nonconsuming/pre/postconsuming) | Analyzed by Agent? | Finding IDs | Double-Exercise Possible? |
|--------------------------|---------------------------------------------------------|--------------------|-------------|---------------------------|

Rules:
- A value-bearing contract exposed through a `nonconsuming` choice that MOVES its value can be exercised more than once on the SAME ContractId → double-spend. If ANY asset-mover is nonconsuming AND has 0 findings → BLIND SPOT.
- A `preconsuming`/`postconsuming` choice that `fetch`es its OWN contract: `postconsuming` archives the contract BEFORE the consequences run, so a self-`fetch` in a postconsuming body hits CONTRACT_NOT_FOUND. Flag any self-fetch-after-archive ordering → BLIND SPOT.
- A `consuming` choice that creates a successor but is reachable twice through two different entry choices on contracts sharing the same `key` → flag as double-issuance path.

## CHECK 2: Value Conservation & Accumulator (Rule 14)
For each split/merge/transfer choice and each cumulative cap/accumulator field:

| Choice / Field | Conservation Invariant | Enforced by `ensure`? | Re-checked per-tx? | Cross-Tx Cap Tracked? | Gap? |
|----------------|------------------------|-----------------------|--------------------|-----------------------|------|

Rules:
- Split: `out1 + out2 == in`. Merge: `merged == in1 + in2`. Transfer: `dest.amount == source.amount`. If the invariant is NOT in an `ensure` clause or in-body assert → BLIND SPOT (caller may craft non-conserving outputs).
- Accumulator/cap (issuance cap, debt ceiling, supply limit) held as a (Template,field): is the running total re-read AND updated on every issuing choice, or can two independent transactions each pass the check and jointly exceed it? (R14)
- Setter regression (R14): can an admin re-create a config with a cap BELOW the already-accumulated total?
- **Silent gap**: a conservation `ensure` that uses `>=` where `==` is required (allows value creation) or `<=` where `==` is required (allows value destruction/dust) → finding even without an attacker.

## CHECK 3: Lock / Cancel-Unwind
For each contract carrying a lock field (locked, lockedUntil, lockHolder) and each cancel/abort/reject choice:

| Template / Choice | Lock Field | Honored by Split/Merge/Transfer? | Carried Forward on Re-create? | Cancel Unwinds Children? | Finding? |
|-------------------|-----------|----------------------------------|-------------------------------|--------------------------|----------|

Rules:
- Lock-bypass: does EVERY value-moving choice on a lockable asset check the lock before acting? A split that omits the lock check → locked value escapes via children → BLIND SPOT.
- Lock-erase: when a choice re-creates the asset, is the lock field carried forward? If the successor is created unlocked → lock silently erased.
- Cancel no-unwind: a cancel/reject choice in a Propose→Accept (or allocate→release) flow that archives the parent but leaves a child contract active → orphaned committed value. Trace: cancel parent, `query@T` for child — still present? → finding.

## CHECK 4: Metadata / Terms Immutability
For each choice that re-creates a contract with updated fields:

| Choice | Re-created Template | Mutable Non-Amount Fields | Counterparty Relied On? | Overwrite Detectable? | Finding? |
|--------|---------------------|---------------------------|-------------------------|-----------------------|----------|

Rules:
- A choice that re-creates a contract may silently overwrite a non-amount field (terms, reference, owner, memo, deadline) a counterparty signed against, while the amount stays valid. If the counterparty's consent was bound to the OLD terms but the choice does not re-require it under the NEW terms → finding (the proposer signed terms A, the acceptor exercises under terms B).

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-A1] through [BLIND-A5]
- Use standard finding format with DAML security rules
- Note WHY breadth agents likely missed each

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_a_findings.md

Return: 'DONE: {N} blind spots - Check1: {A} consume-mode gaps, Check2: {B} conservation/accumulator gaps, Check3: {C} lock/cancel gaps, Check4: {D} metadata gaps'
")
```

---

## Blind Spot Scanner B: Authorization, Keys & Interface (DAML)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner B for a DAML/Canton contract audit. Find what breadth agents NEVER LOOKED AT for controller/co-authorization completeness, contract-key & lookupByKey safety, interface coercion & view exposure, and fetch-based authenticity.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_b_findings.md` with a one-line header `# Blind Spot Scanner B - Authorization, Keys & Interface`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md (choice inventory + controller exprs + consume-mode)
- {SCRATCHPAD}/state_variables.md (key+maintainer declarations)
- {SCRATCHPAD}/attack_surface.md (Section A AUTHORIZATION MATRIX, Section D key/state lifecycle)
- Source files for all in-scope templates

## Processing Protocol (MANDATORY - applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (choices, keys, interface impls, fetch sites) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 5: Controller / Co-Authorization Matrix
For each choice in the contract:

| Choice | Required Authorizers (AND of controllers) | SHOULD Require | Controller Source (fixed-signatory / argument-derived) | In-body owner==party Check? | Analyzed? | Finding ID |
|--------|-------------------------------------------|----------------|---------------------------------------------------------|------------------------------|-----------|------------|

Rules:
- The required authorizers of an `Exercise` are the AND of the listed `controller` parties. A choice that SHOULD require BOTH issuer AND owner but lists only one → single-where-joint (D1, typically High).
- **Argument-derived controller (D2, typically Critical)**: if the `controller` expression references a CHOICE ARGUMENT or a mutable field rather than a fixed signatory, the caller can supply their own party → privilege injection. Flag EVERY argument-derived controller.
- **Missing in-body validation**: a choice that takes a `party` argument and acts on its behalf without an `assert (party == owner)` / `ensure` binding → any authorized caller drains an arbitrary party.
- Admin/operator choices: verify the privileged party is a fixed signatory loaded from the template, not supplied as a choice argument.
- Also flag: a `Create` whose `signatory` set omits a party whose consent the design assumes (the authorizer-subset rule — required authorizers of `Create` are exactly the signatories).

## CHECK 6: Contract Key & lookupByKey Safety
For each `key`+`maintainer` declaration and each `lookupByKey`/`fetchByKey`/`exerciseByKey` site:

| Key (Template) | Maintainers | All Maintainers Signatories? | lookupByKey None-Branch Behavior | exerciseByKey Authority OK? | Finding? |
|----------------|-------------|------------------------------|----------------------------------|------------------------------|----------|

Rules:
- **Maintainer ⊆ signatory (D4)**: every maintainer MUST be a signatory. The compiler enforces this, but flag any refactor where a party is a maintainer but was dropped from `signatory` — and flag maintainer sets that are WIDER than necessary (a maintainer that is also a controller of a sensitive choice).
- **lookupByKey false-None (D5)**: `lookupByKey @T key` returns None when the contract is ABSENT *or* when the submitter is NOT a stakeholder and cannot see it. If a None branch creates a fresh contract / skips a uniqueness check, a party WITHOUT visibility can trigger duplicate creation. Flag every None branch that mutates state on the "absent" assumption.
- **exerciseByKey authority**: the keyed choice's required authorizers must be satisfiable by the submitter. Flag a keyed choice whose consequence needs an authorizer the keyed-by submitter does not hold (works only via divulgence).

## CHECK 7: Interface Coercion & View Exposure
For each interface, each template implementing it, and each `fromInterfaceContractId`/`coerceContractId` site:

| Interface / Impl | view Fields Exposed | Wider Than Concrete Template? | Coercion Verified Before Use? | Interface-Choice Controller Matches Intent? | Finding? |
|------------------|---------------------|-------------------------------|-------------------------------|----------------------------------------------|----------|

Rules:
- **Unverified coercion**: `fromInterfaceContractId @T icid` that uses the coerced CID without first `fetch`ing and pattern-matching the concrete type → wrong-template type confusion. Flag every coercion that is not guarded by a runtime type check.
- **view over-exposure**: an interface `view` that surfaces amounts/counterparties/terms to interface observers when the concrete template kept those fields out of its observer set → disclosure widened through the interface. (Reportable as privacy ONLY if a party-scoped `query` over the interface confirms an outsider sees it.)
- **Interface-choice wrong-controller**: an interface choice whose implementation's effective controller does not match the interface's stated intent.

## CHECK 8: Fetch-Based Authenticity
For each choice that makes an authorization or business decision based on a `fetch`ed contract's fields:

| Choice | Fetched Template | CID Source (storage/key/caller-arg) | Bound to Operation? | Caller Can Forge a Lookalike? | Finding? |
|--------|------------------|--------------------------------------|---------------------|-------------------------------|----------|

Rules:
- A choice that reads "the fetched Role/Admin/Config contract says caller is allowed" is only safe if the fetched ContractId is bound (from trusted storage/key/signatory), NOT supplied by the caller. If the CID is a CALLER ARGUMENT, the caller can create and pass their OWN lookalike contract → fetch-based auth bypass.
- Trace the CID provenance backward: caller-arg → forgeable → finding; storage/key/signatory-bound → safe.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 5 findings [BLIND-B1] through [BLIND-B5]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_b_findings.md

Return: 'DONE: {N} blind spots - Check5: {A} controller/co-auth gaps, Check6: {B} key/lookupByKey gaps, Check7: {C} interface coercion/view gaps, Check8: {D} fetch-based auth gaps'
")
```

---

## Blind Spot Scanner C: CID-Capability, ensure/abort & Disclosure (DAML)

```
Task(subagent_type="general-purpose", prompt="
You are Blind Spot Scanner C for a DAML/Canton contract audit. Find what breadth agents NEVER LOOKED AT for caller-supplied ContractId binding, ensure/abort safety, and observer/divulgence disclosure.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/blind_spot_c_findings.md` with a one-line header `# Blind Spot Scanner C - CID-Capability & ensure/abort Safety`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md
- {SCRATCHPAD}/function_list.md
- {SCRATCHPAD}/state_variables.md (config/whitelist CID fields, ensure clauses)
- {SCRATCHPAD}/attack_surface.md (Section C CID-capability, Section E privacy, Section F boundary)
- Source files for all in-scope templates

## Processing Protocol (MANDATORY - applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (caller-CID sites, ensure clauses, arithmetic sites, observer/fetch sites) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 9: CID-Binding & Fail-Open / Brick (DAML NEVER-CUT untrusted-target check)
> This is the DAML analog of the EVM untrusted-call-target check (Scanner C CHECK 5 in the EVM tree). It MUST survive any Light-mode scanner merge. A caller-supplied `ContractId` is DAML's untrusted external reference: whatever the caller passes, the choice will `fetch` and trust unless it is bound.

For each choice that takes a `ContractId T` argument, and for each config/whitelist/registry contract referenced by CID or key:

| Choice / Config | CID Source (caller-arg / storage / key / hardcoded) | Bound to Operation? | Absent → Fail-Closed or Fail-Open? | Hardcoded/Stale → Brick? | Type-Confusion (coercion)? | Finding? |
|-----------------|------------------------------------------------------|---------------------|------------------------------------|--------------------------|----------------------------|----------|

Rules:
- **CID-binding (D6)**: a caller-supplied `ContractId T` that is `fetch`ed and trusted WITHOUT verifying it is the expected contract (matching owner/issuer/key) → the caller substitutes a lookalike they control. Flag EVERY unbound caller-CID. This is the highest-yield DAML-distinctive class — never skip it.
- **Fail-open (D7)**: if a config/whitelist/registry is ABSENT (lookupByKey None, or argument optional and omitted), does the choice REJECT (fail-closed, safe) or PROCEED unrestricted (fail-open, bug)?
- **Brick**: a hardcoded `ContractId` (or one stored at creation) that gets archived/superseded → every dependent choice `fetch`es a now-archived CID → CONTRACT_NOT_FOUND → permanent liveness brick.
- **Type-confusion**: `fromInterfaceContractId`/`coerceContractId` used without a runtime type check (covered jointly with Scanner B CHECK 7; flag here when the coerced CID is also caller-supplied).

## CHECK 10: ensure & abort Safety
For each template `ensure` clause and each arithmetic expression / `abort`/`error`/`assert` inside a choice body:

| Location | Construct (ensure / arithmetic / abort) | Invariant Enforced | Reachable Abort on Valid Input? | Brick (permanent un-exercisable)? | Finding? |
|----------|-----------------------------------------|--------------------|----------------------------------|------------------------------------|----------|

Rules:
- **ensure-gap (D8)**: does the `ensure` clause enforce EVERY invariant the choices assume (amount > 0, owner /= issuer, deadline > now, non-empty list)? An assumed-but-unenforced invariant means an invalid contract is creatable directly via `createCmd`.
- **Arithmetic abort = LIVENESS, not silent wrap**: DAML `Int`/`Decimal` THROW on overflow/underflow/division-by-zero — they do NOT wrap. A reachable overflow makes the choice (or `create`) permanently throw → liveness brick. Enumerate every arithmetic op on caller-influenced values; assess reachability of the abort. Treat strictly as a liveness/brick finding.
- **Attacker-triggered abort**: if an attacker can supply an input (a crafted amount, an empty list to `head`, a zero divisor) that makes a routine choice abort, they can DoS every workflow that depends on that choice succeeding.
- **Authorized aborts**: an `assert`/`abort` that is intentionally an invariant guard is acceptable — document why it is safe. Unintentional aborts on user-supplied paths are findings.

## CHECK 11: Observer / Divulgence Disclosure (strict party-scoped PoC gate)
For each `observer` clause, each interface `view`, and each choice that `fetch`es another party's contract:

| Template / Choice | Disclosure Vector (observer / view / fetch-divulgence) | Who Gains Visibility | Should They? | Party-Scoped query@T Confirms? | Finding? |
|-------------------|---------------------------------------------------------|----------------------|--------------|--------------------------------|----------|

Rules:
- **Over-broad observer**: an `observer` set wider than the parties who genuinely need visibility → those parties can `query@T` the contract and read its fields.
- **Divulgence via fetch**: a choice that `fetch`es a counterparty's private contract divulges it INCIDENTALLY (transiently) to the choice's authorizers/stakeholders. Distinguish transient divulgence (via `fetch`) from persistent visibility (via `observer`).
- **STRICT GATE**: a disclosure finding is reportable ONLY with a party-scoped PoC steer: `outsider <- allocateParty; cids <- query @T outsider; assert (not (null cids))`. If you cannot construct a party-scoped query showing an outsider sees the contract, DO NOT report it — downgrade to a note. Do NOT drift into disclosure-design / compliance prose.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output
- Maximum 9 findings [BLIND-C1] through [BLIND-C9]
- Use standard finding format

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/blind_spot_c_findings.md

Return: 'DONE: {N} blind spots - Check9: {A} CID-binding/fail-open/brick gaps, Check10: {B} ensure/abort gaps, Check11: {C} observer/divulgence gaps'
")
```

---

## Validation Sweep Agent - DAML

```
Task(subagent_type="general-purpose", prompt="
You are the Validation Sweep Agent for a DAML/Canton contract audit. You perform mechanical checks across every choice in scope.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/validation_sweep_findings.md` with a one-line header `# Validation Sweep Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## INPUT FILTERING
When cross-referencing against findings_inventory.md, focus on Medium+ severity findings only. Low/Info findings do not need cross-validation sweeps - the attention cost of processing 50+ findings outweighs the marginal value of sweeping Low/Info patterns.

## Your Inputs
Read:
- {SCRATCHPAD}/function_list.md (choice inventory)
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)
- {SCRATCHPAD}/state_variables.md
- Source files for all in-scope templates

## Processing Protocol (MANDATORY - applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (ensure comparisons, choices, controllers, paired actions) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## CHECK 1: Boundary Operator Precision
For every comparison operator in an `ensure` clause or in-body assert (`>`, `<`, `>=`, `<=`, `==`, `/=`):

| Location | Expression | Operator | Boundary Value | Behavior AT Boundary | Off-by-One? |
|----------|-----------|----------|---------------|---------------------|-------------|

Test: what happens when the value equals the boundary exactly (deadline == now, amount == cap, count == limit)?
DAML-specific: `Int`/`Decimal` arithmetic THROWS on overflow/division-by-zero (no silent wrap) — note any comparison whose operands could abort before the comparison runs.
Also check: for each `foldl`/`map`/recursive accumulator over a list, verify ALL accumulators are updated per element. A fold that increments one total but not a co-dependent total produces double-counting.
Ledger-time comparisons: `getTime` returns a `Time`. Verify deadline comparisons use the intended strictness (`>` vs `>=`) consistently across create-time `ensure` and exercise-time checks.

## CHECK 2: Validation Reachability
Trace ALL choice paths for validation bypass:
- Can a sequence of choices (Propose→Accept, create→exercise) skip a validation that a single direct choice enforces?
- Do choice consequences assume a validation was applied by the parent choice?
- Can a `nonconsuming` choice be replayed to bypass a one-time check the design assumed was consuming?
- Do interface-choice implementations have different validation than the concrete template's own choice for the same logical action?

## CHECK 3: Guard Coverage Completeness
For every authorization/validation guard applied to at least one choice:

| Guard (controller set / ensure / in-body check) | Applied To | NOT Applied To (same state writes) | Missing? |
|--------------------------------------------------|-----------|--------------------------------------|----------|

Check: if `ChoiceA` requires joint issuer+owner controller and creates a `Position`, does `ChoiceB` that also creates/mutates a `Position` require the same joint authorization? A single-where-joint sibling is a finding.

## CHECK 4: Cross-Choice Action Parity
For each user action (issue, transfer, split, merge, lock, unlock, propose, accept, cancel):

| Action | Choice A | Authorization / ensure | Choice B | Same Protection? | Gap? |
|--------|---------|------------------------|----------|------------------|------|

Check: the same economic action reachable through different choices (direct Transfer vs Propose→Accept transfer) should have equivalent controller sets, `ensure` invariants, and conservation checks.

## CHECK 5: Cross-Template CID-Argument Validation
For every choice that passes a caller-supplied or argument-derived `ContractId`/`Party` into a `fetch`/`exercise`/`exerciseByKey`:

| Choice | Target (fetch/exercise) | Parameter Source | Bound/Validated Before Use? | What Is Unvalidated? |
|--------|-------------------------|------------------|------------------------------|---------------------|

Trace each ContractId/Party argument backward to source. Flag any caller-controlled `ContractId` that is fetched-and-trusted without a binding check, and any caller-controlled `Party` used as a controller or target without an `owner == party` binding.

**Party verification**: For every choice, list all `Party` arguments:
| Choice | Party Arg | Source (signatory/field/choice-arg) | Bound to Affected Contract? | Impact if Attacker-Controlled |
|--------|-----------|--------------------------------------|------------------------------|------------------------------|

## CHECK 6: Helper Function Call-Site Parity

For EVERY shared helper that transforms values (normalization, scaling, share calculation, fee computation) used across choices:

| Helper Function | Purpose | Call Sites (choices) | Consistent Usage? | Missing/Inconsistent Site |
|----------------|---------|----------------------|-------------------|--------------------------|

**Methodology**:
- Grep for ALL call sites of each helper (toShares, toAmount, applyFee, normalize, or any protocol-specific transform pair).
- For each PAIR of inverse helpers (issue-side / redeem-side, lock-side / unlock-side): verify every value that passes through one also passes through its inverse at the appropriate point in the paired choice.
- For each call site: does it apply the helper to the same field with the same parameters as other call sites?
- Flag: a value scaled at issue but not unscaled at redeem (or vice versa).
- Flag: a paired choice (lock/unlock, split/merge) where one side transforms an amount before use but the other side does not apply the same transform at the same logical point.

**Concrete test**: If `toShares(amount, total)` is called at 3 issuing choices but `toAmount(shares, total)` is called at only 2 of 3 corresponding redeem choices, the missing site produces values at the wrong scale.

## CHECK 7: Write Completeness for Accumulators (uses pre-computed invariants)

Read `{SCRATCHPAD}/semantic_invariants.md` (pre-computed by Phase 4a.5 agent). For each (Template,field) accumulator with POTENTIAL GAP flagged:

| Variable | Flagged Gap | Confirmed? | Finding? |
|----------|-----------|-----------|----------|

Verify each flagged gap: does the value-changing choice actually create/archive a contract that alters the tracked total WITHOUT updating the dependent accumulator contract? Filter false positives (view-only fetches, choices that indirectly trigger an update). Confirmed gaps → FINDING.

## CHECK 8: Conditional Branch State Completeness

For EVERY choice that contains an `if/else`, `case`, pattern match, or early `return`/`abort`:

| Choice | Branch Condition | Contracts Created/Archived in TRUE Branch | Contracts Created/Archived in FALSE Branch | Asymmetry? |
|--------|------------------|-------------------------------------------|--------------------------------------------|------------|

**Methodology**:
- For each conditional branch in a choice, enumerate ALL `create`/`archive`/`exercise` in the TRUE path.
- Enumerate ALL `create`/`archive`/`exercise` in the FALSE path (including the implicit "nothing happens" path).
- If a contract is created/archived in one branch but NOT the other, and both branches are valid (not abort) → flag as potential stale/orphan state.
- Special focus: a `Some`/`None` match where the `Some` arm archives a child contract but the `None` arm does not (or vice versa) → stale child. (lookupByKey None branches are especially error-prone here.)
- Special focus: a branch that re-creates a contract with an updated timestamp/accumulator in one arm but leaves the old value in the other.

**Concrete test**: If a choice archives a `Reservation` only inside the `Some res ->` arm of `lookupByKey`, what happens in the `None ->` arm — is a stale Reservation left active because None meant "not visible" rather than "absent"?

Tag: [TRACE:branch=None → child contract not archived → orphan in ACS → consumer double-counts]

## CHECK 9: Validation Semantic Adequacy

For EVERY `ensure`/in-body validation that protects against value loss or unauthorized state (conservation asserts, cap checks, authorization binds):

| Validation | What It Measures | What It Should Measure | Match? |
|-----------|-----------------|----------------------|--------|

**Classification** - for each validation, determine:
- Does it check ABSOLUTE state (a contract's total field) or RELATIVE change (delta across the choice's consequences)?
- Does it check AGGREGATE result (sum of all created children) or PER-CHILD result (each created contract individually)?
- Does it check a PROXY (a correlated field) or the DIRECT field at risk?

If the validation uses absolute/aggregate/proxy AND the protected operation is per-child or requires delta measurement → FINDING: validation measures the wrong granularity. A split into many children where each individually loses a rounding unit but the aggregate stays flat passes an aggregate `ensure` but fails a per-child check.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## SELF-CONSISTENCY CHECK (MANDATORY before output)

For each finding you produce: if your own analysis identifies that the missing pattern/guard/check is FUNCTIONALLY REQUIRED to be absent (e.g., adding a co-authorizer would make a legitimate single-party workflow impossible, adding an `ensure` would make a valid contract uncreatable, requiring a maintainer would break composability), your verdict MUST be REFUTED, not CONFIRMED with caveats. A finding that says "X guard is missing" and also explains "adding X would break Y" is self-contradictory - resolve the contradiction before outputting.

## Output
Write to {SCRATCHPAD}/validation_sweep_findings.md:

### Sweep Summary
| Check | Choices Scanned | Findings | False Positives Filtered |

### Findings
Use finding IDs [VS-1], [VS-2], etc. Maximum 12 findings.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} choices swept, {M} boundary issues, {K} reachability gaps, {J} guard gaps, {P} parity gaps, {Q} CID/party argument gaps, {R} helper parity gaps, {S} conditional branch gaps'
")
```

---

## Sibling Propagation Agent

> **Trigger**: Always runs IN PARALLEL with Validation Sweep (iteration 1 only).
> **Purpose**: Propagate confirmed root cause patterns to sibling choices/templates. Extracted from Validation Sweep to avoid positional attention degradation (was CHECK 9 of 9 - highest cognitive load in worst attention position).
> **Budget**: Scanner-tier (part of fixed base count, not depth budget).

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Sibling Propagation Agent. For each Medium+ CONFIRMED or PARTIAL finding, you search the entire codebase for sibling choices/templates exhibiting the SAME root cause pattern.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/sibling_propagation_findings.md` with a one-line header `# Sibling Propagation Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md (all findings with verdicts)
- Source files for all in-scope templates

## Methodology

For each Medium+ CONFIRMED or PARTIAL finding in findings_inventory.md:

1. Extract the ROOT CAUSE PATTERN in one sentence (e.g., 'value-moving choice exposed as nonconsuming', 'controller derived from a choice argument', 'lookupByKey None branch creates fresh contract on the absent assumption', 'split choice omits the lock-field check', 'caller-supplied ContractId fetched without a binding check')
2. Grep ALL other choices/templates in scope for the SAME pattern (same consume-mode, same controller-source shape, same key/lookup structure, same fetch-of-caller-CID structure)
3. For each sibling found: does it exhibit the SAME bug?
4. If YES and no existing finding covers it → new finding [SP-N]

| Finding | Root Cause Pattern | Sibling Choices/Templates | Same Bug? | New Finding? |
|---------|-------------------|---------------------------|-----------|-------------|

## Output
Write to {SCRATCHPAD}/sibling_propagation_findings.md
Use finding IDs [SP-1], [SP-2], etc. with standard finding format.
Maximum 8 findings - prioritize by severity.

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |
|------------|----------|--------------------:|---------|----------|-------------------|-------------------|

Return: 'DONE: {N} root cause patterns extracted, {M} sibling choices found, {K} new findings'
")
```

---

## Design Stress Testing Agent - DAML (Budget Redirect)

```
Task(subagent_type="general-purpose", prompt="
You are the Design Stress Testing Agent for a DAML/Canton contract audit.

**FIRST ACTION**: Use the Write tool to create `{SCRATCHPAD}/design_stress_findings.md` with a one-line header `# Design Stress Testing Findings`. This reserves your write budget so the file exists on disk even if your analysis is interrupted.

## Your Inputs
Read:
- {SCRATCHPAD}/constraint_variables.md (caps/limits/deadlines/min-max in ensure clauses)
- {SCRATCHPAD}/function_list.md
- {SCRATCHPAD}/attack_surface.md
- {SCRATCHPAD}/state_variables.md
- {SCRATCHPAD}/findings_inventory.md (avoid duplicates)

## CHECK 1: Design Limit Stress (Invariant / Liveness Focus)
For each bounded parameter (issuance cap, max participants, max list length, fee/rate bound, deadline window):

| Parameter | Design Limit | Behavior AT Limit | Arithmetic Abort at Limit? | Invariant Holds at Limit? | Usable at Limit? |
|-----------|-------------|-------------------|----------------------------|---------------------------|------------------|

Tag: [BOUNDARY:param=MAX_VALUE → outcome]

DAML resource/liveness facts to test:
- `Int`/`Decimal` arithmetic THROWS at overflow/underflow/division-by-zero — a parameter pushed to its design max may make a routine choice abort → liveness brick. This is the DAML stress-failure mode (NOT resource-exhaustion).
- A list field (parties, allocations) processed by a fold/recursion: at maximum length, does the choice exceed any transaction limits, or does it still complete? If unbounded and permissionlessly appendable → grief vector.

If ANY parameter at its design maximum makes a routine choice abort (un-exercisable) → FINDING (liveness brick).

**Accumulator-cap stress**: Can a permissionless Propose→Accept sequence be repeated until a cumulative accumulator exceeds its cap across transactions (the cap being checked per-tx but never decremented)? → issuance-cap inflation finding.

## CHECK 2: Rule 13 Design Adequacy
For each party-facing workflow, verify it fulfills its stated purpose completely:

| Workflow (choice / propose-accept) | Stated Purpose | Fulfills Completely? | Party States Without Exit? | Gap Description |
|------------------------------------|----------------|----------------------|----------------------------|-----------------|

Special DAML cases:
- **Locked / committed state with no exit**: if a party's asset is locked (lock contract, allocation, escrow) and there is no choice that releases it under failure, what happens if the counterparty never acts or the deadline passes with no enforcing choice? → stuck-value finding.
- **Authority deadlock**: if a release choice requires the joint consent of two parties and one party can refuse, can a party be locked out of their own asset indefinitely?
- **Propose with no revoke**: a Propose contract whose proposer cannot archive it (no revoke choice) → proposer is bound until the counterparty acts.

## CHECK 3: Constraint Coherence (Rule 14)
For each pair of independently-settable limits:

| Limit A | Setter Choice A | Limit B | Setter Choice B | Relationship Required? | Enforced by ensure? | What Breaks if Desync? |
|---------|-----------------|---------|-----------------|------------------------:|---------------------|-----------------------|

Tag: [TRACE:limitA=X, limitB=Y → outcome]

Examples: issuanceCap vs perPartyMintLimit; minAmount vs maxAmount; voteThreshold vs quorum. Also: can an admin re-create a config contract with a cap BELOW the already-accumulated cumulative total (setter regression)?

## CHECK 4: Workflow Timing / Fairness
For each yield/reward/allocation distribution or vesting mechanism expressed as choices:

| Mechanism | Distribution Event | Entry Window | Last-Minute Entry Possible? | Fairness Gap? |
|-----------|-------------------|--------------|------------------------------|--------------|

1. Can a party Accept/enter IMMEDIATELY BEFORE a distribution choice and capture a disproportionate share?
2. Is there a deadline-gated `ensure`, lock period, or time-weighted field that prevents last-minute entry?
3. For streaming/vesting: can a party enter AFTER streaming starts but before it ends and capture already-vested value at the current share ratio?
4. **Deadline edge**: a distribution choice gated by `getTime` — test the exact equality boundary (`now == deadline`); does a `>` vs `>=` mismatch let a late party in (or lock an on-time party out)?
5. Trace: if a party Accepts at time T, distribution fires at T+1, party exits at T+2 — what is their share vs a party committed for the full window? If disproportionate → FINDING.

Tag: [TRACE:accept_at=T, distribution_at=T+1, exit_at=T+2 → share={X} vs full_window_party={Y} → fairness_ratio={Z}]

## CHECK 5: Permissionless Propose Inflation
For each Propose/offer/request template whose Create signatory is a single (non-privileged) party and whose Accept choice issues value or mutates a shared accumulator:

| Propose Template | Who Can Create? | Accept Issues / Mutates | Cap Enforced Across Txns? | Inflation Vector | Brick/Inflation Threshold? |
|------------------|-----------------|-------------------------|---------------------------|------------------|----------------------------|

A party who can permissionlessly create Propose contracts can flood the counterparty with Accept-able offers, or - if Accept issues value against a per-tx-checked cap - drive a cumulative total past the cap across many transactions. Verify:
- Is creating a Propose gated (a fee, a signatory the proposer cannot self-supply, a uniqueness key)?
- Does Accept re-read and update a cumulative accumulator, or only a per-tx check?
- Can the counterparty prune stale Proposes without consent?

Tag: [TRACE:N permissionless Propose→Accept each under per-tx cap → cumulative issued > cap → invariant broken]

## Output
Write to {SCRATCHPAD}/design_stress_findings.md:
- Maximum 8 findings [DST-1] through [DST-8]

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Return: 'DONE: {N} design stress findings'
")
```
