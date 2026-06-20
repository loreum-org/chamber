# Token Identification & Verification Skill

## Purpose
Confirm the correct token is being analyzed — verify contract address, source credibility, and distinguish from duplicates/spoons.

## Inputs
- Token contract address (required)
- Network/chain (required) — e.g., ethereum, base, arbitrum, solana
- Project name (required)

## Loop 1 — Contract verification on chain
Steps:
1. Resolve token address via CoinGecko, CoinMarketCap, or DeFiLlama search by address
2. Confirm contract address on chain via Etherscan/Basescan/Arbiscan
3. Check contract source code verification status
4. Inspect proxy patterns and implementation contracts
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

## Loop 2 — Cross-source corroboration
Compare token data from multiple independent sources:
- CoinGecko
- CoinMarketCap
- DeFiLlama
- Exchanges (Binance, Coinbase, Kraken)
- Official project documentation

Identify discrepancies:
- Different names for same contract
- Same name for different contracts
- Inconsistent decimals
- Conflicting totalSupply

Output:
- Canonical token details with confidence scores
- Discrepancy analysis with recommendations
- Risk flag if sources disagree

## Guardrails
- Never proceed with token analysis until contract and source are verified
- Reject anonymous reports without on-chain verification
- Flag tokens with multiple conflicting sources

## Output contract
Emit a short report:
```
### Token Identification Report

**Canonical Token Details:**
- Name: <ensured name>
- Symbol: <ensured symbol>
- Address: <ensured address>
- Chain: <ensured chain>
- Decimals: <ensured decimals>
- Total Supply: <verified supply>
- Contract Verification: <verified>

**Source Confidence:** <high/medium/low>

**Cross-Source Status:** <confirmed/diverged>

**Recommendation:** <PROCEED/FLAG_FOR_REVIEW>
```