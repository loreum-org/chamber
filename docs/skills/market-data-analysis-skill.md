# Market Data Analysis Skill

## Purpose
Analyze current trading metrics: price, volume, volatility, and market dynamics.

## Inputs
- Token contract address (required)
- Network/chain (required)
- Exchange list (optional, auto-detected)

## Loop 1 — Price & market cap metrics
Collect real-time and historical data:

**Current Metrics**
- Current price (latest 1min average)
- 24h volume (combined across exchanges)
- Market cap (FDMC)
- Circulating supply × current price
- Fully diluted market cap (supply × current price)
- Price change: 24h, 7d, 30d, 90d (in %)

**Historical Performance**
- All-time high and low price
- Current price as % of ATH
- Current cycle range (range over last X days)
- Volume spike events (unusual volumes)

**Quality Metrics**
- Volume / Market Cap ratio
- Volume / Supply ratio
- Price volatility (standard deviation %)
- Beta to Bitcoin (if tradable)

## Data Sources
- CoinGecko API (primary)
- CoinMarketCap
- DEX aggregators (1inch, 0x, curve)
- Exchange-specific APIs (Binance, Coinbase, Kraken)
- On-chain volume tracking

## Loop 2 — Exchange liquidity & trading data
Collect exchange-specific metrics:

**DEX Liquidity**
- Primary DEX (Uniswap v3, Curve, Balancer)
- TVL in pools (tokens + value)
- Liquidity depth in ETH equivalent
- Concentrated liquidity analysis
- LP token supply and value

**CEX Listings**
- Exchange presence (Binance, Coinbase, Kraken, Bybit)
- Official markets vs. unofficial (spoons)
- Withdrawal fees and limits
- CEX order book depth

**Cross-exchange arbitrage**
- Price differences between exchanges
- Arbitrage opportunities (if significant)

Output:
```
### Market Data Analysis Report

**Price Metrics:**
- Current Price: $<current>
- 24h Change: <percentage>% (down/up)
- Market Cap: $<marketcap>
- FDMC: $<fdmcap>
- 30d Range: $<low> - $<high>

**Volume & Liquidity:**
- 24h Volume: $<volume>
- Volume/MC Ratio: <ratio>
- DEX TVL: $<tvl>
- CEX Listings: <exchange count>

**Volatility & Risk:**
- 30d Volatility: <percentage>%
- Volume Quality: <sustainable/volatile>
- Price Stability: <stable/volatile>

**Market Structure:**
- Market Type: <speculative/utility/investment>
- Liquidity Depth: <deep/medium/shallow>
- Exchange Distribution: <CEX/DEX split>%

**Recommendations:**
- Trading Strategy: <hold/scale in/scale out/invest>
- Liquidity Analysis: <accessible/difficult>
- Market Health: <healthy/caution>

**Risk Flags:**
- Concentration risk: <high/medium>
- Volume quality: <healthy/wash>
- Price stability: <stable/volatile>

**Next Steps:**
- Monitoring frequency: <daily/weekly/monthly>
- Data source reliability: <ranked>

**Recommendation:** <PROCEED/FLAG>
```