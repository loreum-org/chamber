# Token Research Report: YND (YieldNest)

**Date:** June 20, 2026  
**Token Address:** `0x7159cc276d7d17ab4b3beb19959e1f39368a45ba`  
**Network:** Ethereum

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Risk Rating** | HIGH |
| **Recommendation** | AVOID |

YND presents significant data integrity concerns with wildly inconsistent market metrics across sources. While the contract is verified and the protocol has real utility, the extreme discrepancies in market cap ($133K vs $597K vs $0) and circulating supply data raise red flags about data reliability.

---

## Core Findings

| Category | Assessment | Key Insight |
|----------|------------|-------------|
| **Safety & Verification** | ✅ HIGH | Contract verified, proxy pattern, transparent vesting |
| **Tokenomics** | 🟡 MEDIUM | Fixed 1B supply, community-heavy allocation |
| **Distribution** | 🟡 MEDIUM | 22% team/investors with 1-year cliff, releasing mid-2026 |
| **Market Quality** | 🔴 LOW | Extreme data discrepancy across sources |
| **Trading Access** | 🟡 MEDIUM | Limited exchange presence |
| **Holder Base** | 🟡 MEDIUM | ~1,980 holders, some concentration |
| **Protocol Utility** | 🟡 MEDIUM | Real DeFi utility but small TVL |
| **Team & Governance** | 🟡 MEDIUM | Public team, governance in development |

---

## 1. Token Identification Report

**Canonical Token Details:**
- **Name:** YieldNest
- **Symbol:** YND
- **Address:** `0x7159cc276d7d17ab4b3beb19959e1f39368a45ba`
- **Chain:** Ethereum
- **Decimals:** 18
- **Total Supply:** 1,000,000,000 YND
- **Contract Type:** Proxy (TransparentUpgradeableProxy)
- **Compiler:** v0.8.28+commit.7893614a
- **Optimization:** Yes (200 runs)

**Source Confidence:** MEDIUM (contract verified, but data inconsistencies)

**Cross-Source Status:** DIVERGED (significant discrepancies)

**Contract Analysis:**
- Standard ERC-20 with proxy pattern
- Implementation: `0x6770f0c1757Ec7bB940b0E417ce16536fAFE7C74`
- Initial owner: `0xB5E2C39299F76B15cfdCF4D7b41AC3A050680661`
- No security audit submitted

---

## 2. Tokenomics Analysis

**Supply Structure:**
- **Max Supply:** 1,000,000,000 (fixed)
- **Circulating Supply:** Reported range: 435M - 1B (inconsistent)

**Allocation Breakdown:**

| Category | Allocation | Vesting |
|----------|-----------|---------|
| Community & Rewards | 40.94% | 84 months linear |
| Team & Advisors | 20% | 12m cliff + 36m linear |
| Private Sale | 18% | 12m cliff + 32m linear |
| Genesis Airdrop | 6.56% | Unlocked at TGE |
| Ecosystem & Liquidity | 7% | Unlocked at TGE |
| Marketing & Partnerships | 5% | Unlocked at TGE |
| Strategic Round | 2% | 12m cliff + 36m linear |
| Public Sale | 0.5% | Unlocked at TGE |

**TGE Date:** June 3, 2025

---

## 3. Vesting Analysis

**Vesting Timeline:**
- **TGE Date:** June 3, 2025
- **Team/Investor Cliff:** June 3, 2026 (12 months from TGE)
- **Team Unlock:** Beginning June 2026

**Vesting Status (as of June 20, 2026):**
- Most allocations still in cliff period
- Team tokens will start releasing June 2026
- Private sale unlocks ongoing

**Upcoming Unlocks (June 2026 onward):**
- Team & Advisors: 20% (~200M YND) starts unlocking
- Private Sale: 18% (~180M YND) continues releasing
- Strategic Round: 2% (~20M YND) starts releasing

---

## 4. Market Data Analysis

**Data Discrepancy Alert:**

