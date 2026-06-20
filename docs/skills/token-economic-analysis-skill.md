# Token Economic Analysis Skill

## Purpose
Conduct comprehensive token economic due diligence on any ERC-20 or equivalent token. Produce an investibility assessment covering tokenomics, market dynamics, team, protocol utility, adoption, and risk factors.

## Inputs
Collect these before starting:
- Token contract address (required)
- Network/chain (required) — e.g., ethereum, base, arbitrum, solana
- Project name (required)
- Intended decision: invest, pass, monitor, deep-dive, partner

## Loop 0 — Define the research question
Write the decision being made in one sentence.

Examples:
- Should we invest in this token for treasury allocation?
- Is this token suitable for a strategic partnership?
- Should we monitor this token for future opportunity?
- Do we proceed with a deep smart contract audit?

Output:
- Decision question
- Capital at risk or strategic exposure
- Required confidence level
- Timeline/deadline

## Loop 1 — Source verification and contract confirmation
Goal: confirm you are researching the correct token, not a spoof or fork.

Steps:
1. Resolve token address via CoinGecko, CoinMarketCap, or DeFiLlama search by address
2. Confirm contract address on chain via Etherscan/Basescan/Arbiscan with verified source
3. Check token name, symbol, decimals, totalSupply against official docs
4. Verify proxy patterns or immutable implementation
5. Identify burn/mint privileges, pauser roles, upgrade authority

Tools:
- Etherscan / Basescan / Arbiscan / Snowtrace
- CoinGecko API
- DeFiLlama
- Token lists (tokenlist.io, token独自)

Output:
- Canonical token details (name, symbol, address, chain, decimals)
- Contract verification status
- Admin/control summary
- Source confidence: high / medium / low

Decision gate:
- If contract cannot be verified or multiple similar tokens exist, flag as potential confusion risk.

## Loop 2 — Tokenomics — supply and issuance
Goal: understand the fundamental supply dynamics.

Collect:
- Total supply (fixed, uncapped, expandable)
- Circulating supply vs. max supply
- Token type: inflationary, deflationary, fixed
- Minting/burning mechanisms
- Chain as monetary asset vs. utility token
- Wrapped or pegged variants

Output:
- Supply table with current vs. max
- Inflation/deflation rate if applicable
- Mint/burn authority review

## Loop 3 — Token distribution and allocation
Goal: understand who holds the tokens and how they were allocated.

Collect:
- Initial token distribution (IDO, IEO, seed round, team, treasury, community, airdrop)
- Allocation percentages and unlock schedules
- Cliff periods and vesting schedules
- TGE (token generation event) date and initial unlock %
- Multi-sig treasury addresses and holdings
- Foundation/team allocation lockup

Tools:
- Token arbitrarily
- Etherscan token holder list
- Dune analytics
- Official tokenomics docs or lightpaper

Output:
- Distribution table (category %)
- Unlock timeline table
- Cliff/vesting summary
- Concentration risk rating

## Loop 4 — Release schedule and vesting analysis
Goal: map out when tokens enter circulation.

For each allocation category:
- Team
- Investors (seed, strategic, public)
- Treasury
- Community rewards / airdrop
- Ecosystem / grants
- Liquidity

Collect:
- TGE date and initial unlock %
- Cliff duration per category
- Linear or milestone-based vesting
- Next unlock dates (near-term dumps)
- Total unlocked % over time

Tools:
- Dune queries for vesting contracts
- Token arbitrarily unlock schedules
- Vesting contract onchain inspection

Output:
- Vesting timeline (next 12 months at minimum)
- Unlock event calendar
- Dilution risk rating
- Near-term sell pressure estimate

## Loop 5 — Market data and dynamics
Goal: understand current market behavior.

Collect:
- Current price (spot)
- Market cap and fully diluted market cap
- 24h / 7d / 30d / 90d volume
- Volume / market cap ratio (turnover)
- Circulating supply / total supply ratio
- Price history (all-time high, all-time low, current cycle range)
- 7d / 30d / 90d price change %
- Volatility metrics (standard deviation, beta if available)

Tools:
- CoinGecko API
- CoinMarketCap
- DEX scanners (DexScreener, DexTools)
- TradingView

Output:
- Market data table
- Price chart / range analysis
- Liquidity assessment (deep / shallow / concentrated)
- Volume quality: sustainable / wash / mercenary

## Loop 6 — Holder composition and whale analysis
Goal: understand ownership concentration.

Collect:
- Top 10 / top 100 holder % of supply
- CEX vs. DEX holding split
- Individual known wallets (team, treasury, foundation)
- Number of unique holders
- Holder growth over time

