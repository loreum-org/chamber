---
name: "fork-ancestry"
description: "Trigger Pattern Always (run during recon TASK 0, not breadth) - Inject Into Recon agent only (meta_buffer.md enrichment)"
---

# FORK_ANCESTRY Skill (Solana)

> **Trigger Pattern**: Always (run during recon TASK 0, not breadth)
> **Inject Into**: Recon agent only (meta_buffer.md enrichment)
> **Finding prefix**: `[FA-N]`
> **Purpose**: Detect known parent Solana programs and inherit their historical vulnerability patterns.

---

## 1. Detect Fork Indicators

Grep the codebase for known parent Solana program signatures:

| Parent Project | Detection Patterns | Common Forks |
|---------------|-------------------|--------------|
| Marinade | `marinade\|mSOL\|StakePool\|stake_deposit\|liquid_unstake\|marinade_finance\|DepositStakeAccount\|LiquidUnstake` | Liquid staking forks |
| Jupiter | `jupiter\|jup\|swap_route\|route_plan\|shared_accounts_route\|SharedAccountsRoute\|ExactOutRoute\|jupiter_aggregator` | DEX aggregator forks |
| Orca/Whirlpool | `whirlpool\|tick_array\|sqrt_price\|position_bundle\|open_position\|increase_liquidity\|orca_whirlpools\|WhirlpoolConfig` | Concentrated liquidity forks |
| Raydium | `raydium\|amm\|open_book\|pool_state\|RaydiumCpSwap\|initialize_pool\|swap_base_in\|raydium_amm_v3` | AMM/DEX forks |
| Curve StableSwap | `stable_swap\|stableswap\|get_d\|get_y\|ramp_a\|stop_ramp_a\|A_PRECISION\|RATE_MULTIPLIER\|calc_withdraw_one_coin\|remove_liquidity_imbalance\|get_virtual_price\|admin_fee\|saber\|mercurial` | StableSwap AMM forks (Saber, Mercurial) — **set STABLESWAP_FORK flag if MEDIUM+ confidence** |
| marginfi | `marginfi\|bank\|lending_account\|MarginfiGroup\|marginfi_account\|LendingAccountDeposit\|LendingAccountBorrow` | Lending protocol forks |
| Drift | `drift\|perp\|spot_market\|user_account\|fill_order\|DriftState\|place_perp_order\|settle_pnl\|drift_program` | Perpetuals/trading forks |
| Solend/Save | `solend\|save\|obligation\|reserve\|refresh_reserve\|LendingMarket\|init_obligation\|deposit_reserve_liquidity` | Lending forks |
| Mango Markets | `mango\|MangoAccount\|PerpMarket\|Serum3\|mango_v4\|TokenIndex\|health_check` | Trading platform forks |
| SPL Stake Pool | `StakePool\|ValidatorList\|deposit_stake\|withdraw_stake\|update_validator_list_balance\|spl_stake_pool` | Staking pool forks |
| Meteora | `meteora\|dlmm\|dynamic_amm\|bin_array\|LbPair\|add_liquidity_by_strategy\|claim_fee` | Dynamic liquidity forks |
| Phoenix | `phoenix\|PhoenixMarket\|seat\|limit_order\|cancel_all_orders\|phoenix_v1` | Order book DEX forks |
| Kamino | `kamino\|strategy\|whirlpool_strategy\|rebalance\|KaminoVault\|deposit_and_invest` | Yield vault forks |
| Anchor (framework) | `anchor-lang\|#\[program\]\|#\[derive\(Accounts\)\]\|anchor_spl\|anchor_lang::prelude` | Most Solana programs (check version) |

**Also check**:
- `Cargo.toml` dependencies for parent crate names (e.g., `marinade-sdk`, `jupiter-sdk`, `whirlpool-cpi`)
- Import paths in Rust source: `use marinade_finance::`, `use drift::`, etc.
- IDL files for instruction/account names matching parent programs
- Anchor version in `Cargo.toml` (`anchor-lang = "X.Y.Z"`) - known vulnerabilities per version

