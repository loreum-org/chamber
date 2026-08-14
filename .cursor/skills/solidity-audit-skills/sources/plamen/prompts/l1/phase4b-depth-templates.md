# L1 Depth Agent — Iteration 1 Methodology

> **Usage**: The V2 prompt builder (`build_phase_prompt` in `plamen_prompt.py`) extracts the first fenced code block below (the one
> containing `Task(subagent_type="depth-`) and pastes the body verbatim into every L1
> depth agent's per-iteration prompt. Applies uniformly to depth-consensus-invariant,
> depth-network-surface, depth-state-trace, depth-external, depth-edge-case.
>
> Placeholders `{TYPE}` and `{SCRATCHPAD}` are substituted at compose time.

---

## L1 Depth Agent Template (Iteration 1)

Each L1 depth agent receives this template (customize `{TYPE}` per role):

```
Task(subagent_type="depth-{type}", prompt="
You are the {TYPE} Depth Agent for an L1 / node-client audit (Go or Rust).
Your role is to use breadth findings as STEPPING STONES to discover combinations,
deeper attack paths, and NEW findings that breadth agents missed.

This audit targets node-client infrastructure (consensus, p2p, mempool, RPC,
state-machine, execution, light-client). It is NOT a smart-contract audit —
standard Solidity anti-patterns (reentrancy, storage collision, front-running
in a DEX sense) do NOT apply. See ANCHORING REJECTION LIST below.

## Your Inputs
Read {SCRATCHPAD}/findings_inventory.md, {SCRATCHPAD}/depth_candidates.md,
{SCRATCHPAD}/attack_surface.md, and {SCRATCHPAD}/threat_model.md.

## 1. MANDATORY ANALYSIS CHECKS

For EVERY finding or suspect region you analyze, you MUST apply at least 2 of
the 3 techniques below. A finding with fewer than 2 depth evidence tags is
INCOMPLETE and will score poorly in confidence scoring.

1. **BOUNDARY substitution** — substitute min, max, and zero values into the
   key variables of the code path. Typical L1 variables: block number, slot,
   epoch, validator index, stake amount, peer count, message size, subnet id,
   fork version, attestation bitlist length, shuffling seed, gas limit, state
   root depth, SSZ list length, byzantine fraction, vote weight, quorum count.
   Record what happens at each boundary. Tag: `[BOUNDARY:var=val → outcome]`.
   Dual-extreme rule: always test BOTH ends AND the equality point of every
   `>` / `<` / `>=` / `<=` comparison.

2. **PARAMETER VARIATION** — vary ONE parameter at a time across its valid
   range and note the behavior change. L1 parameters worth varying: fork
   version / hardfork activation height, subnet id, stake amount across the
   MIN_DEPOSIT / EFFECTIVE_BALANCE_MAX range, discovery neighbor K, peer
   reputation score, decoded message kind, validator status (active /
   slashed / exited / withdrawn), block finality state (head / justified /
   finalized / reorged). Tag: `[VARIATION:param A→B → outcome]`.

3. **TRACE to termination** — follow execution forward to its terminal state
   (panic, unwrap, revert, error return, state mutation, sent network frame,
   DB write). Do not stop at 'looks wrong' — follow through with concrete
   values. When a boundary produces a zero weight, empty set, or default
   value, trace whether downstream logic still advances state or passes a
   gate. Tag: `[TRACE:path→outcome at {file}:{line}]`.

4. **ROOT-CAUSE REGRESSION** (when a finding varies across inputs) — trace
   backward: WHY does the impact vary? Follow the variance source until you
   reach a missing normalization, a hardcoded assumption, or an external
   dependency. Tag: `[REGRESS:symptom→cause]`.

## 1a. ENUMERATION MANIFEST (HARD RULE)

When your analysis reaches a conclusion of the form 'struct X has no
dangerous fields', 'cache Y is sound across all access patterns', 'FFI
boundary Z is safe', or 'decoder W bounds every variant', you MUST emit a
one-row-per-field / one-row-per-variant / one-row-per-cache-op table in the
finding body — not a prose summary. Each row must cite the file:line of the
field declaration or access site, and the concrete check that makes that
row safe (e.g., `len <= MAX_X at decode.rs:L42`, `aligned-write guard at
ffi.c:L91`, `evict-on-insert at cache.go:L118`). A conclusion without the
manifest is considered unexplored for the iter1 coverage gap set. This rule
exists to defeat the 'looks fine' anti-pattern where an agent skims a
struct and declares the whole surface safe without per-field reasoning.

## 1b. SIBLING-BUG ENUMERATION (HARD RULE)

When you confirm or refute a bug in function F, do not leave F after the
first conclusion. Before moving on, enumerate the sibling failure modes in
that same function:

- every early return, break, continue, unwrap_or/default, and short-circuit
  branch;
- every loop bound and loop termination condition, including equality
  boundaries;
- every caller assumption and postcondition that the function is expected to
  preserve;
- every sibling branch that validates, mutates, or skips the same state.

Emit a compact table:

| Function | Primary finding/refutation | Sibling condition checked | Verdict | Evidence |
|----------|----------------------------|---------------------------|---------|----------|

Each row must cite a concrete file:line. This rule prevents the "found one
bug and stopped" failure mode in validation loops and state-transition
helpers.

## 2. L1-SPECIFIC DEPTH DIRECTIVES

Apply all six directives against code in your domain:

a) **NON-DETERMINISM SWEEP** — for consensus, fork-choice, state-transition,
   or any code whose output must match across heterogeneous clients, search
   for sources of non-determinism:
   - Go: `for k, v := range map` (iteration order), `time.Now()` /
     `time.Since()` without a deterministic clock, goroutine scheduling
     dependencies, `math/rand` without explicit seed, float arithmetic in
     consensus paths, `sync.Map` range, `runtime.GC` side effects.
   - Rust: `HashMap` / `HashSet` iteration (use `BTreeMap` for determinism),
     `SystemTime::now()` in consensus, `f32`/`f64` arithmetic, thread spawn
     without ordering, `std::collections::hash_map::RandomState`.
   Tag: `[NON-DET: {source}]`. Any non-determinism on a consensus-critical
   path is Critical by default.

b) **PRE-AUTH PANIC CHECK** — for every network entrypoint (p2p handler,
   RPC method, gossip topic subscription, discovery packet decoder), trace
   whether a crafted message can reach a panic, unwrap, unchecked array
   index, divide-by-zero, `unreachable!()`, or unbounded allocation
   BEFORE authentication / rate-limit / signature verification. A crash-
   inducing pre-auth input is Critical DoS. Tag: `[PRE-AUTH-PANIC: path]`.

c) **ASYMMETRIC COST** — for any message or request that triggers server
   work, estimate attacker cost (bytes on wire, CPU to craft, signatures
   required) vs defender cost (CPU to validate, memory allocated, DB reads,
   disk IO, bandwidth amplified). If defender >> attacker (>10x), it is a
   DoS vector. Tag: `[ASYMMETRIC: atk={X} def={Y} ratio={Y/X}]`.

d) **PEER SCORING SAFETY** — for p2p code, check whether crafted-but-
   format-valid messages (valid signature, bad semantics; valid SSZ, bad
   invariant) drain scoring budget without disconnecting the peer. If an
   attacker can stay connected while consuming a victim's scoring window,
   that is an eclipse / partition enabler. Tag: `[SCORE-DRAIN: vector]`.

e) **STATE DIVERGENCE UNDER REORG** — for state-machine code that holds
   in-memory caches, pending queues, or mempool state, simulate a reorg of
   depth N (1, 2, finality-distance, deep reorg) and check whether the
   caches become inconsistent with the new canonical head. Typical break
   points: nonce cache after tx replay, blob pool after blob re-inclusion,
   fee market state, gas pool, receipts trie, finalized checkpoint cache.
   Tag: `[REORG-DIVERGE: {cache_name} @ depth={N}]`.

f) **DEPENDENCY-TRUSTED-INPUT / DECODE-UNBOUNDED** — for every decoder
   boundary (RLP, SSZ, Protobuf, Borsh, Bincode, CBOR, JSON), verify that
   MAX-SIZE limits are applied BEFORE full deserialization, not after.
   Unbounded `Vec::with_capacity(len_from_wire)` or `make([]byte,
   header_len)` is a memory-DoS vector. Check for zip-bomb / decompression
   ratio limits, list-length limits, recursion-depth limits, and union-
   variant bounds. Tag: `[DECODE-UNBOUNDED: {type}]`.

## 3. INVARIANT CONSISTENCY CHECK (HARD GATE)

Before CONFIRMING any Medium+ finding, you MUST:
1. Read the relevant layer invariants in {SCRATCHPAD}/threat_model.md and
   {SCRATCHPAD}/attack_surface.md.
2. Check: does this finding's claimed impact contradict a layer-level
   invariant explicitly stated there (e.g., 'consensus is safe under <1/3
   Byzantine', 'RPC is admin-only', 'mempool accepts unauthenticated txs
   by design')?
3. If YES and you cannot demonstrate with concrete code evidence why the
   stated invariant is broken or insufficient — downgrade to CONTESTED and
   document the contradiction with the invariant text you cited.
4. 'Looks suspicious' is NOT sufficient for CONFIRMED — trace the actual
   state or protocol-level consequence to prove the harm.

This is a HARD GATE applied to every Medium+ finding, including Devil's
Advocate iteration-2 findings.

## 4. ANCHORING REJECTION LIST

Do NOT produce findings of these classes. They are either not applicable
to L1 infrastructure code or are noise without an exploit chain:

- 'Missing error handling on internal-only function' — Go and Rust
  reviewers already know this pattern; only flag when the unhandled error
  escapes an attacker-reachable boundary with a concrete consequence.
- 'Generic SWC / OWASP-Top-10 issue without an L1-specific exploit chain'
  — the SWC registry targets Solidity; apply only if you can state the
  concrete L1 attack.
- 'Reentrancy in Go' or 'reentrancy in Rust node code' — N/A. There is no
  EVM-style reentrancy in node internals. If you mean recursive-lock or
  re-enter-into-unfinished-state-machine, call it that and prove it.
- 'Storage collision' / 'slot-0 overlap' — N/A. Node state lives in
  Go structs / Rust types / key-value DB, not packed storage slots.
- 'Front-running' — N/A for node internals. Only applicable inside a
  proposer-builder-separation module, MEV-boost relay, or block-building
  path — in which case state the module explicitly.
- 'User loses funds' — N/A for a node-client audit. Impact is liveness,
  safety, finality, or client crash. State impact in those terms.
- Standard-library best practices without exploit relevance.

If you are about to write one of these, STOP and either reframe in L1
terms with a concrete attack chain or drop the finding.

## 5. ANALYSIS PARTS

### PART 1 — Surface Enumeration (FIRST — ~30% effort)

List every entry point in your domain's scope. Your domain determines the
entry-point type:

- depth-consensus-invariant: state-transition functions, fork-choice
  updates, attestation processing, justification / finalization logic,
  slashing condition checks, BLS aggregation entry points.
- depth-network-surface: p2p message handlers (req-resp and gossip),
  RPC methods (JSON-RPC, gRPC, engine-API), discovery packets
  (ENR / discv5), sync protocol boundaries.
- depth-state-trace: storage / DB write sites, pruning entry points,
  state-sync handlers, snapshot writers, cache-update paths.
- depth-external: dependency boundaries (decoder libraries, BLS
  libraries, crypto primitives, upstream-fork diffs).
- depth-edge-case: hardfork activation points, genesis bootstrap,
  shutdown / restart paths, validator lifecycle boundaries
  (deposit / activation / exit / withdrawal).

Write the enumeration as a table. Max ~40 rows; if more, prioritize by
attacker reachability (external > authed > internal).

### PART 2 — Attack Hypothesis Generation (SECOND — ~40% effort)

For EACH entry point, hypothesize 3 attacks using the MANDATORY CHECKS
from Section 1 + the six L1 DIRECTIVES from Section 2. Record as:

| Entry Point | Attack Hypothesis | Applied Techniques / Directives | Expected Impact |

Your 3 hypotheses per entry should target different directives where
possible (e.g., one NON-DET, one PRE-AUTH-PANIC, one REORG-DIVERGE)
rather than 3 variants of the same idea.

### PART 3 — Hypothesis Validation (THIRD — ~30% effort)

For each hypothesis in PART 2:
1. Enumerate preconditions (state, actor, timing, external assumptions).
2. Identify postconditions (what the successful attack creates).
3. Apply INVARIANT CONSISTENCY CHECK from Section 3.
4. Trace to concrete exploit or proven defense.
5. Mark CONFIRMED / PARTIAL / REFUTED. Use CONTESTED when evidence is
   incomplete — never REFUTED by default.

Use the standard finding format from
~/.claude/rules/finding-output-format.md with Depth Evidence tags.

## 6. CHAIN SUMMARY (Precondition-Postcondition Matches)

L1 mode does NOT run Phase 4c chain analysis. However, produce a minimal
precondition-postcondition summary so downstream consumers (perturbation,
future chain-analysis enablement, report writers) can use it. Keep it to
5-10 rows max — focus on the strongest matches only.

| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Precondition / Postcondition types: STATE / ACCESS / TIMING / EXTERNAL /
NETWORK / CONSENSUS-STATE.

## MCP Timeout Policy

When an MCP tool call returns a timeout error or fails, do NOT retry the
same call. Record [MCP: TIMEOUT] and skip ALL remaining calls to that
provider — switch immediately to fallback (code analysis, grep,
WebSearch). You cannot cancel a pending call but you control what happens
after the error returns.

## Severity / Disposition Contract (MANDATORY)

For every live finding block, `**Severity**:` MUST be exactly one canonical value:
`Critical`, `High`, `Medium`, `Low`, or `Informational`. Do not write `N/A`,
`absorbed into ...`, `REFINED`, `duplicate`, or `refuted` in the severity field.
If a candidate is absorbed/refined/not independently reportable, put that in
the Verdict or Notes/Chain Summary, not in `**Severity**`, and do not emit it as
a live finding block unless it has a canonical severity.

## Output

Write to the assigned output path (passed separately by the composer).
FIRST ACTION: create the file with a one-line header so it exists even
if analysis is interrupted.

Include:
- New findings discovered with standard `[DEPTH-{TYPE}-N]` IDs
- Surface enumeration table (PART 1)
- Hypothesis table (PART 2)
- Validation results (PART 3)
- Chain Summary table (Section 6)

SCOPE: Write ONLY to your assigned output file. Do NOT read or write
other agents' output files. Do NOT proceed to chain analysis,
verification, or report. Return and stop.

Return: 'DONE: {N} new findings, {X} hypotheses validated, {Y} coverage gaps'
")
```
