# Holder Analysis Skill

## Purpose
Analyze token holder distribution and concentration risk.

## Inputs
- Token contract address (required)
- Network/chain (required)

## Loop 1 — Top holder extraction
Collect the largest token holders:

**Top 10 Holders (on-chain data)**
- Wallet addresses
- Percentage of circulating supply
- Classification (team, treasury, CEX, unknown, foundation)
- Unlock status (current release schedule)
- Vesting expiry (if applicable)

**Top 100 Holders**
- Distribution across top 100 wallets
- Concentration metrics (CR10, CR20)
- Exchange vs. non-exchange split
- Known vs. unknown wallets

**Whale Tracking**
- Identified whales (>0.1% of supply)
- Historical movement patterns
- Velocity analysis (changes per 30d)
- Potential dump risk assessment

## Loop 2 — Classification and attribution
Classify holders by entity type:

**Exchange Wallets**
- Binance Hot Wallets
- Coinbase Custody
- Kraken Institutional
- Bybit Wallets
- Total Exchange Holdings

**Treasury Wallets**
- Protocol Treasury (multisig)
- Foundation Wallets
- Sponsor Funds
- DAO Treasury

**Team & Insider Wallets**
- Team allocations
- Advisors
- Angel investors
- Ecosystem founders
- Vesting status summary

**Community Wallets**
- Airdrop recipients
- User holders
- Community treasury

**Unknown Wallets**
- Mining pool holdings
- Liquidity mining rewards
- Unknown origins

## Loop 3 — Movement and velocity analysis
Collect on-chain movement patterns:

**Movement Frequency**
- Transfers per day/week
- Large vs. small transfers
- New wallet acquisitions vs. transfers
- Exchange inflow/outflow patterns

**Velocity Metrics**
- Token circulation rate
- Supply circulation time
- Unrealized selling pressure
- Historical transaction velocity trends

**Suspicious Patterns**
- Pump and dump indicators
- Coordinated movements
- Exchange concentration changes
- Unusual token creation/burning

## Data Sources
- Etherscan Token Holder Page (direct)
- Dune Analytics custom queries (for large datasets)
- GraphQL APIs (The Graph for token holders)
- Arkham Intelligence (entity mapping)
- Nansen (whale tracking)

## Output contract
Emit holder analysis:
```
### Holder Analysis Report

**Top 10 Holders:**
- Individual Holder 1: <addr>, <percentage>%, <type>, <status>
- Individual Holder 2: <addr>, <percentage>%, <type>, <status>
- (total <topX> concentration: <percentage>%%)

**Top 100 Holders Distribution:**
- Exchange Holdings: <percentage>%
- Treasury Holdings: <percentage>%
- Team Holdings: <percentage>%
- Community Holdings: <percentage>%
- Unknown Holdings: <percentage>%

**Concentration Metrics:**
- CR10: <percentage>%
- CR20: <percentage>%
- CR30: <percentage>%
- Gini Coefficient: <value>

**Vesting & Lock-up Status:**
- Vested >1M Tokens: <count>
- Vesting Expiry: <dates>
- Potential Near-Term Unlocks: <schedule>

**Movement Analysis:**
- 30d Transfer Volume: <amount>
- Exchange Net Flow: <inflow/outflow>
- Velocity: <tokens per day>
- Historical Trend: <stable/increasing/decreasing>

**Whale Activity:**
- Number of Whales (>0.1%): <count>
- Top 5 Whales' % Holdings: <percentage>%

**Risk Assessment:**
- Concentration Risk: <high/medium/low>
- Sell Pressure Risk: <high/medium/low>
- Manipulative Risk: <high/medium/low>

**Recommendations:**
- Holder Quality: <organic/incentivized/manipulated>
- Investment Suitability: <suitable/caution/risky>
- Monitoring Focus: <whales/centralization/velocity>

**Risk Flags:**
- CEX Concentration: <high/medium>
- Team Concentration: <high/medium>
- Treasury Concentration: <high/medium>

**Next Steps:**
- Monitoring Frequency: <weekly/monthly>
- Key Activities: <track large transfers>, <vesting expiry tracking>

**Recommendation:** <PROCEED/FLAG>
```