**Git-based detection** (complements code-pattern matching — catches forks that renamed all identifiers).
Skip if `REPO_SHAPE: squashed_import` in `build_status.md` — single-commit repos have no meaningful git metadata.
- Parse `.gitmodules` for submodule URLs pointing to known parent repos
- Check `git remote -v` for origin URLs matching known Solana parent organizations (solana-labs, project-serum, marinade-finance, drift-labs, jito-foundation, orca-so, raydium-io, metaplex-foundation)
- If a git-URL match is found but NO code-pattern match exists, flag as `GIT_ONLY_FORK`

**Output**: List of detected parents with confidence level:
- **HIGH**: 3+ unique patterns matched, OR parent crate in Cargo.toml dependencies
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
  keywords="{parent_name} solana",
  impact=["HIGH", "CRITICAL"],
  language="Rust",
  quality_score=3,
  sort_by="Quality",
  max_results=15
)
// Query 2: Fork-specific divergence issues
search_solodit_live(
  keywords="{parent_name} fork modified anchor",
  impact=["HIGH", "MEDIUM"],
  language="Rust",
  sort_by="Rarity",
  max_results=10
)
```

### 2b. Tavily Search
```
tavily_search(query="{parent_name} solana program vulnerability exploit audit finding 2024 2025 2026")
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

If Solodit AND Tavily BOTH fail, use this minimum catalog - check EACH applicable parent.

This floor is keyed on the parent's **TYPE** (generic mechanism), NOT on any
specific protocol name — brand-keyed rows are prohibited (a floor row naming a
specific protocol is the confirmed benchmark-contamination vector; see the HARD
no-overfit rule). Classify the detected parent (from Section 1) into a type
below and check the generic known-issue class; use at most one illustrative
brand only in prose, never as the row key.

| Parent Type | Critical Known Issue | Root Cause | Search Keywords |
|--------|---------------------|------------|-----------------|
| Liquid staking pool (validator-list model) | Validator list manipulation via stake deposit ordering | Stake account priority ordering bypass | `liquid staking pool validator stake deposit ordering exploit` |
| Concentrated-liquidity AMM (tick-array model) | Tick array boundary crossing precision loss | sqrt_price calculation at tick boundaries | `concentrated liquidity amm tick boundary precision sqrt` |
| Lending market (obligation/reserve model) | Obligation refresh staleness + liquidation racing | Reserve refresh not enforced before liquidation | `lending market obligation refresh stale liquidation race` |
| Lending market (pooled-bank model) | Bank balance desync via flash loan deposit/withdraw | Balance tracking diverges from actual token balance | `lending market bank balance flash loan desync exploit` |
| Perpetuals/derivatives market (oracle-based liquidation) | Oracle staleness in liquidation + market close edge cases | Stale oracle enables unfair liquidation | `perpetuals market oracle stale liquidation exploit` |
| Perpetuals/derivatives DEX (thin-liquidity oracle) | Token balance manipulation via flash loans | Price oracle manipulation via concentrated liquidity positions | `perpetual dex thin liquidity oracle manipulation exploit` |
| Delegated stake pool (SPL-style) | Validator list index manipulation + reward fee timing | Validator removal during reward distribution | `delegated stake pool validator reward timing exploit` |
| Anchor (framework) | Version-specific: v0.24 discriminator collision, v0.27 init_if_needed re-init | Account type confusion via shared discriminator prefix | `anchor discriminator collision init_if_needed` |
| Dynamic-liquidity AMM (bin-based model) | Bin price precision at extreme ranges + reward calculation | Bin boundary arithmetic overflow at extreme prices | `bin-based amm price overflow precision extreme range` |

---

## 3. Divergence Analysis

For each detected parent:

### 3a. Identify What Changed

Compare fork vs parent in security-critical paths:

| Component | Parent Behavior | Fork Behavior | Security Impact |
|-----------|----------------|---------------|-----------------|
| {component} | {original} | {modified or SAME} | {new risk or NONE} |

**Solana-specific divergence focus areas** (ordered by criticality):

#### Account Validation Changes (HIGHEST PRIORITY)
- Did the fork add or remove account constraints (`has_one`, `constraint`, `seeds`, `owner`)?
- Did the fork switch between `Account<T>` (auto-validated) and `UncheckedAccount` (manual validation)?
- Did the fork change signer requirements on any instruction?
- Missing owner/type/signer checks are the **#1 Solana vulnerability class**.

#### CPI Target Changes
- Did the fork change which programs are called via CPI?
- Are new CPI targets validated with program ID checks?
- Did the fork add CPI calls to programs not in the parent? (New external dependency = new attack surface)
- **Critical**: CPI without program ID validation = attacker can substitute a malicious program.

