---
name: "fork-ancestry"
description: "Trigger Pattern Always (run during recon TASK 0, not breadth) - Inject Into Recon agent only (meta_buffer.md enrichment)"
---

# FORK_ANCESTRY Skill (Soroban)

> **Trigger Pattern**: Always (run during recon TASK 0, not breadth)
> **Inject Into**: Recon agent only (meta_buffer.md enrichment)
> **Finding prefix**: `[FA-N]`
> **Purpose**: Detect known parent Soroban contracts and Stellar DeFi ecosystem projects, and inherit their historical vulnerability patterns.

---

## 1. Detect Fork Indicators

Grep the codebase for known parent Soroban/Stellar project signatures:

| Parent Project | Detection Patterns | Common Forks |
|---------------|-------------------|--------------|
| SoroSwap | `soroswap\|SoroswapPair\|SoroswapFactory\|soroswap_router\|soroswap_pair\|get_reserves\|swap_exact_tokens` | AMM/DEX forks |
| Blend Protocol | `blend\|BlendPool\|BlendEmissions\|backstop\|b_token\|d_token\|blend_capital\|BlendLendingPool\|reserve_data` | Lending protocol forks |
| Phoenix DEX | `phoenix\|PhoenixPool\|phoenix_multihop\|phoenix_factory\|lp_share\|phoenix_swap\|stake_lp` | Concentrated liquidity / AMM forks |
| Aquarius | `aquarius\|AquariusPool\|aqua_token\|aquarius_amm\|reward_token\|voting_escrow` | Liquidity incentive / vote-escrow forks |
| Reflector (oracle) | `reflector\|oracle_asset\|TimeWeightedAverage\|PriceData\|reflector_oracle\|get_price\|get_twap` | Price oracle forks |
| Stellar Asset Contract (SAC) | `token::Client\|stellar_asset_contract\|soroban_token_interface\|TokenInterface\|token_contract` | Any SAC-compatible token implementation |
| Curve StableSwap | `get_d\|get_y\|get_y_d\|ramp_a\|stop_ramp_a\|stableswap\|StableSwap\|A_PRECISION\|RATE_MULTIPLIER\|calc_withdraw_one_coin\|remove_liquidity_imbalance\|get_virtual_price\|admin_fee\|commit_new_fee\|apply_new_fee` | StableSwap AMM forks — **set STABLESWAP_FORK flag if MEDIUM+ confidence** |
| Comet Protocol | `comet\|CometPool\|comet_amm\|weighted_pool\|join_pool\|exit_pool` | Balancer-style weighted pool forks |
| soroban-examples | `soroban_examples\|soroban-examples\|soroban_sdk::contract\|soroban_sdk::contractimpl` | Contracts directly derived from official examples |
| Stellar Turrets | `turret\|TxFunction\|fee_bump\|turret_contract` | Legacy function-as-a-service pattern (now deprecated) |

**Also check**:
- `Cargo.toml` dependencies for parent crate names (e.g., `blend-contract-sdk`, `phoenix-dex`, `soroswap-lib`)
- Import paths in Rust source: `use blend_contract_sdk::`, `use phoenix::`, etc.
- Contract interface declarations matching known parent project method signatures
- `soroban-sdk` version in `Cargo.toml` (`soroban-sdk = "X.Y.Z"`) — known vulnerabilities per SDK version

**Git-based detection** (complements code-pattern matching — catches forks that renamed all identifiers).
Skip if `REPO_SHAPE: squashed_import` in `build_status.md` — single-commit repos have no meaningful git metadata.
- Parse `.gitmodules` for submodule URLs pointing to known parent repos
- Check `git remote -v` for origin URLs matching known Stellar/Soroban organizations (stellar, soroswap, blend-capital, phoenix-protocol, esteblock)
- If a git-URL match is found but NO code-pattern match exists, flag as `GIT_ONLY_FORK`

**Output**: List of detected parents with confidence level:
- **HIGH**: 3+ unique patterns matched, OR parent crate in `Cargo.toml` dependencies
- **MEDIUM**: 2 patterns matched
- **LOW**: 1 pattern matched (may be coincidental naming)
- **GIT_ONLY**: git URL match but no code patterns — fork likely renamed identifiers

---

## 2. Query Known Parent Issues

For each detected parent (confidence MEDIUM or HIGH):

### 2a. Solodit Search (two queries, run in parallel)
```
// Query 1: Known high-quality issues
search_solodit_live(
  keywords="{parent_name} soroban stellar",
  impact=["HIGH", "CRITICAL"],
  language="Rust",
  quality_score=3,
  sort_by="Quality",
  max_results=15
)
// Query 2: Fork-specific divergence issues
search_solodit_live(
  keywords="{parent_name} fork modified soroban",
  impact=["HIGH", "MEDIUM"],
  language="Rust",
  sort_by="Rarity",
  max_results=10
)
```

