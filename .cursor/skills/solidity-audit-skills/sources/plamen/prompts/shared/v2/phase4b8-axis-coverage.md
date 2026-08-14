# Multi-Axis Coverage Meta-Pass (Phase 4b.8)

> **Purpose**: Interrogate each mechanically-hot function on the ONE orthogonal risk axis its owning domain lens never examined. The driver has already built a `function × axis` completeness matrix and handed you ONLY the GAP cells. Your job is to TRACE each GAP to a definite conclusion — a real finding with evidence, or a reasoned clear. This is a targeted depth EXPLORATION pass, NOT a validate-or-dismiss filter.
> **Output artifact**: `axis_coverage_findings.md`
> **Finding format**: follow `~/.claude/rules/finding-output-format.md`

---

## Why you exist

Every function is analyzed by whichever domain lens happened to own it — a
token-flow lens checks value movement, a state-trace lens checks storage, an
external lens checks freshness. A single lens interrogates a function on ITS
axis and moves on. The other orthogonal risk axes on that same function go
unexamined, and a real bug on an unexamined axis of a core function is invisible
to single-lens analysis.

A mechanical gate has already:

1. Ranked the **hot functions** (core functions by callers / state writes /
   value-effect / elevated surface) — deterministically, so the target set
   cannot be steered.
2. Built a `function × axis` matrix and, using ONLY the closed depth-evidence
   tag vocabulary, marked each cell `EXAMINED` (a prior pass left a proving tag),
   `N/A` (a mechanically-provable exclusion), or `GAP` (nobody examined this
   axis here — including the recall-safe default when the signal was ambiguous).

You are handed the `GAP` cells. Each is a "this hot function was never
interrogated on THIS axis" spot. Your job is the missing interrogation.

---

## The six axes (interrogate on the ASSIGNED axis only)

For a GAP cell `(function f, axis A)`, ask ONLY axis `A`'s question of `f`:

- **theft** — Can value (funds/shares/assets/privilege) leave `f` to a party
  that should not receive it, or in an amount larger than owed? Trace every
  value-effect path to who ends up holding what.
- **liveness** — Can a reachable input/state permanently revert, lock, or brick
  a core user action through `f`? Trace the boundary/empty/first/last actor
  path to its terminal revert or stuck state.
- **accounting** — Does an arithmetic / conservation / share / total invariant
  `f` participates in break at a boundary or under a variation? Substitute
  boundary values and vary parameters; check Σin == Σout ± fee.
- **provenance** — Does `f` consume an external/price/timestamp read without
  interrogating its freshness or source? Trace where the value comes from and
  whether staleness or a wrong source is reachable.
- **boundary** — At 0 / 1 / MAX / empty / duplicate / type-edge inputs to `f`,
  does behavior diverge from the non-edge case in a harmful way?
- **identity** — For a function that acts on (mutates the balance / allowance /
  role / state of) a subject or actor DISTINCT from its authorizing caller, was
  that divergence explicitly authorized — or can a caller act on another
  party's behalf without their consent, or a delegate exceed its bound?

The driver tells you, per row, exactly which `(f, A)` pairs to interrogate. Do
NOT re-examine axes not handed to you — those are already covered.

---

## Inputs

Read from the scratchpad (treat by ROLE, do not assume a single filename is the
only source):

- `hot_function_axes.md` — the human-readable `function × axis` matrix. Your
  worklist is every `GAP` cell.
- `_hot_function_axes.json` — the same matrix + the exact `gaps` list in
  structured form, if present. Each gap row names `function`, `loc`, `axis`.
- The aggregated inventory of candidate findings and the per-agent depth
  outputs already on disk, so you can see what WAS analyzed on the OTHER axes
  (and therefore avoid re-doing them).
- The actual source files at each GAP cell's `loc`. You MUST open the source —
  the matrix only names locations; the analysis on the assigned axis is yours.

If `hot_function_axes.md` has no GAP cells (or the matrix is empty), there is
nothing to interrogate: write a short note to your output artifact saying so and
stop. (The driver normally skips this phase entirely in that case — never an
error.)

---

## What to do for EACH GAP cell

Process every GAP row independently. For each `(function f, axis A)`:

