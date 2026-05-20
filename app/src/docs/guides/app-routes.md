# App routes and flows

Technical map of URLs in **this** web client (basename-aware). Precise labels change with UX releases; **contract behavior** stays aligned with **`IChamber`** and related interfaces.

For a conversational introduction to Chambers, see **[Overview](../introduction/overview.md)**.

| Path | Purpose |
|------|---------|
| **`/`** | Dashboard — discovers chambers from the configured Registry |
| **`/deploy`** | Deploy a new Chamber |
| **`/chamber/:address`** | Chamber overview and tabs |
| **`/chamber/:address/:tab`** | Deeplink into a tab |
| **`/chamber/:address/transactions`** | Transaction queue |
| **`/chamber/:address/director/:tokenId`** | Director-centric view |
| **`/docs`**, **`/docs/*`** | This documentation tree |

Director-only controls appear when authentication matches **`isDirector(tokenId)`** for a token ID in the current top seats; share-holder actions (deposit, delegate) depend on balances and allowances.

```mermaid
flowchart TD
    Start([Open app]) --> Connect[Connect wallet]
    Connect --> Hub{Choose destination}
    Hub --> Dashboard[Dashboard /]
    Hub --> Deploy[Deploy /deploy]
    Hub --> Chamber[Chamber /chamber/:address]
    Hub --> Docs[Docs /docs]

    Chamber --> Vault[ERC-4626 deposit or withdraw]
    Chamber --> Del[Delegate or undelegate shares]
    Chamber --> Tx[Transaction queue /transactions]

    Tx --> S[Submit proposal]
    Tx --> C[Confirm]
    Tx --> E[Execute with calldata]
    Tx --> X[Cancel votes]

    style Connect fill:#1e3a5f,color:#fff
    style Vault fill:#0f766e,color:#fff
    style Tx fill:#7c3aed,color:#fff
```

## Read next

- **[Getting started](../introduction/getting-started.md)** — user-oriented walk-through  
- **[Governance](../protocol/governance.md)** — queue semantics and quorum  
- **[Multisig / wallet behavior](../protocol/multisig.md)** — calldata hashing and execution  
