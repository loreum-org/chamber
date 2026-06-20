# Product

Product management artifacts for Loreum Chamber.

## mogkit workspace (primary)

Structured product discovery lives at **[`product/`](../product/)** — a
[mogkit](https://github.com/Waddling-Penguin/mogkit) workspace with:

| Path | Purpose |
|------|---------|
| `product/sources/` | Raw research (interviews, tickets, competitive intel) |
| `product/graph/` | Evidence graph (`graphify` output) |
| `product/knowledge/` | Analysis artifacts (`assumption-audit`, discovery queries) |

Run mogkit skills via teamshared MCP: `memory_skill_get(name="graphify")`.

## Legacy docs (this folder)

| File | Purpose |
|------|---------|
| `findings-log.md` | Chronological product review findings |
| `competitive-landscape.md` | Competitor matrix (also in `product/sources/`) |
| `competitor-deep-research-YYYY-MM-DD.md` | Dated deep research reports |

New research should land in `product/sources/` with YAML frontmatter, then
re-run `graphify`.

## Other skills

- **product-manager-review** — See `docs/skills/product-manager-review-skill.md`
- **competitor-deep-research** — See `docs/skills/competitor-deep-research-skill.md`
