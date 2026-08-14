---
name: "fork-ancestry"
description: "Trigger Pattern Always (run during recon TASK 0, not breadth) - Inject Into Recon agent only (meta_buffer.md enrichment)"
---

# FORK_ANCESTRY Skill -- Aptos

> **Trigger Pattern**: Always (run during recon TASK 0, not breadth)
> **Inject Into**: Recon agent only (meta_buffer.md enrichment)
> **Purpose**: Detect known parent codebases and inherit their historical vulnerability patterns.

## 1. Detect Fork Indicators

Grep the codebase for known parent signatures:

| Parent Project | Detection Patterns | Common Forks |
|---------------|-------------------|--------------|
| Thala | `thala\|thalaswap\|move_staking\|thala_manager\|stability_pool\|mod_coin` | Stableswap/staking forks |
| Echelon | `echelon\|lending_pool\|borrow_pool\|echelon_market\|lending_config` | Lending protocol forks |
| Aries | `aries\|aries_market\|margin_trade\|aries_profile` | Margin trading forks |
| Aptos Framework Staking | `delegation_pool\|stake_pool\|validator_set\|staking_config` | Delegation/staking forks |
| Liquidswap | `liquidswap\|curves\|liquidity_pool\|coin_helper\|lp_coin` | DEX forks (Pontem) |
| Curve StableSwap | `stable_swap\|stableswap\|get_d\|get_y\|ramp_a\|stop_ramp_a\|A_PRECISION\|RATE_MULTIPLIER\|calc_withdraw_one_coin\|remove_liquidity_imbalance\|get_virtual_price\|admin_fee\|pontem_stable` | StableSwap AMM forks — **set STABLESWAP_FORK flag if MEDIUM+ confidence** |
| Pancakeswap | `pancake\|masterchef\|smart_router\|pancakeswap\|cake_token` | Yield farming forks |
| Amnis Finance | `amnis\|amnis_staking\|amapt\|stapt\|amnis_router` | Liquid staking forks |
| Cellana Finance | `cellana\|ve_token\|gauge\|voter\|bribe` | ve(3,3) / gauge forks |
| Merkle Trade | `merkle\|trading\|pnl_manager\|fee_distributor\|merkle_trading` | Perp DEX forks |
| Aptos Names (ANS) | `aptos_names\|domains\|ans_v2\|name_service` | Name service forks |
| Tortuga | `tortuga\|staked_aptos\|tortuga_staking\|tAPT` | Liquid staking forks |
| Ditto | `ditto\|ditto_staking\|staked_coin\|ditto_vault` | Liquid staking/vault forks |
| Aptos Token V2 / Digital Assets | `token::TokenV2\|collection\|aptos_token\|digital_asset` | NFT/token standard forks |
| Aptos Fungible Asset Framework | `fungible_asset\|FungibleStore\|FungibleAsset\|primary_fungible_store` | FA standard consumers |
| Pendleswap (Aptos) | `pendle\|pendleswap\|sy_token\|pt_token\|yt_token\|market_factory` | Yield tokenization forks |

**Git-based detection** (complements code-pattern matching — catches forks that renamed all identifiers).
Skip if `REPO_SHAPE: squashed_import` in `build_status.md` — single-commit repos have no meaningful git metadata.
- Parse `.gitmodules` for submodule URLs pointing to known parent repos
- Check `git remote -v` for origin URLs matching known Aptos parent organizations (aptos-labs, econia-labs, pontem-network, thala-labs, pancakeswap)
- If a git-URL match is found but NO code-pattern match exists, flag as `GIT_ONLY_FORK`

**Output**: List of detected parents with confidence level (HIGH: 3+ patterns, MEDIUM: 2 patterns, LOW: 1 pattern, GIT_ONLY: git URL match but no code patterns).

## 2. Query Known Parent Issues

For each detected parent (confidence MEDIUM or HIGH):

### 2a. Solodit Search (two queries, run in parallel)
```
// Query 1: Known high-quality issues
search_solodit_live(
  protocol="{parent_name}",
  impact=["HIGH", "CRITICAL"],
  language="Move",
  quality_score=3,
  sort_by="Quality",
  max_results=15
)
// Query 2: Rare/unusual patterns specific to fork divergences
search_solodit_live(
  keywords="{parent_name} fork modified divergence aptos move",
  impact=["HIGH", "MEDIUM"],
  language="Move",
  sort_by="Rarity",
  max_results=10
)
```

### 2b. Tavily Search
```
tavily_search(query="{parent_name} aptos move smart contract vulnerability exploit audit finding 2024 2025 2026")
```

### 2c. Known Issue Catalog

Compile results into:

| Parent | Known Issue | Severity | Root Cause | Solodit Ref | Applicable to Fork? |
|--------|-----------|----------|------------|-------------|---------------------|
| {parent} | {issue title} | {severity} | {brief root cause} | {link/ID} | YES / NO / CHECK |

**Applicability criteria**:
- YES: Fork retains the vulnerable code path unchanged
- NO: Fork modified the vulnerable code path (document what changed)
- CHECK: Cannot determine without deeper analysis (flag for breadth agent)

### 2d. Hardcoded Known-Issue Floor (Web Search Fallback)
If Solodit AND Tavily BOTH fail, use this minimum catalog -- check EACH applicable parent type:

