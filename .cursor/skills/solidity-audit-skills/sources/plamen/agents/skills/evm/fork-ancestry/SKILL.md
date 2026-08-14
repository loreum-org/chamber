---
name: "fork-ancestry"
description: "Trigger Pattern Always (run during recon TASK 0, not breadth) - Inject Into Recon agent only (meta_buffer.md enrichment)"
---

# FORK_ANCESTRY Skill

> **Trigger Pattern**: Always (run during recon TASK 0, not breadth)
> **Inject Into**: Recon agent only (meta_buffer.md enrichment)
> **Purpose**: Detect known parent codebases and inherit their historical vulnerability patterns.

## 1. Detect Fork Indicators

Grep the codebase for known parent signatures:

| Parent Project | Detection Patterns | Common Forks |
|---------------|-------------------|--------------|
| Synthetix | `SNX\|synthetix\|StakingRewards\|RewardsDistribution\|Issuer` | Staking rewards forks |
| Compound | `CToken\|Comptroller\|cToken\|comptroller\|InterestRateModel` | Lending protocol forks |
| Uniswap V2 | `UniswapV2\|PairFactory\|getReserves\|MINIMUM_LIQUIDITY` | DEX forks |
| Uniswap V3 | `UniswapV3\|TickMath\|SqrtPriceMath\|NonfungiblePositionManager` | Concentrated liquidity forks |
| Aave | `aToken\|LendingPool\|flashLoan.*initiator\|AAVE` | Lending forks |
| MasterChef | `MasterChef\|poolInfo\|userInfo\|pendingReward\|massUpdatePools` | Yield farming forks |
| Curve | `StableSwap\|get_dy\|A_PRECISION\|get_virtual_price\|ramp_A\|stop_ramp_A\|calc_withdraw_one_coin\|remove_liquidity_imbalance\|admin_fee\|commit_new_fee` | Stableswap forks — **set STABLESWAP_FORK flag if MEDIUM+ confidence** |
| OpenZeppelin | `Ownable\|AccessControl\|Pausable\|ERC20Upgradeable` | Most projects (check version) |
| Basis/Tomb | `Boardroom\|Treasury\|seigniorage\|epoch\|TWAP.*peg` | Algorithmic stablecoin forks |
| Olympus | `OHM\|gOHM\|staking.*rebase\|bond.*discount` | Rebase token forks |
| Balancer | `BPool\|WeightedPool\|BVault\|flashLoan.*userData` | Weighted pool forks |
| Yearn | `Vault\|Strategy\|harvest\|totalDebt\|debtRatio` | Yield vault forks |

**Git-based detection** (complements code-pattern matching — catches forks that renamed all identifiers).
Skip if `REPO_SHAPE: squashed_import` in `build_status.md` — single-commit repos have no meaningful git metadata.
- Parse `.gitmodules` for submodule URLs pointing to known parent repos
- Check `git remote -v` for origin URLs matching known parent organizations (compound-finance, Uniswap, aave, sushiswap, curvefi, yearn, OlympusDAO, balancer)
- If a git-URL match is found but NO code-pattern match exists, flag as `GIT_ONLY_FORK` — the fork likely renamed all identifiers, which warrants deeper divergence analysis

**Output**: List of detected parents with confidence level (HIGH: 3+ patterns, MEDIUM: 2 patterns, LOW: 1 pattern, GIT_ONLY: git URL match but no code patterns).

## 2. Query Known Parent Issues

For each detected parent (confidence MEDIUM or HIGH):

### 2a. Solodit Search (two queries, run in parallel)
```
// Query 1: Known high-quality issues
search_solodit_live(
  protocol="{parent_name}",
  impact=["HIGH", "CRITICAL"],
  language="Solidity",
  quality_score=3,
  sort_by="Quality",
  max_results=15
)
// Query 2: Rare/unusual patterns specific to fork divergences
search_solodit_live(
  keywords="{parent_name} fork modified divergence",
  impact=["HIGH", "MEDIUM"],
  language="Solidity",
  sort_by="Rarity",
  max_results=10
)
```