### 2b. Tavily Search
```
tavily_search(query="{parent_name} soroban stellar contract vulnerability exploit audit finding 2024 2025 2026")
```

### 2c. Known Issue Catalog

Compile results into:

| Parent | Known Issue | Severity | Root Cause | Solodit Ref | Applicable to Fork? |
|--------|-----------|----------|------------|-------------|---------------------|
| {parent} | {issue title} | {severity} | {brief root cause} | {link/ID} | YES / NO / CHECK |

**Applicability criteria**:
- **YES**: Fork retains the vulnerable code path unchanged
- **NO**: Fork modified the vulnerable code path (document what changed)
- **CHECK**: Cannot determine without deeper analysis (flag for breadth agent)

### 2d. Hardcoded Known-Issue Floor (Web Search Fallback)

If Solodit AND Tavily BOTH fail, use this minimum catalog — check EACH applicable parent.

This floor is keyed on the dependency's **TYPE** (generic mechanism), NOT on any
specific protocol name — brand-keyed rows are prohibited (a floor row naming a
specific protocol is the confirmed benchmark-contamination vector; see the HARD
no-overfit rule). Classify the detected parent into a type below and check the
generic hazard class.

| Parent (generic type) | Critical Known Issue | Root Cause | Search Keywords |
|--------|---------------------|------------|-----------------|
| AMM / swap pool (constant-product model) | First-depositor share inflation (share = 0 for tiny initial deposit) | `deposit()` mints shares proportionally; tiny first deposit sets price, second depositor can lose funds | `amm swap pool first deposit share inflation liquidity` |
| Lending / reserve-accrual parent | Reserve accrual desync: interest/accrual index not updated on every balance-mutating path | Interest index update not triggered on every operation path (deposit/borrow/repay/withdraw), causing tracked-balance divergence | `lending reserve accrual index desync interest` |
| Concentrated-liquidity AMM | Concentrated liquidity bin boundary precision loss at extreme price ranges | Fixed-point arithmetic at bin edges truncates, accumulating rounding errors over many swaps | `concentrated liquidity bin precision rounding soroban` |
| External price/data oracle parent | No staleness check enforcement at consumer level (consumer does not validate data age) | Oracle publishes fresh data; consuming contracts read without checking the source `last_update`/timestamp | `oracle staleness consumer check soroban` |
| SAC token interface | `transfer_from` allowance bypass via contract-to-contract calls where `from == contract_address` | SAC allowance model differs from ERC-20: contract calling on its own behalf bypasses allowance check | `stellar asset contract transfer_from allowance bypass` |
| soroban-sdk (early versions) | Storage key collision via `Symbol::new` with similar string prefixes | `Symbol::new` and `Symbol::short` have different encodings; key collision possible for certain strings | `soroban-sdk symbol storage key collision` |
| Any contract using `env.ledger().timestamp()` | Timestamp is ledger close time, NOT block time; consecutive ledgers can have same timestamp if closed quickly | SCP allows back-to-back ledger closes with identical timestamps; timestamp-based cooldowns may be bypassable | `soroban ledger timestamp same consecutive cooldown` |

---

## 3. Divergence Analysis

For each detected parent:

### 3a. Identify What Changed

Compare fork vs parent in security-critical paths:

| Component | Parent Behavior | Fork Behavior | Security Impact |
|-----------|----------------|---------------|-----------------|
| {component} | {original} | {modified or SAME} | {new risk or NONE} |

**Soroban-specific divergence focus areas** (ordered by criticality):

#### Authorization Changes (HIGHEST PRIORITY)
Soroban uses a capability-based auth model (`env.require_auth(&address)`). Unlike EVM's `msg.sender`, auth must be explicitly required for each address that should authorize a call.

- Did the fork add or remove `require_auth` calls?
- Did the fork change WHICH address is authorized (e.g., changed from `admin` to `user` or removed auth entirely)?
- Did the fork use `require_auth_for_args` (more restrictive — limits auth to specific arguments) vs plain `require_auth` (allows authorization for any arguments)?
- **Critical**: Removing `require_auth` from a state-modifying function means ANY caller can execute it.
- Did the fork add `mock_all_auths()` in non-test code? (This disables auth entirely — a catastrophic mistake if left in production.)

#### Storage Key Changes
- Did the fork change storage key definitions (different `Symbol`, different enum variant, different data key type)?
- Changed keys can cause: ghost state (old data at old key remains readable), data unavailability (new key finds nothing), privilege bypass (auth data at different key not checked).
- Check: are storage key definitions consistent between ALL functions that read and write the same logical value?