#### PDA Seed Changes
- Did the fork modify PDA seed schemas (different seeds, different order, added/removed seeds)?
- Changed seeds can cause: PDA collision (two different logical entities map to same address), PDA inaccessibility (legitimate accounts unreachable with new seeds), authority bypass (PDA used as signer with different derivation).
- Check: are seed derivations consistent between creation and usage across all instructions?

#### Token-2022 Additions
- Did the fork add Token-2022 (`spl_token_2022`) support where parent used SPL Token only?
- Extension handling is complex: transfer hooks, transfer fees, confidential transfers, permanent delegate.
- Check: does the fork handle ALL extensions the token might have? Or only a subset?
- **Critical**: Transfer hook extensions can execute arbitrary code during transfers.

#### Other Divergence Areas
- Modified mathematical formulas (fee calculations, exchange rates, reward distribution)
- **Parameter semantic verification**: When the parent has a mathematical specification, verify that each core parameter carries the same mathematical meaning in the fork — not just the same name and numeric range. Forks may store a raw value where the parent stores a derived form (e.g., raw coefficient vs. coefficient scaled by a function of pool dimensions). Compare the fork's formula usage against the parent's specification to confirm the encoding convention matches.
- Changed access control (added/removed authorities, modified role hierarchy)
- Removed safety checks (validation removed, constraint removed)
- Changed account data layouts (fields reordered, types changed, sizes changed)
- Added/removed instructions (new attack surface or missing safety instructions)

### 3b. New Attack Surface from Divergence

For each modification:
- Does the change introduce a NEW vulnerability not in the parent?
- Does the change REMOVE a parent fix/mitigation?
- Does the change create an INCONSISTENCY with parent's invariants?
- **Does the change break assumptions that other unchanged code relies on?** (e.g., parent assumes PDA X always exists; fork adds ability to close PDA X)

---

## 4. Output to meta_buffer.md

Append to `{SCRATCHPAD}/meta_buffer.md`:

```markdown
## Fork Ancestry Analysis

### Detected Parents
| Parent | Confidence | Patterns Found | Anchor Version |
|--------|-----------|---------------|----------------|

### Inherited Vulnerabilities to Verify
| # | Parent Issue | Severity | Location in Fork | Status |
|---|-------------|----------|------------------|--------|
| 1 | {issue} | {severity} | {fork location: file:line} | CHECK / VERIFIED_SAFE / VULNERABLE |

### Fork Divergences (Security-Critical)
| # | Component | Change Type | Change Description | New Risk? |
|---|-----------|------------|-------------------|-----------|
| 1 | {component} | ACCOUNT_VALIDATION / CPI_TARGET / PDA_SEED / TOKEN_2022 / OTHER | {what changed} | YES/NO/CHECK |

### Anchor Version Vulnerabilities
| Version | Known Issue | Applicable? |
|---------|-----------|-------------|
| {version from Cargo.toml} | {known issue for this version} | YES/NO |

### Questions for Breadth Agents
1. {derived from inherited vulnerabilities}
2. {derived from divergence analysis}
3. {derived from CPI target changes}
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Detect Fork Indicators | YES | | |
| 2. Query Known Parent Issues | IF parent detected | | |
| 2d. Hardcoded Known-Issue Floor | IF Solodit+Tavily both fail | | |
| 3. Divergence Analysis | IF parent detected | | |
| 3a. Account Validation Changes | IF parent detected | | |
| 3a. CPI Target Changes | IF parent detected | | |
| 3a. PDA Seed Changes | IF parent detected | | |
| 3a. Token-2022 Additions | IF fork adds Token-2022 | | |
| 4. Output to meta_buffer.md | YES | | |

### Cross-Reference Markers

**After Step 1**: If Anchor version detected -> check against known Anchor version vulnerabilities immediately.

**After Step 3a (Account Validation)**: Feed changed/removed constraints to ACCOUNT_VALIDATION skill for targeted re-analysis.

**After Step 3a (CPI Target)**: Feed new CPI targets to CPI_SECURITY skill for program ID validation audit.

**After Step 3a (PDA Seed)**: Feed changed seeds to PDA_SECURITY skill for collision/derivation audit.