### 2b. Tavily Search
```
tavily_search(query="{parent_name} smart contract vulnerability exploit audit finding 2024 2025 2026")
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
If Solodit AND Tavily BOTH fail, use this minimum catalog -- check EACH applicable parent.

This floor is keyed on the parent's **TYPE** (generic mechanism), NOT on any
specific protocol name — brand-keyed rows are prohibited (a floor row naming a
specific protocol is the confirmed benchmark-contamination vector; see the HARD
no-overfit rule). Classify the detected parent (from Section 1) into a type
below and check the generic known-issue class; use at most one illustrative
brand only in prose, never as the row key.

| Parent Type | Critical Known-Issue Class | Root Cause | Search Keywords |
|--------------|----------------------------|------------|-----------------|
| Staking-rewards distributor | Reward-rate manipulation via reward-notification timing | Reward duration reset when a new reward is notified mid-period | `staking reward notify duration reset` |
| Lending / money-market receipt token | First-depositor exchange-rate manipulation | Empty-market rounding in the exchange-rate calc | `lending exchange rate first deposit empty market` |
| Lending / money-market liquidation engine | Flash loan + oracle manipulation for unfair liquidation | Spot-price dependency in the liquidation health check | `flash loan liquidation oracle manipulation` |
| AMM constant-product pool (LP token) | First-LP inflation attack (minimum-liquidity bypass) | LP share rounding at low liquidity | `amm minimum liquidity first LP inflation` |
| Epoch-based seigniorage / rebasing treasury | Epoch-boundary distribution front-running + stake timing | Discrete epoch distribution creates a race at the boundary | `epoch seigniorage boundary timing front-run` |
| Epoch-based treasury with operator roles | Epoch-boundary timing + treasury allocation fairness + role privilege scope | Extended epoch model with additional operator roles and cooldown mechanisms | `epoch treasury operator role cooldown` |
| Yield-farming reward distributor (checkpoint-based) | Reward-rate manipulation via zero-amount deposit + unfair early-user dilution | Checkpoint timing where a zero-amount deposit triggers a reward-rate update | `yield farming deposit zero reward rate checkpoint timing` |
| Stableswap / invariant-curve AMM | Reentrancy via raw native-token transfer in liquidity removal + read-only reentrancy | Native-token callback fires before state update; view functions read stale state during the callback | `stableswap reentrancy remove liquidity read-only` |
| AMM vault / batched-swap pool | Flash loan + price-oracle manipulation via pool-balance change | Spot price manipulated within a single transaction via balance change | `amm vault flash loan oracle manipulation balance` |
| Yield vault (share-based accounting) | Share-price manipulation via strategy-report timing + first depositor | Donation before first deposit inflates price-per-share | `vault share price first deposit donation strategy` |

**Note**: This floor lists generic known-issue CLASSES by parent type only — it
is minimum coverage, not exhaustive, and NOT a substitute for the live-searched
Solodit/Tavily results (2a/2b). Real research typically surfaces several more
issues specific to the actual parent.

## 3. Divergence Analysis

For each detected parent:

### 3a. Identify What Changed

Compare fork vs parent in security-critical paths:

| Component | Parent Behavior | Fork Behavior | Security Impact |
|-----------|----------------|---------------|-----------------|
| {component} | {original} | {modified or SAME} | {new risk or NONE} |

Focus on:
- Modified access control (added/removed roles, changed modifiers)
- Changed mathematical formulas (fee calculations, exchange rates, reward distribution)
- **Parameter semantic verification**: When the parent has a mathematical specification, verify that each core parameter carries the same mathematical meaning in the fork — not just the same name and numeric range. Forks may store a raw value where the parent stores a derived form (e.g., raw coefficient vs. coefficient scaled by a function of pool dimensions). Compare the fork's formula usage against the parent's specification to confirm the encoding convention matches.
- Added external dependencies (new oracles, new tokens, new protocols)
- Removed safety checks (validation removed, guard removed)
- Changed state variable types or visibility

### 3b. New Attack Surface from Divergence

For each modification:
- Does the change introduce a NEW vulnerability not in the parent?
- Does the change REMOVE a parent fix/mitigation?
- Does the change create an INCONSISTENCY with parent's invariants?

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