This floor is keyed on the parent's **TYPE** (generic mechanism), NOT on any
specific protocol name — brand-keyed rows are prohibited (a floor row naming a
specific protocol is the confirmed benchmark-contamination vector; see the HARD
no-overfit rule). Classify the detected parent into a type below and check the
generic hazard class; use at most one illustrative brand only in prose, never
as the row key.

| Parent Type | Critical Known Issue | Root Cause | Search Keywords |
|--------|---------------------|------------|-----------------|
| Stableswap / stability pool (AMM) | Share manipulation on first deposit (e.g. Thala-class stability pools) | Empty-pool rounding in share calculation | `aptos move stableswap stability pool first deposit share manipulation` |
| AMM / liquidity pool (constant-product, e.g. Liquidswap-class) | LP token inflation via small initial liquidity | Missing or insufficient MINIMUM_LIQUIDITY-equivalent floor | `aptos move lp token inflation first liquidity minimum` |
| DEX yield farm (Aptos) | Reward rate manipulation via zero-amount deposit | Checkpoint timing + zero-amount triggers reward update | `masterchef aptos deposit zero reward` |
| Liquid staking token (LST) | Exchange-rate staleness between LST and underlying; reward-distribution timing arbitrage | Discrete update timing allows entry at a stale rate, or reward-distribution timing creates an extractable arbitrage window | `aptos liquid staking exchange rate staleness reward timing arbitrage` |
| Aptos Framework Staking | Delegation pool unlock timing + commission rate change | Validator can change commission before pending unlock completes | `delegation pool commission unlock timing aptos` |
| Lending / money market | Oracle price staleness in liquidation path | Stale price allows unfair liquidation or avoids valid liquidation | `aptos lending oracle staleness liquidation` |
| Vote-escrowed (ve) governance / gauge | Vote-escrowed token lock bypass via gauge interaction | ve token accounting inconsistency during gauge deposit/withdraw | `aptos ve token lock gauge bypass` |
| Aptos Fungible Asset Framework | Ref capability leak via public friend function | MintRef/TransferRef/BurnRef exposed through insufficiently restricted public(friend) function | `fungible asset ref capability leak public friend` |
| Aptos Token V2 | Object ownership transfer bypassing royalty enforcement | Token transfer via object::transfer bypasses marketplace royalty hooks | `aptos token v2 royalty bypass transfer` |

**Note**: This floor lists generic hazard CLASSES by parent type only — minimum
coverage, not exhaustive, and not a substitute for live Solodit/Tavily research
(2a/2b).

## 3. Divergence Analysis

For each detected parent:

### 3a. Identify What Changed

Compare fork vs parent in security-critical paths:

| Component | Parent Behavior | Fork Behavior | Security Impact |
|-----------|----------------|---------------|-----------------|
| {component} | {original} | {modified or SAME} | {new risk or NONE} |

Focus on:
- Modified access control (changed signer requirements, added/removed friend declarations)
- Changed mathematical formulas (fee calculations, exchange rates, reward distribution)
- **Parameter semantic verification**: When the parent has a mathematical specification, verify that each core parameter carries the same mathematical meaning in the fork — not just the same name and numeric range. Forks may store a raw value where the parent stores a derived form (e.g., raw coefficient vs. coefficient scaled by a function of pool dimensions). Compare the fork's formula usage against the parent's specification to confirm the encoding convention matches.
- Added external dependencies (new oracles, new CPI targets, new coin types)
- Removed safety checks (assertions removed, type constraints relaxed)
- Changed Ref storage patterns (different access control on stored MintRef/BurnRef/TransferRef)
- Module upgrade policy changes (parent `immutable` -> fork `compatible`, or vice versa)
- Generics changes (parent uses concrete types -> fork uses generics, or vice versa)

### 3b. New Attack Surface from Divergence

For each modification:
- Does the change introduce a NEW vulnerability not in the parent?
- Does the change REMOVE a parent fix/mitigation?
- Does the change create an INCONSISTENCY with parent's invariants?
- Does the change alter the Ref lifecycle (e.g., storing a Ref the parent consumed immediately)?

## 4. Output to meta_buffer.md

Append to `{SCRATCHPAD}/meta_buffer.md`:

```markdown
## Fork Ancestry Analysis

### Detected Parents
| Parent | Confidence | Patterns Found |
|--------|-----------|---------------|

### Inherited Vulnerabilities to Verify
| # | Parent Issue | Severity | Location in Fork | Status |
|---|-------------|----------|------------------|--------|
| 1 | {issue} | {severity} | {fork location} | CHECK / VERIFIED_SAFE / VULNERABLE |

### Fork Divergences (Security-Critical)
| # | Component | Change | New Risk? |
|---|-----------|--------|-----------|

### Questions for Breadth Agents
1. {derived from inherited vulnerabilities}
2. {derived from divergence analysis}
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Detect Fork Indicators | YES | Y/N/? | |
| 2. Query Known Parent Issues | IF parent detected | Y/N(no parent)/? | |
| 3. Divergence Analysis | IF parent detected | Y/N(no parent)/? | |
| 4. Output to meta_buffer.md | YES | Y/N/? | |
