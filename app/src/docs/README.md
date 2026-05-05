# Loreum Chamber

Documentation for **Chamber**: an ERC‑4626 treasury with membership NFTs, share-weight delegation to token IDs, director quorum over a transaction queue, and a **Registry** that deploys upgradeable Chamber instances.

The web app renders these Markdown files under **`/docs`** (`app/src/pages/Docs.tsx`).

## Navigate the docs

1. **[Overview](./introduction/overview.md)** — product mental model  
2. **[Getting started](./introduction/getting-started.md)** — Dashboard, Deploy, Chamber page, Transactions  
3. **[Architecture](./protocol/architecture.md)** — contracts and how they connect  
4. **[Governance](./protocol/governance.md)** — delegation, directors, quorum, seats  
5. **[Vault](./protocol/vaults.md)** — ERC‑4626 shares and delegation-safe transfers  
6. **[Wallet / multisig](./protocol/multisig.md)** — submit, confirm, execute, hashed calldata  
7. **[Design notes](./protocol/design-notes.md)** — storage, limits, and security-relevant details from `contracts/src/`  
8. **[API reference](./reference/api-reference.md)** — function-level surface  
9. **[Sequence diagrams](./reference/sequence-diagrams.md)** — Mermaid flows  
10. **[Deployment](./guides/deployment.md)** — Foundry scripts and Registry setup  

## Security

Chamber is designed for transparent, rule-bound treasury operation. For review methodology and report expectations, see **[Security](./security/security-review.md)**.

For technical interface flows in the app, see **[Whitepaper / interface](./whitepaper/interface.md)**.
