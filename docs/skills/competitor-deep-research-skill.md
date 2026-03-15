---
name: competitor-deep-research
description: >-
  Deep research on competitors from docs/product/competitive-landscape.md.
  Uses web search, fetches docs/GitHub/releases, and writes structured reports
  to docs/product/. Use when conducting competitor research, market analysis,
  or when the user asks for deep research on Chamber's competitive landscape.
---

# Competitor Deep Research

Deep research skill for Loreum Chamber competitors. When active, the assistant performs thorough research on each competitor listed in the competitive landscape and writes structured reports to `docs/product/`.

**Input**: `docs/product/competitive-landscape.md`  
**Output**: `docs/product/` (dated reports, per-competitor deep dives)

---

## Research Process

### 1. Load Competitor List

Read `docs/product/competitive-landscape.md` and extract:
- Competitor names and categories
- Existing sources/URLs from the Sources section
- Current feature matrix and gaps

### 2. Deep Research Per Competitor

For **each competitor**, perform:

| Research Type | Actions |
|---------------|---------|
| **Official docs** | Fetch docs URLs, product pages, API references |
| **GitHub** | Repos, stars, recent commits, releases, open issues |
| **Announcements** | Blog posts, Twitter/X, Discord, governance forums |
| **Reviews & analysis** | Third-party reviews, comparisons, user feedback |
| **Roadmap** | Public roadmaps, proposals, governance votes |

Use `web_search` and `mcp_web_fetch` to gather current information. Prioritize primary sources (official docs, GitHub) over secondary.

### 3. Research Depth Checklist (per competitor)

- [ ] Core value proposition (1–2 sentences)
- [ ] Key features (current, not just from landscape)
- [ ] Recent changes (last 3–6 months: releases, governance, pivots)
- [ ] Technical architecture (contracts, chains, integrations)
- [ ] Target users and positioning
- [ ] Strengths and weaknesses (evidence-based)
- [ ] Pricing / tokenomics (if applicable)
- [ ] Community size and activity
- [ ] Known limitations or complaints
- [ ] Strategic threats or opportunities for Chamber

---

## Output Structure

All outputs go to `docs/product/`.

### Primary: Dated Deep Research Report

**File**: `docs/product/competitor-deep-research-YYYY-MM-DD.md`

```markdown
# Competitor Deep Research — YYYY-MM-DD

**Research date**: YYYY-MM-DD  
**Source**: docs/product/competitive-landscape.md

## Executive Summary

[2–4 sentences on overall competitive landscape, key shifts, and top implications for Chamber]

---

## Competitors (Deep Dive)

### [Competitor Name]

**Category**: [from landscape]  
**Primary URL**: [url]

#### Value Proposition
[1–2 sentences]

#### Key Features (Current)
- Feature 1
- Feature 2
- ...

#### Recent Changes (Last 3–6 Months)
- [Change with date/source]
- ...

#### Technical Notes
- Architecture, chains, integrations
- GitHub: [repo], stars, activity

#### Strengths
- [Evidence-based]

#### Weaknesses
- [Evidence-based]

#### Chamber Implications
- [Threat or opportunity]

#### Sources
- [URL] — [brief note]
- ...

---

[Repeat for each competitor]

---

## Cross-Cutting Insights

- **Trend 1**: [Observation across competitors]
- **Trend 2**: ...

## Recommendations for Chamber

1. [Action] — [Rationale]
2. ...
```

### Secondary: Update Competitive Landscape

If research reveals material changes, update `docs/product/competitive-landscape.md`:
- Revise competitor table rows
- Update feature matrix
- Add/refresh Sources section
- Bump "Last updated" date

---

## Execution Workflow

1. **Read** `docs/product/competitive-landscape.md`
2. **For each competitor**:
   - Web search: "[Competitor] DAO governance 2025" (or relevant terms)
   - Fetch official docs, GitHub, key URLs from Sources
   - Capture findings in structured format
3. **Write** `docs/product/competitor-deep-research-YYYY-MM-DD.md`
4. **Optionally update** `docs/product/competitive-landscape.md` if significant changes
5. **Summarize** for user: key findings, report location

---

## Competitor-Specific Research Hints

| Competitor | Focus Areas |
|------------|-------------|
| Gnosis Safe | Safe{Wallet}, Zodiac modules, multi-chain, Safe{Core} |
| Tally | Governor integration, proposal UX, DAO tooling |
| Nouns DAO | Prop House, Flows.wtf, fractional $NOUNS, treasury governance |
| Agent Bravo | Governor Bravo compatibility, Discord, agent voting flows |
| onchain-agent-kit | EIP-8004, agent identity, EVM/Solana support |
| ERC-8004 / ERC-8183 | Standard status, adoption, implementations |

---

## Related

- `docs/product/competitive-landscape.md` — Source of competitors
- `docs/skills/product-manager-review-skill.md` — Broader product review (includes lighter competitive research)