#### External Contract Address Changes
- Did the fork change which external contracts are called?
- Are new external contract addresses validated and access-controlled?
- Did the fork add calls to contracts not in the parent? (New external dependency = new attack surface)
- **Critical**: `invoke_contract` with an unvalidated address allows the admin (or an attacker who can set the address) to redirect calls to a malicious contract.

#### Token Interface Changes
- Did the fork switch between SAC (Stellar Asset Contract) and a custom token implementation?
- SAC and custom tokens have different trust models: SAC is governed by Stellar core; custom tokens can be upgraded or have non-standard behavior.
- Did the fork add support for tokens with non-standard `transfer` behavior (e.g., fee-on-transfer tokens)?
- Check: does the fork correctly handle the case where `token::Client::transfer` succeeds but the received amount is less than requested (fee-on-transfer)?

#### Mathematical Formula Changes
- Modified interest rate formulas, fee calculations, exchange rates, reward distributions
- Even small arithmetic changes (different rounding direction, different precision) can cause systematic economic attacks over time
- Check: are constants (basis points, precision factors, time units) consistent between the fork and parent?
- **Parameter semantic verification**: When the parent has a mathematical specification, verify that each core parameter carries the same mathematical meaning in the fork — not just the same name and numeric range. Forks may store a raw value where the parent stores a derived form (e.g., raw coefficient vs. coefficient scaled by a function of pool dimensions). Compare the fork's formula usage against the parent's specification to confirm the encoding convention matches.

#### Other Divergence Areas
- Changed access control (added/removed admin roles, modified role hierarchy)
- Removed safety checks (validation removed, bounds check removed)
- Changed storage type (`temporary` → `persistent` or vice versa) — TTL semantics differ
- Added/removed functions (new attack surface or missing safety functions)

### 3b. New Attack Surface from Divergence

For each modification:
- Does the change introduce a NEW vulnerability not in the parent?
- Does the change REMOVE a parent fix/mitigation?
- Does the change create an INCONSISTENCY with parent's invariants?
- **Does the change break assumptions that other unchanged code relies on?** (e.g., parent assumes admin is always set; fork adds ability to clear admin)

---

## 4. Output to meta_buffer.md

Append to `{SCRATCHPAD}/meta_buffer.md`:

```markdown
## Fork Ancestry Analysis

### Detected Parents
| Parent | Confidence | Patterns Found | soroban-sdk Version |
|--------|-----------|---------------|---------------------|

### Inherited Vulnerabilities to Verify
| # | Parent Issue | Severity | Location in Fork | Status |
|---|-------------|----------|------------------|--------|
| 1 | {issue} | {severity} | {fork location: file:line} | CHECK / VERIFIED_SAFE / VULNERABLE |

### Fork Divergences (Security-Critical)
| # | Component | Change Type | Change Description | New Risk? |
|---|-----------|------------|-------------------|-----------|
| 1 | {component} | AUTH / STORAGE_KEY / EXTERNAL_ADDRESS / TOKEN_INTERFACE / MATH / OTHER | {what changed} | YES/NO/CHECK |

### soroban-sdk Version Vulnerabilities
| Version | Known Issue | Applicable? |
|---------|-----------|-------------|
| {version from Cargo.toml} | {known issue for this version} | YES/NO |

### Questions for Breadth Agents
1. {derived from inherited vulnerabilities}
2. {derived from divergence analysis}
3. {derived from external address changes}
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Detect Fork Indicators | YES | | |
| 2. Query Known Parent Issues | IF parent detected | | |
| 2d. Hardcoded Known-Issue Floor | IF Solodit+Tavily both fail | | |
| 3. Divergence Analysis | IF parent detected | | |
| 3a. Authorization Changes | IF parent detected | | |
| 3a. Storage Key Changes | IF parent detected | | |
| 3a. External Contract Address Changes | IF parent detected | | |
| 3a. Token Interface Changes | IF fork changes token model | | |
| 4. Output to meta_buffer.md | YES | | |

### Cross-Reference Markers

**After Step 1**: If `soroban-sdk` version detected -> check against known SDK version vulnerabilities immediately.

**After Step 3a (Authorization)**: Feed changed/removed `require_auth` calls to breadth agents for targeted re-analysis of all state-modifying functions.

**After Step 3a (Storage Key)**: Feed changed key definitions to depth-state-trace for ghost state and privilege bypass analysis.

**After Step 3a (External Address)**: Feed new external call targets to EXTERNAL_PRECONDITION_AUDIT skill for address validation audit.