Tools:
- Etherscan token holder page
- Dune analytics
- Arkham Intelligence
- Nansen (if accessible)

Output:
- Holder concentration table
- Whale wallet map
- CEX/DEX distribution
- Concentration risk rating: high / medium / low

## Loop 7 — Liquidity and exchange presence
Goal: assess tradability and exit options.

Collect:
- DEX liquidity (total pool TVL per token)
- CEX listings (centralized exchanges)
- DEX/CEX volume split
- Slippage on common trade sizes
- Stablecoin pools vs. volatile pairs
- Concentrated liquidity positions

Tools:
- DexScreener
- DeFiLlama
- CoinGecko exchange list
- DEX pool explorers (Uniswap, Curve, Balancer)

Output:
- Exchange listing table
- Liquidity depth analysis
- Slippage estimates for common sizes
- Exit complexity rating

## Loop 8 — Protocol utility and use cases
Goal: understand what the token does within the protocol.

Answer:
- What is the token's utility? (governance, staking, fee discount, collateral, access, burns)
- What demand drivers exist for the token?
- Is token required to use the protocol?
- Are there staking incentives,epoch rewards, or fee discounts?
- Does the token accrue value (buyback, burn, fee share)?
- Are there other demand sources (NFT minting, governance-only, etc.)

For each utility:
- Mechanism description
- Demand elasticity
- Sustainability of demand

Output:
- Utility analysis table
- Demand driver map
- Value accrual mechanism

## Loop 9 — Protocol adoption and usage
Goal: measure real protocol adoption, not token speculation.

Collect:
- Total Value Locked (TVL) if applicable
- Active users / addresses
- Transaction counts (daily/weekly)
- Protocol revenue (if applicable)
- Growth trends (users, TVL, volume)
- Compare to competitors in category

Tools:
- DeFiLlama
- Token Terminal
- Dune
- DappRadar

Output:
- Adoption metrics table
- Growth trend analysis
- User quality: organic / incentivized / unknown

## Loop 10 — Team and governance review
Goal: evaluate offchain credibility and alignment.

Collect:
- Team identity (founders, lead developers) — known vs. anonymous
- Team track record (prior projects, experience)
- Investor list and notable backers
- Governance model (token-holder voting, multi-sig, DAO)
- Community health (Discord/Telegram/X engagement)
- Developer activity (GitHub commits, contributors)
- Code review quality (if inspecting)

Output:
- Team assessment
- Governance risk rating
- Community health notes

## Loop 11 — Competitive and market position
Goal: understand the token's competitive landscape.

For the protocol's category (L1, DeFi, gaming, infra, etc.):
- Competitor tokens in same category
- Market share of protocol
- Differentiation factors
- Category growth trajectory

Output:
- Competitive positioning summary
- Category tailwinds/headwinds

## Loop 12 — Risk factors synthesis
Goal: consolidate all identified risks.

Review all loops and flag:
- Smart contract risk
- Centralization risk (team/treasury control)
- Tokenomics risk (unlocks, dilution)
- Liquidity risk
- Market manipulation risk
- Regulatory risk
- Competitive displacement risk
- Team/key-person risk

Output:
- Risk factor table with severity (1-5)
- Kill risks (factors that would cause total loss)
- Mitigants identified

## Loop 13 — Investibility assessment
Produce a structured assessment:

1. **Overall rating**: invest / pass / monitor / deep-dive
2. **Confidence**: high / medium / low
3. **Tokenomics score**: strong / adequate / weak
4. **Market score**: strong / adequate / weak
5. **Team score**: strong / adequate / weak / unknown
6. **Adoption score**: strong / adequate / weak
7. **Risk score**: low / medium / high

For each:
- Summarize key findings
- State basis for rating

## Loop 14 — Investment thesis and decision memo
Structure:

1. Recommendation
2. Position sizing (if invest)
3. Entry strategy (if invest): DCA, liquidity threshold, conditions
4. Exit strategy: targets, indicators, timeframe
5. Monitoring plan: what to track, how often
6. Open questions before capital commits
7. Next exact action

## Standard output artifacts
For every token, produce:
- Token identification table
- Tokenomics summary table
- Vesting/unlock timeline
- Market data snapshot
- Holder composition summary
- Utility and demand analysis
- Adoption metrics
- Risk factor matrix
- Final decision memo

## Default conservative rule
Never recommend investment based on potential utility or future token demand alone. Require evidence of current adoption, sustainable economics, reasonable distribution, and identifiable exit liquidity. Treat anonymous teams with high allocation as elevated risk.
