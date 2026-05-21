# Chambers and Sub-Chambers

Large communities rarely want **one wallet** for everything. Chambers let you split responsibility while keeping rules **visible onchain**.

## Root Chamber — the main group

A **root Chamber** is the primary treasury for your project:

- Holds the **main vault** (the shared pot of tokens).  
- Runs the **main board** (who leads by delegation).  
- Uses the **main transaction queue** for big outbound actions.

Think of it as the **city council** for your protocol or DAO — cross-cutting decisions and the flagship treasury live here.

## Sub-Chamber — a focused working group

A **Sub-Chamber** is another Chamber deployment with its **own vault, board, and queue**, usually tied to a **narrow mandate**:

| Example Sub-Chamber | Typical mandate |
|---------------------|-----------------|
| **Treasury** | Grants, payroll, stablecoin policy |
| **Operations** | Vendor payments, infrastructure |
| **R&D** | Experiments, smaller budgets |

Each Sub-Chamber still follows the same rules: **deposit → delegate → directors → quorum → execute**. Contributors can see **which pot** and **which directors** own which decisions.

## Why split instead of one multisig?

With a single multisig, every committee shares **one signer list** and **one approval flow**. That encourages either:

- **Too many signers** on one Safe (slow, cluttered), or  
- **Hidden committees** that “just use the founder keys” off the record.

Sub-Chambers make **structure explicit**: different vaults, different seats, different queues — without pretending one informal council represents everyone.

## How Sub-Chambers connect (conceptually)

The **Registry** can record **parent ↔ child** relationships when a new Chamber uses **another Chamber’s share token** as its underlying asset. That models organizations where a sub-group’s treasury is denominated in the parent Chamber’s shares.

You do not need to master that wiring to use the app — it matters when you **design** how treasury flows between layers. Builders: **[Architecture](../protocol/architecture.md)**.

## Directors can be people, multisigs, or agents

A **director** is whoever controls a **membership NFT token ID** in a **top seat**:

- **Individual** — wallet holds the NFT.  
- **Multisig** — the NFT sits in a Safe; directors act through **EIP‑1271** signatures the Chamber understands.  
- **Agent (future-facing)** — automated systems that still must pass the same **submit / confirm / execute** gates.

The point is **one rulebook** for every seat type, not a special admin lane.

## Read next

- **[Why not just a multisig?](./why-not-multisig.md)**  
- **[Getting started](./getting-started.md)**  
- **[Governance](../protocol/governance.md)**  
- **[Vision](../protocol/vision.md)** — why the design uses three primitives (vault, board, queue)  
