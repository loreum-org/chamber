# Tokenomics Analysis Skill

## Purpose
Analyze core supply dynamics: total supply, inflation/deflation mechanics, and issuance mechanisms.

## Inputs
- Token contract address (required)
- Network/chain (required)

## Loop 1 — Supply characteristics
Collect and verify:

**Fixed Supply**
- Total supply on chain (etherscan/token endpoint)
- Circulating supply vs. max supply
- Immutable totalSupply function
- No known burn/mint functions

**Expandable Supply**
- Current total supply
- Issuance function parameters (rate, schedule)
- Treasury/whale minting address(es)
- Inflation rate (annual %)
- Max supply target (if defined)

**Hybrid Supply**
- Multiple mints from different contracts
- Community mint controlled by DAO
- Programmatic inflation tied to protocol metrics

Output:
```
### Tokenomics Baseline

- Total Supply: <current>
- Circulating Supply: <current>
- Max Supply: <target or N/A>
- Supply Type: <fixed/expandable/hybrid>
- Inflation Rate: <annual %>
- Deflation Rate: <annual %>
- Burn Mechanics: <yes/no/parameters>
- Mint Authority: <founders/team/DAO/multisig>
```

## Loop 2 — Monetary policy mechanics
Analyze how new tokens enter/leave circulation:

**Inflation Mechanisms**
- Staking rewards
- Liquidity incentives
- Protocol revenue accrual
- User activity rewards
- Partnerships/integrations rewards

**Deflation Mechanisms**
- Token burns from trading fees
- Treasury buybacks
- Staking token unbonding penalties
- Utility consumption (gas/token burn)

**Auto-balance mechanisms**
- Algorithmic market cap stabilization
- Pool rebalancing in DEXs
- Supply adjustments based on price targets

Output:
- Monetary policy summary
- Volume/Supply ratio (if tradable)
- Sustainability assessment of inflation/deflation

## Guardrails
- Never assume "no inflation" for non-fixed supply tokens
- Flag tokens with uncapped supply and weak utility backing
- Reject tokens with undisclosed minting authorities

## Output contract
Emit structured tokenomics analysis:
```
### Tokenomics Analysis Report

**Supply Structure:**
- Type: <inflationary/deflationary/fixed>
- Rate: <annual % if applicable>
- Ceiling: <if any>

**Monetary Policy:**
- Inflation Sources: <list>
- Deflation Channels: <list>
- Balance Mechanism: <auto/manual/external>

**Foundational Assessment:**
- Supply Sustainability: <strong/weak>
- Monetary Policy Transparency: <transparent/obscure>
- Inflation Use Case Alignment: <aligned/misaligned>

**Recommendation:** <PROCEED/FLAG>
```