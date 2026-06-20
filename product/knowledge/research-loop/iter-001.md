# Research loop — iteration 001

**Date:** 2026-05-26  
**Graph health:** developing (8 sources, 50 nodes, 25 edges)  
**Git commit:** (not committed — user did not request)

## Targets

| Queue ID | Question |
|----------|----------|
| rq-safe-zodiac-landscape | Safe Zodiac module ecosystem depth |
| rq-aragon-snapshot-offchain | Aragon modular governance + Snapshot execution gap |
| rq-agent-governance-tools | Colony, Hats, Karpatkey, ERC-8004 |

## Sources added

| File | Type |
|------|------|
| `sources/2026-05-26-safe-zodiac-governance-landscape.md` | research |
| `sources/2026-05-26-aragon-snapshot-governance-tools.md` | research |
| `sources/2026-05-26-extended-governance-competitors.md` | research |

## Mogkit outputs

| Skill | Output |
|-------|--------|
| graphify | `graph/graph.json`, `graph/graph.md` |
| assumption-audit | `knowledge/assumption-audit/2026-05-26-iter-1.md` |
| discovery-query | `knowledge/discovery-query/2026-05-26-governance-competitor-landscape.md` |
| synthesis (manual) | `knowledge/governance-competitor-landscape-analysis.md` |

## Graph delta (iter-000 → iter-001)

| Metric | Before | After |
|--------|--------|-------|
| Sources | 5 | 8 |
| Health | thin | developing |
| Nodes | 29 | 50 |
| Edges | 14 | 25 |
| Competitors | 5 | 10 |
| Assumptions | 5 | 6 |

New competitors: Aragon, Snapshot, Colony, Hats Protocol, Karpatkey.

## Outcomes

| Target | Outcome |
|--------|---------|
| Safe+Zodiac | triangulated-partial (vendor docs, 2 sources) |
| Aragon/Snapshot | triangulated-partial |
| Extended competitors | triangulated-partial |

## Top 3 remaining gaps

1. Zero user/buyer interviews — all claims are vendor or internal docs.
2. Module ecosystem assumption still unvalidated — research strengthens Safe+Zodiac incumbent narrative.
3. NFT delegation board vs Colony/Hats alternatives — no comparative buyer evidence.

## Next pending

1. `rq-buyer-interviews` (high) — manual ingest
2. `rq-llama-treasury-automation` (medium)
3. `rq-nft-governance-alternatives` (medium)

Snapshot: `graph/snapshots/graph-iter-001.json`
