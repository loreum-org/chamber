# Protocol Utility Analysis Skill

## Purpose
Analyze token utility within the protocol — demand drivers and token requirements.

## Inputs
- Token contract address (required)
- Network/chain (required)
- Protocol documentation (recommended: web3, docs, whitepaper)

## Loop 1 — Use case identification
Identify all reasons someone would need the token:

**Governance Use Cases**
- Protocol governance votes
- DAO proposals
- Community treasury decisions
- Protocol parameter changes
- Upgrades/contributions

**Staking/Earning Use Cases**
- Native staking rewards
- Liquidity mining rewards
- Protocol fee sharing
- Yield farming rewards
- Revenue sharing

**Access Use Cases**
- Protocol service access
- Trading fee discounts
- Premium features
- Exclusive protocol features
- Membership tiers

**Collateral Use Cases**
- Debt collateral
- Credit line backing
- Insurance collateral
- Leverage provision
- Portfolio collateral

**Utility/Purpose Use Cases**
- Transaction gas payments
- Smart contract interactions
- Resource usage payments
- Storage fees
- Computation fees

## Loop 2 — Token requirement analysis
Analyze how token is required within protocol:

**Required Tokens**
- Absolute requirement (cannot use protocol without tokens)
- Semi-requirement (recommended but not required)
- Optional utility (nice-to-have)

**Token Usage Examples**
- Example 1: How Token X is used in protocol flow 1
- Example 2: How Token Y is used in protocol flow 2
- Example 3: How Token Z is used in protocol flow 3

**Integration Points**
- Front-end (UI)
- Smart contracts
- Oracles
- DeFi integrations
- Bridge integrations

## Loop 3 — Demand estimation
Estimate token demand sources:

**Natural Demand**
- Protocol users (number of active users)
- Transaction fees earned (if fixed fee)
- Staking participation rate
- Protocol revenue sharing rate
- User growth projections

**Incentive Demand**
- Liquidity mining programs
- Staking APY
- Trading fee sharing (if any)
- Referral programs
- Partnership incentives

**External Demand**
- Secondary trading demand
- Speculative demand
- Airdrop eligibility
- NFT/accessory demand
- Treasury holdings demand

## Loop 4 — Utility alignment analysis
Analyze how token aligns with protocol goals:

**Alignment Assessment**
- Governance & Community: <aligned/partially-disaligned/disconnected>
- Economic Incentives: <aligned/partially-disaligned/disconnected>
- Access & Usage: <aligned/partially-disaligned/disconnected>
- Revenue Model: <aligned/partially-disaligned/disconnected>
- Long-term Value: <aligned/partially-disaligned/disconnected>

**Tokenomics-Design Fit**
- Inflation vs. Utility demand: <match/mismatch>
- Supply sustainability: <sustainable/marginal/insufficient>
- Utility vs. Distribution: <aligned/mismatch>

## Loop 5 — Use case documentation
Document all identified use cases:

**Use Case 1: Governance**
- Description: <token used for protocol governance>
- Usage frequency: <daily/weekly/monthly>
- Financial impact: <value>

**Use Case 2: Staking**
- Description: <token used for earning rewards>
- Usage frequency: <daily/weekly/monthly>
- Financial impact: <value>

**Use Case 3: Access**
- Description: <token required for protocol access>
- Usage frequency: <daily/weekly/monthly>
- Financial impact: <value>

**Use Case 4: Treasury**
- Description: <token held by protocol treasury>
- Usage frequency: <as needed>
- Financial impact: <value>

## Output contract
Emit protocol utility analysis:
```
### Protocol Utility Analysis Report

**Use Case Analysis:**

**Use Case 1: Governance**
- Purpose: <governance/elect/casting_voting>
- Frequency: <daily/weekly/monthly>
- Financial Impact: $<value>/year
- Requirement: <required/optional/recommended>

**Use Case 2: Staking/Earning**
- Purpose: <staking/liquidity_rewards/feesharing>
- Frequency: <daily/weekly/monthly>
- Financial Impact: $<value>/year
- Requirement: <required/optional/recommended>

**Use Case 3: Access**
- Purpose: <protocol_access/premium_features>
- Frequency: <daily/weekly/monthly>
- Financial Impact: $<value>/year
- Requirement: <required/optional/recommended>

**Use Case 4: Treasury**
- Purpose: <protocol_treasury/assets_peg>
- Frequency: <as_needed>
- Financial Impact: $<value>
- Requirement: <required/optional/recommended>

**Advanced Use Cases:**
- Use Case 5: <if_identified>
- Use Case 6: <if_identified>

**Demand Drivers:**
- Protocol Users: <number>
- Staking Participants: <percentage>
- Revenue Share Percentage: <percentage>%
- Fee Discount Rate: <percentage>% if applicable

**Utility Alignment:**
- Governance Utility: <aligned/partially-disaligned>
- Economic Incentives: <aligned/partially-disaligned>
- Access Requirements: <aligned/partially-disaligned>
- Revenue Model: <aligned/partially-disaligned>

**Token Requirement Classification:**
- Absolute Required: <count>
- Semi-Required: <count>
- Optional: <count>

**Demand Sustainability:**
- Organic Demand Sources: <list>
- Incentive-Driven Demand: <list>
- External Market Demand: <list>
- Demand Quality: <sustainable/incentivized/autonomous>

**Integration Maturity:**
- Smart Contract Integration: <mature/mid-stage/early>
- Front-end Integration: <mature/mid-stage/early>
- Oracle Integration: <mature/mid-stage/early>

**Recommendations:**
- Utility Integration: <strong/moderate/weak>
- Use Case Maturity: <mature/innovative/isolated>
- Value Proposition: <strong/compelling>

**Risk Factors:**
- Utility Concentration: <high/medium/low>
- Use Case Dependency: <high/medium/low>
- Market Dependency: <high/medium/low>

**Market Positioning:**
- Governance Function: <active/weak/incomplete>
- Staking Utility: <active/weak/incomplete>
- Revenue Integration: <active/weak/incomplete>

**Next Steps:**
- Monitoring Frequency: <weekly/monthly>
- Key Metrics: <track protocol_user_growth>, <monitor_staking_participation>, <analyze_token_utility_impact>

**Recommendation:** <PROCEED/FLAG>
```