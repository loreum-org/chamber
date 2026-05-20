# Chamber and Sub-Chambers

This page matches the **“Ecosystem governance”** story on [loreum.org](https://loreum.org#governance): small groups of people (or programs) should not be able to **promise** decentralization while **holding** the real levers. Chambers are meant to make the levers **legible**.

## Chamber (root)

A **root Chamber** is the primary governing body for a deployment you care about: where **global defaults** tend to live, where the **main treasury** sits in vault form, and where **cross-cutting decisions** naturally land.

In the Chamber model, legitimacy comes from rules you can inspect:

- **Who can propose and vote** derives from documented on-chain delegation and seat ranking — not from a hidden admin panel.
- **What can execute** flows through the **queued transaction** pattern with **quorum**, rather than discretionary “run this script” access.

Readers who want the legal framing (statutory **Decentralized Governance System** language and design intent) should start with the **[whitepaper](https://loreum.org/whitepaper)**; builders who want diagrams and naming for contracts should continue with **[Architecture](../protocol/architecture.md)**.

## Sub-Chambers (specialized bodies)

**Sub-Chambers** are best thought of as **specialized governors** sitting under or beside the root: treasury-focused working groups, operations, experimentation (“R&D”), or other mandates your community agrees to carve out.

The product promise is intuitive:

- **Authority is split by structure** — different vaults and director sets for different charters — rather than concentrating every decision in one informal council.
- **Budgets and mandates can be bounded** — at the extremes, this is where policy-like guardrails (caps, quorum, delegation limits) intersect with **[Governance](../protocol/governance.md)** and **[Vault](../protocol/vaults.md)** details.

Concrete parent/child relationships and asset wiring (for example holding **another Chamber’s share token** as an underlying asset) are implementation concerns; **[Vision](../protocol/vision.md)** summarizes how organization can mirror composition on-chain, and **[Architecture](../protocol/architecture.md)** anchors that in **`Registry`** and deployment patterns.

## Directors, multisigs, and agents

Landing copy describes **directors** as first-class actors that can include **humans**, **multisig wallets**, or **software agents**. On-chain, a director action must reconcile with contract rules: proving control of an eligible NFT token ID (including **[EIP‑1271](https://eips.ethereum.org/EIPS/eip-1271)** verification for contracts) and participating in queue semantics.

Treat “agent-ready” governance as **one interface surface** Chamber aims to support — not a separate tier of secrecy or admin override.

## Read next

- **[Overview](./overview.md)** — one-page product picture  
- **[Getting started](./getting-started.md)** — practical app walk-through  
- **[Governance](../protocol/governance.md)** — director seats, quorum, cancellation  
- **[Whitepaper](https://loreum.org/whitepaper)** — authoritative long-form rationale  
