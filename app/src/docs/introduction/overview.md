# Loreum Chamber — what it is

**Loreum Chamber** is onchain governance infrastructure for communities that want treasury, voting, and execution to follow **clear rules you can read from the chain** — not informal polls, opaque admin keys, or a hand-picked multisig list that never updates.

In plain terms, a **Chamber** is where your community:

- **Holds assets** in standard vault accounting (ERC‑4626 shares),
- **Delegates influence** from share holders toward recognizable **director seats** (backed by membership NFTs),
- **Coordinates outbound action** through a **queued, quorum-approved** process (submit → confirm → execute),
- **Stays upgradeable** without abandoning onchain control, when deployed through the **Registry** pattern the app uses.

The public **Loreum** marketing site describes this as a **[Decentralized Governance System](https://loreum.org#clarity)**: transparent, programmatic, and structured so authority is **distributed by design** rather than concentrated in founders or a silent keyholder.

> **Read the full narrative and protocol framing** in the **[Chamber Protocol whitepaper](https://loreum.org/whitepaper)** on [loreum.org](https://loreum.org). It walks through the statutory *Decentralized Governance System* idea, design goals, and technical choices. The docs *here* focus on how the product behaves day to day and where to go for contract-level detail — they are a companion, not a substitute for that paper.

Nothing in these docs is legal advice; statutes and rules change.

## Mission (from Loreum)

Chamber exists to give communities a **credibly neutral** home for capital, decisions, and (over time) autonomous participants — **humans, multisigs, and agents** — with enforcement in **audited smart contracts** rather than social layers alone.

## Why “Chamber” fits the moment

Many “DAOs” rely on founder multisigs, Discord votes, or concentrated token power. That often fails a simple test: *can an outsider see **who** can move the treasury and **exactly which rules** constrain them?*  

Chamber pushes those answers into **contract state and events**: delegation weights, which token IDs hold director seats, quorum, and the **hashed calldata** for each queued action. The point is not “compliance theater” but **structural clarity** — the same story the [CLARITY section of the landing site](https://loreum.org#clarity) summarizes for a general audience.

## The main moving parts (high level)

| Idea | What it means for readers |
|------|----------------------------|
| **Vault (ERC‑4626)** | Deposit and withdraw an underlying token; receive **share tokens** that represent your slice of the treasury. |
| **Membership NFTs** | Each Chamber is wired to one **ERC‑721** collection; **directorship** is tied to specific **token IDs** that sit in the top “seats” once delegation is tallied. |
| **Liquid delegation** | Share holders point weight at the token IDs they want to empower. The **leaderboard of seats** updates as delegations change — the board is **dynamic**, not a static signer CSV. |
| **Transaction queue** | Directors **propose** outbound calls; others **confirm** until **quorum**; then anyone who can pass the **matching calldata** may **execute**. Only the hash is stored onchain — **callers must preserve or recover the original calldata** (for example from submit events). |

For diagrams and route-level UX, see **[App routes](../guides/app-routes.md)**. For formulas, edge cases, and onchain limits, use **[Governance](../protocol/governance.md)** and **[Design notes](../protocol/design-notes.md)**.

## Sub-Chambers and scale

Larger ecosystems can **compose** Chambers so that specialized groups (treasury, ops, R&D-style bodies) each have their own vault and director set while remaining legible as a **fractal whole**. See **[Chamber and Sub-Chambers](./chamber-and-sub-chambers.md)** for a readable mental model; see **[Vision / primitives](../protocol/vision.md)** and **[Architecture](../protocol/architecture.md)** for how that maps to contracts and the Registry.

## Where to go next

1. **[Chamber and Sub-Chambers](./chamber-and-sub-chambers.md)** — ecosystem shape (still non-technical).
2. **[Getting started](./getting-started.md)** — connect a wallet and use the Chamber app.
3. **[App routes](../guides/app-routes.md)** — where each screen lives in the UI.
4. **[Governance](../protocol/governance.md)** — seats, quorum, and the queue in depth.
5. **[Chamber Protocol whitepaper](https://loreum.org/whitepaper)** — full protocol write-up on the public site.
