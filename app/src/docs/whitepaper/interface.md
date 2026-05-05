# App interface flow

Routes from **`App.tsx`** (basename-aware):

| Path | Purpose |
|------|---------|
| **`/`** | Dashboard — chamber discovery from Registry |
| **`/deploy`** | Deploy a new Chamber (chain + env dependent) |
| **`/chamber/:address`** | Chamber overview + tabs |
| **`/chamber/:address/:tab`** | Deeplink to tab |
| **`/chamber/:address/transactions`** | Transaction queue UX |
| **`/chamber/:address/director/:tokenId`** | Director-centric view |
| **`/docs`**, **`/docs/*`** | In-app Markdown docs |

Director-only actions unlock when wallet auth matches **`isDirector(tokenId)`** for a token in the current top seats; share-only actions (deposit, delegate) depend on balances and approvals.

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

This diagram is illustrative; precise button labels evolve with UI releases while on-chain semantics remain **`IChamber`**.
