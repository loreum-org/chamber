# Research loop — iteration 003

**Date:** 2026-05-26  
**Graph:** developing · 15 sources · 82 nodes · 44 edges  
**Snapshot:** `graph/snapshots/graph-iter-003.json`

## Targets completed

| Queue ID | Source file |
|----------|-------------|
| rq-openzeppelin-governor-standalone | `2026-05-26-openzeppelin-governor-standalone-deep.md` |
| (added) Parcel treasury ops | `2026-05-26-parcel-treasury-ops-deep.md` |
| (added) Commonwealth governance | `2026-05-26-commonwealth-governance-deep.md` |

## Mogkit outputs

- `graph/graph.json` + `graph/graph.md`
- `knowledge/assumption-audit/2026-05-26-iter-3.md`
- `knowledge/discovery-query/2026-05-26-governance-stack-layers.md`
- Updated `knowledge/governance-competitor-deep-analysis.md`

## Graph delta (iter 2 → 3)

| Metric | Iter 2 | Iter 3 |
|--------|--------|--------|
| Sources | 12 | 15 |
| Nodes | 67 | 82 |
| Edges | 35 | 44 |
| Competitors | 12 | 15 |
| Assumptions | 8 | 10 |

**Key additions:** OZ Governor baseline, Parcel ops layer, Commonwealth coordination UX, governance stack layering insight, calldata-offchain parallel to Chamber hash queue.

## Top 3 gaps remaining

1. **No buyer interviews** — stack map is vendor intelligence only.
2. **Segment clarity** — NFT/community treasury vs token protocol DAO (OZ Governor path).
3. **Build vs partner** — coordination UX (Commonwealth/Tally) and ops (Parcel).

## Next queue

1. `rq-buyer-interviews` (high)
2. `rq-hsg-displacement-validation` (high)
3. `rq-chamber-segment-vs-oz-governor` (new, medium)

## Headline finding

Competitive landscape is **layered**, not monolithic. Chamber competes on
native custody+authority; **OZ Governor + Tally** owns token governance contracts,
**Commonwealth** owns coordination UX, **Parcel** owns Safe payroll ops.
Buyers may compose stacks rather than replace with Chamber.
