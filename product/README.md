# product/ — Loreum Chamber product planning (mogkit workspace)

A [mogkit](https://github.com/Waddling-Penguin/mogkit) PM workspace for planning
**Loreum Chamber**. mogkit playbooks (stored in teamshared under the `mogkit`
tag) turn raw research into an evidence graph and interrogate it — surfacing
what's supported, what's assumed, and what to validate next.

Fetch a playbook: `memory_skill_get(name="graphify")` via the teamshared MCP.

## Layout

```
product/
├── sources/      raw research (one file per artifact); graphify reads these
├── engine/
│   └── graph-schema.json   the contract graphify output must satisfy
├── graph/
│   ├── graph.json          the evidence graph (schema-valid, provenance on every node/edge)
│   └── graph.md            human-readable summary + health banner
├── knowledge/
│   └── assumption-audit.md load-bearing bets ranked by decision-at-risk
└── README.md
```

## Current state

The graph was built from **fifteen sources** (12 research, 1 ticket, 2 memo).
Iteration 3 (2026-05-26) added OpenZeppelin Governor, Parcel, and Commonwealth.
Corpus health is **developing** — competitive intelligence is deeper, but
**zero user interviews**. See:

- `knowledge/governance-competitor-deep-analysis.md` — full synthesis (iter 3)
- `knowledge/assumption-audit/2026-05-26-iter-3.md` — ranked assumptions
- `knowledge/discovery-query/2026-05-26-governance-stack-layers.md` — stack layers
- `knowledge/research-loop/iter-003.md` — research loop journal

Legacy product docs remain at `docs/product/` for backward compatibility; new
mogkit work should land in `product/sources/`.

## How to move it forward

1. **Add real research.** Drop interview transcripts, support tickets, or director
   feedback into `sources/` (with `type:` frontmatter). Re-run `graphify`.
2. **Discovery wedge:** `graphify` → `assumption-audit` → `discovery-query` →
   `interview-guide` → `synthesis-map` → `prd-interrogate`.
3. **Standalone skills** that fit Chamber right now:
   - `metrics-tree` — define measurable outcomes for treasury activation.
   - `narrative-review` — pressure-test positioning vs Safe/Tally.
   - `spec-stress-test` — red-team proposal execution / calldata flows.
   - `tradeoff-frame` — fixed signers vs market-driven board honestly.

Run a skill: `memory_skill_get(name="assumption-audit")` then follow its procedure.
