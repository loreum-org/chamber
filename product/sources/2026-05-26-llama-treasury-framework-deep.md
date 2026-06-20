---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 2)
subject: Llama onchain governance framework vs Karpatkey treasury execution
tags: [research-loop, chamber, llama, treasury, safe]
sources:
  - url: https://docs.llama.xyz/
    accessed: 2026-05-26
  - url: https://chainscorelabs.com/comparisons/dao-governance-on-chain-vs-off-chain/governance-data-and-analytics/llama-vs-karpatkey-dao-treasury-management-and-operations
    accessed: 2026-05-26
---

# Llama treasury framework — deep dive (2026-05-26)

## Summary

**Llama** is an onchain governance and access-control framework (not just analytics).
It competes with **Karpatkey** on programmatic treasury ops but optimizes for
**governance-vote-to-execution coupling** via Safe multisigs, Snapshot, and Tally —
closer to Chamber's "rules onchain" thesis than raw Safe, but token/policy-based
not NFT delegation boards.

## Quotes (verbatim)

> "Llama is an onchain governance and access control framework for smart contracts."
> — [Llama docs, Introduction](https://docs.llama.xyz/)

> "Instances can also deploy an arbitrary amount of strategies, accounts, scripts, and guards. Strategies are configured with time period lengths and quorum thresholds that determine how actions transition between states."
> — [Llama docs](https://docs.llama.xyz/)

> "Legacy governance systems helped develop many foundational standards, but either trend towards high operational overhead or centralization. Llama is designed for protocols to start simple, but progressively decentralize decision-making."
> — [Llama docs](https://docs.llama.xyz/)

> "Decentralization is achieved through fine-grained access control, so each governance participant is granted the minimum power needed to perform its function."
> — [Llama docs](https://docs.llama.xyz/)

> "Llama excels at deeply integrated, on-chain governance and budget management. Its core strength is automating complex treasury operations directly through DAO proposals via platforms like Snapshot and Tally."
> — [ChainScore, Llama vs Karpatkey](https://chainscorelabs.com/comparisons/dao-governance-on-chain-vs-off-chain/governance-data-and-analytics/llama-vs-karpatkey-dao-treasury-management-and-operations)

> "For example, a DAO can create a proposal to stream 50,000 USDC over 6 months to a contributor via Superfluid, with execution conditional on the vote passing."
> — [ChainScore, Llama vs Karpatkey](https://chainscorelabs.com/comparisons/dao-governance-on-chain-vs-off-chain/governance-data-and-analytics/llama-vs-karpatkey-dao-treasury-management-and-operations)

> "If your priority is tight, automated coupling between governance votes and treasury actions, choose Llama. If you prioritize professional, hands-off asset management, multi-chain diversification, and complex DeFi strategy execution, choose Karpatkey."
> — [ChainScore, Llama vs Karpatkey](https://chainscorelabs.com/comparisons/dao-governance-on-chain-vs-off-chain/governance-data-and-analytics/llama-vs-karpatkey-dao-treasury-management-and-operations)

> "DAOs like Uniswap and Aave use Llama to create custom roles and multi-sig policies, enabling automated, permissioned transactions directly from their Gnosis Safe."
> — [ChainScore, Llama vs Parcel](https://chainscorelabs.com/comparisons/dao-governance-on-chain-vs-off-chain/treasury-management-frameworks/llama-vs-parcel-dao-treasury-operations-and-payroll)

## Chamber implications

- Llama is a **native governance framework** competitor axis — programmable
  policies + timelocks + vetoes without Chamber's vault/board model.
- Still composes with **Safe + Snapshot/Tally** — reinforces modular stack pressure.

## Open questions

- Do Chamber target DAOs already run Llama instances?
- Is Llama's "minimum power per participant" analogous to Chamber director seats?
