# Discovery query — Who are Chamber's governance competitors and what do they optimize for?

> Corpus health: **developing** (8 sources, no user interviews). Most findings
> are **single-source** vendor/docs intelligence.

## Findings

### 1. Primary incumbent stack is Safe avatar + Zodiac modules + Governor UI

**Single-source** (2 research docs, same vendor ecosystem).

> "The Zodiac Governor module facilitates the management and control of Gnosis Safes by a DAO."
> — `2026-05-26-safe-zodiac-governance-landscape.md`

> "**Safe (Gnosis Safe)** remains the dominant multisig infrastructure with $100B+ secured"
> — `competitor-deep-research-2026-03-14.md`

### 2. Scoped execution via Zodiac Roles addresses per-tx multisig friction

**Single-source** (2 docs, same pattern — Safe/Zodiac + karpatkey).

> "eliminating need for Safe owners/signers to approve every transaction"
> — `2026-05-26-safe-zodiac-governance-landscape.md`

> "the Zodiac Roles Modifier Module enforces role-based permission presets that can unilaterally make calls to any pre-approved addresses, functions, and variables the role has access to."
> — `2026-05-26-extended-governance-competitors.md`

### 3. Named governance UX competitors: Tally, Aragon, Snapshot, Colony, Hats

**Single-source** each (feature matrix + new research).

| Competitor | Optimizes for (per corpus) | Confidence |
|---|---|---|
| **Safe** | M-of-N treasury custody, module composability | Single-source |
| **Tally** | Governor + Safe linking, proposal UI | Single-source |
| **Aragon** | No-code modular staged governance, Safe as governing body | Single-source |
| **Snapshot** | Gasless offchain signaling | Single-source |
| **Nouns** | NFT identity + treasury (separate vault) | Single-source |
| **Colony** | Reputation + lazy consensus controlling Safe | Single-source |
| **Hats** | Revocable onchain role trees | Single-source |
| **Agent Bravo** | AI voting in Governor systems | Single-source |

### 4. Snapshot's known weakness is execution — Chamber's queue addresses this on paper

**Multi-source** (2 sources, 2 types: research + memo).

> "One important aspect of Snapshot is that it does not actually execute the voting decisions, leaving that up to the DAOs themselves."
> — `2026-05-26-aragon-snapshot-governance-tools.md`

> "each outbound action is **proposed, confirmed to quorum, then executed** with calldata checked against a stored hash."
> — `chamber-product-intent.md`

### 5. ERC-8004 is adjacent agent infrastructure, not a treasury governance competitor

**Single-source**.

> "While this ERC cryptographically ensures the registration file corresponds to the on-chain agent, it cannot cryptographically guarantee that advertised capabilities are functional and non-malicious."
> — `2026-05-26-extended-governance-competitors.md`

### 6. Chamber differentiators in corpus: NFT delegation board, ERC4626 vault, agent directors

**Single-source** (competitive matrix + memos). **Assumed** that buyers value these.

> "**Market-driven board**: Delegation to NFT IDs creates a leaderboard; top N by stake become directors."
> — `competitive-landscape.md`

## Gaps

- No buyer quotes on competitor selection or switching triggers.
- No adoption/TAM data for Aragon, Colony, Hats vs Safe+Tally.
- No user evidence that NFT delegation board beats reputation (Colony) or role trees (Hats).
- No evidence buyers reject Snapshot execution gap enough to migrate.
- Chamber module/plugin roadmap unstated in corpus — `assumption-compete-without-modules` unvalidated.
- Agent director demand unvalidated (`assumption-agents-as-directors`).

## Discovery questions

1. When you last chose or renewed your treasury governance stack, what alternatives did you evaluate and what was the deciding factor?
2. Walk me through the last time a treasury transaction went from idea to execution — who touched it at each step?
3. Have you ever had a Snapshot vote result not match what the multisig executed? What happened?
4. How do you decide who can move funds day-to-day vs who approves policy changes?
5. If agents could hold a director seat with the same quorum rules as humans, would you use that? Why or why not?

Answer your question from the findings. Fill the gaps before you commit to anything.
