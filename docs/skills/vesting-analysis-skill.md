# Vesting & Distribution Analysis Skill

## Purpose
Analyze token allocation, unlock schedules, and holder concentration risk.

## Inputs
- Token contract address (required)
- Network/chain (required)

## Loop 1 — Allocation categories mapping
Categorize all known allocations:

**Core Team & Founders**
- Vesting start date
- Total granted quantity
- Cliff periods (e.g., 12 months)
- Vesting duration (e.g., 48 months)
- Unlock schedule (monthly/quarterly/milestone)
- Current unlocked %

**Investors & Advisors**
- Seed round allocations
- Strategic investors
- Advisory token grants
- Vesting terms similar to founders or shorter

**Protocol Treasury**
- Protocol-controlled tokens
- Multisig wallet addresses
- Unlock schedule (if any)
- Governance parameters

**Community & Airdrop**
- Early participant rewards
- User acquisition tokens
- Airdrop distributions
- Linear vesting (if any)

**Ecosystem & Liquidity**
- DEX Liquidity mining rewards
- Liquidity mining pools
- Liquidity farmer rewards
- Unbonding liquidity tokens

**Enterprise & Partnerships**
- Strategic partnerships rewards
- Integration incentives
- Partner rewards

## Data Collection

**On-Chain Sources**
- Etherscan token holder page (top holders)
- Custom GraphQL queries for large holders
- Vesting contract inspections
- Smart contract source reading

**Off-Chain Sources**
- Whitepapers and tokenomics docs
- Discord/Telegram announcements
- Official press releases
- GitHub repository token distribution plans
- Legal agreements (if available)

## Loop 2 — Vesting schedule extraction
For each category, document:

- Initial token grant
- Vesting start date (TGE)
- Cliff duration
- Monthly/quarterly/monthly unlock schedule
- Milestone-based vesting (if any)
- Any unlock accelerations/retts
- Any clawback provisions

Tools:
- Dune Analytics for vesting contracts
- Custom block explorers for vesting data
- Documentation parsing
- Smart contract inspection

## Loop 3 — Holder concentration analysis
Collect top holder distribution:

**Top 10 Holders**
- Wallet address(es)
- Percentage of circulating supply
- Classification (exchange, treasury, team, unknown)
- Unlock status (released, locked, vesting)

**Top 100 Holders**
- Distribution across these holders
- Concentration score (CR10, CR20)
- Exchange concentration (CEX vs DEX)

**Unknown Wallets**
- Significant holdings not classified
- Potential team holdings without disclosure

## Output contract
Emit vesting and distribution analysis:
```
### Vesting & Distribution Analysis Report

**Overall Distribution:**
- Total Supply: <total>
- Circulating Supply: <circulating>
- Concentration CR10: <percentage>%
- CR20: <percentage>%
- Exchange Concentration: <CEX/DEX split>

**Allocation Categories:**
- Team & Founders: <unlock %>/total
- Investors: <unlock %>/total
- Treasury: <allocated>
- Community: <allocated>
- Liquidity: <allocated>

**Vesting Status (Next 12 Months):**
- Monthly unlocks: <dates>
- Quarterly unlocks: <dates>
- Significant unlocks (>1M tokens): <list>

**Concentration Risk:**
- Top Holder Risk: <high/medium/low>
- Exchange Risk: <high/medium/low>
- Team Lockup Risk: <high/medium/low>

**Vesting Depletion Risk:**
- Next 6mo risk rating: <high/medium>
- Near-term dump pressure: <estimate>

**Recommendation:** <PROCEED/FLAG>
```