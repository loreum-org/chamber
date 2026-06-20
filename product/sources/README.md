# sources/

Drop raw research here — one file per artifact. `graphify` reads every file in
this folder (skipping this README) and builds an evidence graph.

Give each file YAML frontmatter so the graph can classify it:

```md
---
type: interview   # interview | ticket | prd | memo | research | transcript | note | other
---
```

This workspace is seeded with Chamber product artifacts migrated from
`docs/product/` and internal positioning docs:

| File | Type | Origin |
|------|------|--------|
| `competitive-landscape.md` | research | Feature matrix + competitor table |
| `competitor-deep-research-2026-03-14.md` | research | Deep dive on Safe, Tally, Nouns, agents |
| `findings-log-2026-03-14.md` | ticket | Product review findings (UX, app, contract) |
| `chamber-product-intent.md` | memo | What is a Chamber / product vision |
| `why-not-multisig-positioning.md` | memo | Positioning vs Gnosis Safe |
| `2026-05-26-safe-zodiac-governance-landscape.md` | research | Safe + Zodiac modules (research loop iter 1) |
| `2026-05-26-aragon-snapshot-governance-tools.md` | research | Aragon OSx + Snapshot execution gap |
| `2026-05-26-extended-governance-competitors.md` | research | Colony, Hats, Karpatkey, ERC-8004 |
| `2026-05-26-llama-treasury-framework-deep.md` | research | Llama policy framework (research loop iter 2) |
| `2026-05-26-tally-multigov-relay-deep.md` | research | Tally MultiGov + Relay gasless voting |
| `2026-05-26-moloch-baal-hats-signer-gate-deep.md` | research | Moloch Baal ragequit + Hats Signer Gate |
| `2026-05-26-nouns-flows-agent-bravo-zodiac-security-deep.md` | research | Nouns Flows, Agent Bravo, Zodiac security |
| `2026-05-26-openzeppelin-governor-standalone-deep.md` | research | OZ Governor + Timelock baseline (iter 3) |
| `2026-05-26-parcel-treasury-ops-deep.md` | research | Parcel Safe payroll/ops layer |
| `2026-05-26-commonwealth-governance-deep.md` | research | Commonwealth forum + Snapshot + onchain UI |

These are **product intent and competitive intelligence**, not user interviews.
Add interview transcripts, support tickets, and sales notes here to move the
corpus from "thin" toward "rich".
