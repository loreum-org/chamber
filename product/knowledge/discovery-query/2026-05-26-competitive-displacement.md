# Discovery query — What is the strongest competitive threat to Chamber's dynamic board?

> Corpus: **developing**, 12 sources, no user interviews. Thin on buyer evidence.

## Findings

### 1. Hats Signer Gate is the most direct composable alternative to dynamic director sets

**Multi-source** (2 sources: Hats deep dive + competitive landscape dynamic seats row).

> "Grants multisig signing rights to addresses based on whether they are wearing the appropriate hat(s)."
> — `2026-05-26-moloch-baal-hats-signer-gate-deep.md`

> "Removes signers who are no long valid (i.e. no longer wearing the signer hat)"
> — `2026-05-26-moloch-baal-hats-signer-gate-deep.md`

> "| Dynamic board seats | ✓ | ✗ | ✗ | ✗ | ✗ |"
> — `competitive-landscape.md` (Chamber-only in matrix)

Confidence: **Single-source** on HSG mechanics; **Assumed** that buyers equate HSG with Chamber's dynamic board.

### 2. Safe + Zodiac remains the default stack large DAOs compose with

**Multi-source** (3+ research sources).

> "The core of Karpatkey's non-custodial and trust-minimised solution relies on the most battle-tested tooling to assist DAO treasuries: a proxy Management Safe and the Zodiac Roles Modifier."
> — `2026-05-26-extended-governance-competitors.md`

> "Llama excels at deeply integrated, on-chain governance and budget management... via platforms like Snapshot and Tally."
> — `2026-05-26-llama-treasury-framework-deep.md`

Confidence: **Multi-source** for stack composition; **Single-source** per vendor claim.

### 3. Tally and Llama attack the "proposal → execution" UX gap Chamber also targets

**Single-source** each.

> "Approved proposals execute automatically with support for arbitrary executable actions."
> — `2026-05-26-tally-multigov-relay-deep.md`

> "tight, automated coupling between governance votes and treasury actions"
> — `2026-05-26-llama-treasury-framework-deep.md`

Confidence: **Single-source**. Chamber's calldata-hash queue addresses similar JTBD per internal memo — not buyer-validated.

### 4. Zodiac module vulnerability (June 2026) challenges module-composition but not Safe core

**Single-source** (Safe KB + press).

> "this is an issue in third-party Zodiac modules, not in Safe"
> — `2026-05-26-nouns-flows-agent-bravo-zodiac-security-deep.md`

Confidence: **Single-source**. Whether buyers migrate away from modules is **Silent** in corpus.

### 5. Agent governance has multiple patterns — Chamber's director-seat model is one of several

**Single-source** per pattern.

| Pattern | Source |
|---------|--------|
| Chamber agent directors | `chamber-product-intent.md` |
| Agent Bravo Governor policies | `2026-05-26-nouns-flows-agent-bravo-zodiac-security-deep.md` |
| Zodiac Roles scoped executors | `2026-05-26-safe-zodiac-governance-landscape.md` |

Confidence: **Assumed** that director-seat model is preferred.

## Gaps

- No head-to-head buyer comparison: Chamber vs HSG vs Safe+Tally.
- No adoption metrics for HSG, Baal, Llama among Chamber's target segment.
- No evidence NFT delegation leaderboard beats hat-based or reputation-based models.
- Zodiac security impact on buying behavior — unknown.
- Ragequit (Baal) importance to target users — unknown.

## Discovery questions

1. If you use Hats Signer Gate or similar, what problem were you solving when you set it up?
2. What would make you choose a new treasury contract vs extending your existing Safe setup?
3. After the June 2026 Zodiac module disclosure, did your team change how you think about governance modules?
4. How do you decide who can move funds day-to-day — fixed signers, roles, delegation, or something else?
5. Would minority exit (ragequit) matter for your community's treasury? Why or why not?

Answer your question from the findings. Fill the gaps before you commit to anything.
