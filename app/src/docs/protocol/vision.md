# Vision and primitives

Chamber merges three primitives that DAOs historically duct-taped together:

1. **Treasury-grade custody with shares (ERC‑4626)** — one accounting model per Chamber for deposits, withdrawals, and share supply.  
2. **Liquid representation** — share holders steer influence by delegating numerical weight toward **membership NFT token IDs**, yielding a ranked **leaderboard of seats**.  
3. **Quorum-bound execution** — seated directors cooperate through a hashed-calldata queue (submit → confirm → execute), optional disclosure metadata, and **upgrade hooks** mediated by **ProxyAdmin** ownership on Chamber proxies originating from **`Registry`** flows.

The **marketing site** summarizes the *social* implication: treasury and governance mechanics should constitute a credible **Decentralized Governance System** — transparent programmatic rules rather than folklore. Loreum publishes the long-form rationale in **[Chamber Protocol (online whitepaper)](https://loreum.org/whitepaper)**.

Composable structure — for example Chambers whose underlying asset **is itself another Chamber’s share token**, or Registries parenting **nested deployments** — lets organizations mirror departmental boundaries without collapsing every wire into one opaque multisig basket. See **[Chamber and Sub-Chambers](../introduction/chamber-and-sub-chambers.md)** alongside **[Architecture](./architecture.md)**.

Analytics, alerting, audits, simulations, agents, etc. orbit these interfaces; none of them substitutes for on‑chain quorum receipts or ERC‑4626 accounting.