1. **Read the cell.** Identify the function `f`, its location `loc`, and the
   single axis `A` you must interrogate.

2. **Open the source for `f` at `loc`.** Read the function and the immediate
   state / callees it touches on axis `A`. Do not reason from summaries — read
   the code.

3. **Interrogate on axis `A` ONLY, and record the work with the closed
   depth-evidence tags** from `~/.claude/rules/finding-output-format.md`:
   - `[BOUNDARY:X=val]` — substitute concrete boundary values (0, 1, MAX,
     empty, duplicate, type-edge) and state the outcome.
   - `[VARIATION:param A→B]` — vary a parameter / ordering / direction and state
     how behavior changes.
   - `[TRACE:path→outcome]` — follow execution to a terminal state (revert,
     state write, transfer, return) and state where it ends.
   - `[EXTERNAL-ASSUMPTION:…]` / `[CROSS-DOMAIN-DEP: external]` — for the
     provenance axis, name the external freshness/source assumption you tested.
   Do NOT invent new tag vocabulary — use only the closed set above.

4. **Conclude with ONE of two outputs — never a dismissal-without-work:**
   - **A real finding** when axis `A` interrogation shows a genuine issue.
     Write it in the standard finding format with the depth-evidence tags that
     prove the work, a concrete **Material Harm** sentence (WHO loses WHAT),
     the **Rules Applied** line, and the source location. Set the verdict per
     what you proved.
   - **A reasoned clear** when interrogation shows `f` is safe on axis `A`.
     Record it in the Coverage Record (below) with the SPECIFIC `(f, A)` named
     and a CONCRETE evidence locus (the file:line, the guard, or the prior
     finding ID that makes it safe). A clear is a VALID and expected output.

   You must NOT fabricate a finding to fill a quota, and you must NOT clear a
   cell with vague wording ("looks fine", "covered elsewhere") that names no
   locus. If you cannot reach a definite safe conclusion, the cell is
   UNRESOLVED — emit it as a finding at the inherited (Low) severity flagged for
   verification, never as a clear.

---

## Recall-Positive Contract

This phase is strictly additive. You may ADD findings and you may record
reasoned clears. You have NO authority to drop, merge, or downgrade any
pre-existing finding, and you write ONLY your own output artifact. When an
interrogation is ambiguous, prefer emitting a finding over clearing — an extra
candidate is recoverable downstream; a falsely-cleared real bug is a missed
vulnerability.

---

## Output Requirements

Write everything to `axis_coverage_findings.md`.

1. **Findings**: every real finding (or UNRESOLVED cell) in the standard finding
   format from `~/.claude/rules/finding-output-format.md`. Use finding IDs of
   the form `AXIS-1`, `AXIS-2`, … Include the closed depth-evidence tags that
   prove the interrogation, the Material Harm sentence, the Rules Applied line,
   and a `## Chain Summary` line per finding so downstream composition analysis
   can consume it.

2. **Coverage Record**: one row per GAP cell processed, so downstream gating can
   confirm every cell reached a definite disposition:

   ```
   | Function | Axis | Disposition | Evidence |
   |----------|------|-------------|----------|
   ```

   - **Function / Axis**: the GAP cell you interrogated.
   - **Disposition**: exactly one of `FINDING` (emitted as AXIS-n), `UNRESOLVED`
     (emitted as AXIS-n for verification), or `CLEAR` (safe on this axis).
   - **Evidence**: for `FINDING`/`UNRESOLVED`, the emitted AXIS-n ID; for
     `CLEAR`, the concrete file:line / guard / prior finding ID that proves
     safety. A `CLEAR` row with a blank or vague Evidence cell is a contract
     violation and will be re-surfaced downstream as unexamined.

---

## Method Discipline

State all methods abstractly. This methodology encodes HOW to interrogate a
function on a risk axis — never WHAT to find in any specific codebase. Do not put
any protocol, project, contract, function, variable, or token name from the audit
into the methodology sections; concrete references belong only inside the finding
bodies and the coverage record, where they describe the current target. End your
output file with `<!-- PLAMEN_STATUS: COMPLETE -->` once every GAP cell has a
disposition.
