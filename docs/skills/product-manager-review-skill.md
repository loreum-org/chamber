---
name: product-manager-review
description: >-
  Product manager skill for reviewing functionality, UX, contracts, app UI/UX,
  competitive landscape research, and feature gap analysis. Use when conducting
  product reviews, comparing against competitors, identifying improvements, or
  maintaining product findings logs in docs/product.
---

# Product Manager Review

Systematic product review skill for Loreum Chamber. When active, the assistant acts as a product manager to identify issues, improvements, and competitive positioning.

**Targets**: `src/` (contracts), `app/` (frontend), `docs/` (documentation).

---

## Review Scope

### 1. Functionality & Issues
- Feature completeness vs. stated goals (see `docs/introduction/overview.md`, whitepaper)
- Edge cases and error handling
- Integration gaps between contracts and app
- Missing or broken flows

### 2. UX (User Experience)
- User journey clarity and friction points
- Onboarding and first-time experience
- Error states and feedback
- Accessibility considerations

### 3. Contracts (Product Lens)
- API ergonomics for integrators
- Event design for indexing and UIs
- Gas efficiency and user cost
- Upgradeability and governance UX

### 4. App UI
- Layout, hierarchy, and visual consistency
- Responsiveness and device support
- Component reuse and design system
- Loading and empty states

### 5. App UX
- Navigation and information architecture
- Task completion flows (delegate, vote, execute)
- Feedback loops and confirmation patterns
- Mobile vs. desktop experience

---

## Competitive Landscape

### Research Process

1. **Identify competitors** in:
   - DAO treasuries and multisigs (Gnosis Safe, Tally, etc.)
   - NFT-based governance (Nouns, Fractional, etc.)
   - Agent/AI governance tooling
   - Shared vaults and community treasuries

2. **For each competitor**, capture:
   - Core value proposition
   - Key features (governance, delegation, agents, UX)
   - Strengths and weaknesses
   - Target users and positioning

3. **Maintain** `docs/product/competitive-landscape.md` with:
   - Table of competitors and feature matrix
   - Last-updated date
   - Sources (websites, docs, reviews)

### Competitive Landscape Template

```markdown
# Competitive Landscape

**Last updated**: YYYY-MM-DD

## Competitors

| Competitor | Category | Key Features | Strengths | Weaknesses |
|------------|----------|--------------|------------|------------|
| ...       | ...      | ...          | ...        | ...        |

## Feature Matrix

| Feature | Chamber | Competitor A | Competitor B | ... |
|---------|---------|--------------|--------------|-----|
| NFT-based governance | ✓ | ... | ... | ... |
| Agent support | ✓ | ... | ... | ... |
| ... | ... | ... | ... | ... |

## Sources
- [Competitor name](url)
```

---

## Feature Gap Analysis

Compare Chamber's current feature set (from contracts, docs, app) against the competitive landscape:

1. **Read** `src/`, `docs/`, and `app/` to extract implemented features
2. **Cross-reference** with `docs/product/competitive-landscape.md`
3. **Identify**:
   - Gaps (competitors have it, Chamber doesn't)
   - Differentiators (Chamber has it, competitors don't)
   - Parity features (both have, compare quality)
4. **Prioritize** by user impact and strategic fit

---

## Findings Log

All findings go to `docs/product/`. Use this structure:

### File: `docs/product/findings-log.md`

Append entries with this format:

```markdown
## YYYY-MM-DD

### [Category] Title

**Type**: Issue | Improvement | UX | Contract | App UI | App UX | Competitive

**Description**: Brief description of the finding.

**Location**: Path or component (e.g., `app/src/pages/Dashboard.tsx`, `Chamber.sol`)

**Recommendation**: Actionable next step.

**Priority**: P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
```

### File: `docs/product/competitive-landscape.md`

Maintain the competitive landscape table and feature matrix. Update when:
- New competitors are discovered
- Competitor features change
- Chamber ships new features

---

## Execution Workflow

When invoked for a product review:

1. **Gather context**
   - Read `docs/introduction/overview.md`, `docs/protocol/vision.md`
   - Scan `src/` for contract capabilities
   - Scan `app/` for UI flows and components
   - Check if `docs/product/` exists; create if missing

2. **Competitive research** (if requested or landscape is stale)
   - Use web search for competitors in DAO treasuries, NFT governance, agent tooling
   - Update or create `docs/product/competitive-landscape.md`

3. **Review**
   - Apply review scope (functionality, UX, contracts, app UI, app UX)
   - Compare against competitive landscape
   - Document findings in `docs/product/findings-log.md`

4. **Output**
   - Summary of findings by category
   - Prioritized recommendations
   - Updated competitive landscape (if researched)
   - Link to `docs/product/findings-log.md`

---

## Output Format

### Findings Summary Template

```markdown
# Product Review — YYYY-MM-DD

## Executive Summary
[2–3 sentences on overall health and top priorities]

## Findings by Category

### Functionality
- [Finding] — P1

### UX
- [Finding] — P2

### Contracts
- [Finding] — P1

### App UI
- [Finding] — P2

### App UX
- [Finding] — P2

### Competitive
- [Gap or differentiator] — P1

## Recommendations
1. [Action] — [Rationale]
2. [Action] — [Rationale]

## Log
Full details appended to `docs/product/findings-log.md`
```

---

## Related Resources

- `docs/introduction/overview.md` — Product vision and features
- `docs/protocol/vision.md` — Protocol direction
- `docs/whitepaper/` — Detailed spec
- `docs/reference/api-reference.md` — Contract API
- `app/src/` — Frontend implementation