| Source | Price | Market Cap | Circulating Supply |
|--------|-------|------------|-------------------|
| CoinMarketCap | $0.000564 | $245.8K (self-reported) | 435.77M |
| OKX | €0.000134 | €133.82K | 1B |
| Phantom | ~$0.0006 | $597K | 1B |
| Etherscan | $0.00 | $0.00 | 0 (not tracked) |

**Current Metrics (June 20, 2026):**
- **Price:** $0.00013 - $0.00056 (varies significantly)
- **Market Cap:** ~$133K - $597K (UNVERIFIED)
- **24h Volume:** ~$564K - $5.98M (varies by source)
- **CoinMarketCap Rank:** #7,479

**Assessment:** Extreme data inconsistency suggests either:
1. New project with incomplete data tracking
2. Very low actual trading activity
3. Data verification issues

---

## 5. Liquidity Analysis

**Exchange Listings:**
- Limited major exchange presence
- Available on Uniswap (YND/ETH)
- Listed on OKX (significant volume reported)

**On-chain Liquidity:**
- Protocol-Owned Liquidity (POL): 7% allocated
- Initial liquidity provided at TGE

**Assessment:** Limited liquidity; exit positions >$10K may face significant slippage.

---

## 6. Holder Analysis

**Holder Stats:**
- **Total Holders:** ~1,980
- **Top Holders:** Multiple YieldNest protocol contracts (LST/LRT vaults)

**Top Holders from dePortfolio:**
1. 53.07M YND (~5.3%)
2. 27.61M YND (~2.8%)
3. 6.17M YND (YieldNest Restaked ETH)
4. 5.92M YND
5. Multiple protocol-related addresses

**Assessment:** Some concentration in protocol contracts (expected for DeFi), but overall distribution appears reasonable.

---

## 7. Protocol Utility Analysis

**Use Cases:**
1. **Governance** - Voting on protocol improvements
2. **Staking (veYND)** - Stake for voting power + revenue sharing
3. **Rewards** - Liquidity pools, yield farming
4. **Delegated Governance** - Via StakeDAO (sdYND)

**Protocol Features:**
- Liquid restaking (LRT) strategies
- DeFi strategy aggregation
- MAX LRTs (multi-asset liquid restaking)
- Buyback-and-distribute model
- Revenue sharing with veYND holders

**TVL:** Not widely reported; appears to be early-stage

---

## 8. Team & Governance Analysis

**Team Status:**
- Public team (identifiable founders)
- Governance: DAO-controlled (veYND voting)
- TGE: June 3, 2025

**Governance Scope:**
- Programmatic incentives
- Fee distribution
- Integration approvals
- SubDAO oversight

---

## Investment Thesis

**Bull Case:**
- Strong community allocation (40.94%) aligns with DeFi ethos
- Real DeFi utility with restaking strategies
- Governance revenue-sharing model
- Long vesting schedules align long-term incentives

**Bear Case:**
- Extreme market data discrepancy (red flag for reliability)
- Extremely low market cap ($133K-$597K)
- Very limited exchange presence
- Data not tracked properly on major platforms
- Security audit not submitted
- Early-stage project with unproven track record

---

## Key Risks

1. **Data Integrity Risk** - Inconsistent market data across sources
2. **Liquidity Risk** - Very low market cap limits entry/exit
3. **Team Unlock Risk** - Cliff ends June 2026, significant supply entering market
4. **Transparency Risk** - No security audit submitted
5. **Counterparty Risk** - Early-stage DeFi protocol

---

## Monitoring Plan

- Verify market data sources after June 2026 team unlock
- Track actual trading volume and liquidity
- Monitor protocol TVL growth
- Review security audit status
- Re-assess after team token distribution

---

## Sources

- Etherscan: https://etherscan.io/address/0x7159cc276d7d17ab4b3beb19959e1f39368a45ba
- CoinMarketCap: https://coinmarketcap.com/currencies/yieldnest/
- YieldNest Docs: https://docs.yieldnest.finance/governance-and-tokenomics/ynd-and-veynd-tokenomics/ynd-token-distribution
- CryptoRank: https://cryptorank.io/price/yieldnest/vesting
- Governance Forum: https://gov.yieldnest.finance/t/yieldnest-ynd-tokenomics-own-govern-earn/160