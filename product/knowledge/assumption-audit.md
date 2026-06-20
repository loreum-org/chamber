# Assumption audit — Loreum Chamber

## Health context

Corpus health is **thin**: 5 sources (research, ticket, memo), all internal
product intent or competitive intelligence — **no user interviews**. On a thin
corpus **single-source is the default, not an anomaly**; triage ranks by *the
decision at risk*, not evidence-thinness. Totals: **5 assumptions** (zero
provenance) and **~24 single-source claims** (one source each).

## Assumptions (zero provenance)

### High

1. **Treasury teams prefer market-driven NFT boards over fixed signers.**
   - Decision at risk: entire positioning vs Safe/Tally; whether "why not multisig"
     resonates with target buyers.
   - Source: voiced internally — `chamber-product-intent.md` and
     `why-not-multisig-positioning.md` assert market-driven governance without
     buyer quotes.

2. **Organizations want AI agents as first-class directors with auto-confirm policies.**
   - Decision at risk: hybrid human-AI roadmap, ValidationRegistry investment,
     agent deployment UX.
   - Source: `chamber-product-intent.md` — "Agents and humans can share governance
     power" with no customer validation.

3. **Chamber can win deals without a module/plugin ecosystem in the near term.**
   - Decision at risk: build vs partner vs defer module strategy; enterprise
     RFPs that require Zodiac-like composability.
   - Source: competitive gap acknowledged in `competitive-landscape.md` but no
     evidence buyers accept the gap.

### Medium

4. **ERC-8004 alignment materially influences buyer choice.**
   - Decision at risk: marketing emphasis on agent trust standards vs treasury
     UX and Safe migration pain.
   - Source: `competitor-deep-research-2026-03-14.md` recommendation to
     "emphasize ERC-8004 alignment" — analyst judgment, not buyer voice.

5. **Stakeholders understand and will use delegation-to-NFT-ID mechanics.**
   - Decision at risk: activation funnel — delegation is prerequisite to director
     influence.
   - Source: implied by product design; contradicted by P1 finding that users
     don't know their token ID (`findings-log-2026-03-14.md`).

## Single-source claims (one provenance entry)

Load-bearing claims a major decision leans on.

### High

- **Safe's module ecosystem is the incumbent bar for composability.** Source:
  `competitor-deep-research-2026-03-14.md`. Triangulate with: 2–3 enterprise
  treasury buyer interviews on why they chose Safe+Tally.
- **Delegation UX friction (raw token ID) blocks director activation.** Source:
  `findings-log-2026-03-14.md` (single PM review). Triangulate with: usability
  test with 5 new depositors attempting delegation.

### Medium

- **Chamber's transaction queue lacks a proposal layer vs Tally/Nouns.** Source:
  `competitive-landscape.md`. Triangulate with: director workflow observation
  on a live chamber.
- **Hardcoded etherscan links cause wrong-chain explorer navigation.** Source:
  `findings-log-2026-03-14.md`. Triangulate with: QA pass on Sepolia testnet
  (already partially fixed in app).

### Low

- **Nouns Flows.wtf is worth monitoring as a capital-deployment model.** Source:
  `competitor-deep-research-2026-03-14.md`. Interesting but not load-bearing
  for current quarter.

## Triage recommendation

Validate **#1 (market-driven board vs fixed signers)** first — it gates positioning,
sales narrative, and whether Safe is the real alternative. In parallel, run a
**delegation usability test** (#5 / single-source delegation pain) because it is
cheap and directly blocks the outcome the product promises. Defer module ecosystem
decisions until at least one buyer names composability as a blocker.

The team will plan against whatever it does not question. These are the things to question first.
