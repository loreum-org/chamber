# Loreum Chamber docs

Markdown sources under **`app/src/docs`** render inside the web UI at **`/docs`** (`app/src/pages/Docs.tsx`). They’re organized so **readable product context lands first**, then progressively deeper engineering material.

Start with **[Overview](./introduction/overview.md)** once, then skim **[Chamber Protocol (online)](https://loreum.org/whitepaper)** on [loreum.org](https://loreum.org) for authoritative protocol narrative.

---

## Narrative (“what Chambers do”)

1. **[Overview](./introduction/overview.md)** — high-level Chamber story (aligned with the public landing hero + mission).  
2. **[Chamber and Sub-Chambers](./introduction/chamber-and-sub-chambers.md)** — ecosystem mental model drawn from loreum.org governance framing.  
3. **[Getting started](./introduction/getting-started.md)** — connect a wallet, routes, Transactions tab, Deploy.

## Practical / protocol reference

| Doc | Audience |
|-----|----------|
| **[Vision & primitives](./protocol/vision.md)** | Why the three-legged design exists |
| **[Architecture](./protocol/architecture.md)** | Contracts, Registry, proxies |
| **[Governance](./protocol/governance.md)** | Seats, quorum, delegation flow |
| **[Vault](./protocol/vaults.md)** | ERC‑4626 and transfer/delegation invariants |
| **[Wallet / multisig](./protocol/multisig.md)** | Queue execution + calldata hashing |
| **[Design notes](./protocol/design-notes.md)** | Limits, assumptions, Solidity notes |

## Guides

- **[App routes](./guides/app-routes.md)** — path map + diagram for this SPA  
- **[Deployment](./guides/deployment.md)** — Foundry / Registry setups  

## API & diagrams

- **[API reference](./reference/api-reference.md)**  
- **[Sequence diagrams](./reference/sequence-diagrams.md)**

## Security

- **[Security review](./security/security-review.md)** methodology  

## Whitepaper gateway

The **interface table** historically living under `/docs/whitepaper` moved navigationally to **[Whitepaper hub → Read online](./whitepaper/read-online.md)**, pointing at **`https://loreum.org/whitepaper`** for the full prose.
