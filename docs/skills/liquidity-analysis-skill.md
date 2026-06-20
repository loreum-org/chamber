# Liquidity Analysis Skill

## Purpose
Analyze token tradability, exchange depth, and exit options.

## Inputs
- Token contract address (required)
- Network/chain (required)

## Loop 1 — DEX liquidity assessment
Collect pool liquidity across decentralized exchanges:

**Primary DEXs (chain-specific)**
- Uniswap v3 (if enabled)
- Curve Finance (if token pairs exist)
- Balancer (if token is multi-token pool)
- Sushiswap (if present)
- 1inch (aggregated liquidity)
- PancakeSwap (if BNB Chain)

**Liquidity Metrics**
- Total value locked (TVL) in USD
- Pool depth analysis (depth at 1%, 10%, 30% price impact)
- Impermanent loss exposure
- Fee APR from pool (if applicable)
- Concentration vs. spread liquidity

**LP Token Analysis**
- Supply of LP tokens
- LP token price (if tradeable)
- LP fee distribution
- LP unstaking periods

## Loop 2 — CEX presence analysis
Collect centralized exchange data:

**Exchange Listings**
- Primary CEX (Binance, Coinbase, Kraken, Bybit, OKX)
- Trading pair availability (spot, futures, options)
- Withdrawal limits and fees
- Deposit/withdrawal support
- KYC level requirements

**Market Data**
- Order book depth
- Spread analysis
- Maker/taker fees
- Withdrawal limits and times
- CEX holding patterns

## Loop 3 — Trading infrastructure
Collect trading infrastructure metrics:

**Algorithmic Trading**
- API availability
- REST/WebSocket support
- Rate limits
- Historical data availability

**Trading Features**
- Stop-loss/ Take-profit orders
- Margin trading support
- Leverage options
- Derivatives (futures, options)

## Output contract
Emit liquidity analysis:
```
### Liquidity Analysis Report

**DEX Liquidity:**
- Total DEX TVL: $<tvl>
- Pool Count: <count>
- Average Pool Depth: $<depth>
- Impermanent Loss Exposure: <exposure>
- Primary DEX Share: <percentage>%

**CEX Presence:**
- Exchange Count: <count>
- Major Exchange Listings: <binance/coinbase/kraken>
- Withdrawal Support: <yes/no>
- Fee Structure: <maker/taker levels>

**Trading Infrastructure:**
- API Availability: <yes/no>
- Derivatives Support: <yes/no>
- Margin Trading: <yes/no>

**Trading Analysis:**
- Slippage at <amount>: <percentage>%
- Arbitrage Opportunities: <yes/no>
- Liquidity Quality: <deep/medium/shallow>

**Exit Complexity:**
- Exit Routes: <count>
- Withdrawal Complexity: <simple/complex>
- KYC Requirements: <none/minimal/standard>

**Recommendations:**
- Liquidity Assessment: <strong/weak>
- Trading Viability: <high/medium/low>
- Exit Strategy: <immediate/gradual/complex>

**Risk Flags:**
- Liquidity Concentration: <high/medium/low>
- Exit Barrier: <none/moderate/high>
- Exchange Risk: <low/medium/high>

**Next Steps:**
- Monitoring Frequency: <daily/weekly/monthly>
- Liquidity Monitoring: <track TVL/departure>

**Recommendation:** <PROCEED/FLAG>
```