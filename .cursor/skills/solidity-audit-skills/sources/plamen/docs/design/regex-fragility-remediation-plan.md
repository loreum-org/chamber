# Fragile-Regex Class: Full Pipeline Audit + Safe Integration Plan

> **STATUS: IMPLEMENTED & SHIPPED (retained as historical record).**

## 1. Verdict

**Fixed.** This was a live, recurring vulnerability class, not a set of isolated bugs.

| Metric | Count |
|--------|-------|
| Documented post-mortems patching this class | ~15 versions (v2.1.7 → v2.8.16) |
| Distinct fragile sites/bundles in memory catalog | 19 |
| Fragile-regex gates found in this audit (validators + parsers + driver) | **30+** across 3 files |
| Currently LIVE/unfixed (confirmed in code today) | **3** (all surfaced by a prior run) |
| **Recall-risk / gating (can silently drop a finding or HALT a run)** | **5** |
| **Retry-waste (futile/unwinnable retries)** | **~5** |
| **Noise (false-WARN, non-blocking)** | **~8+** |

The dominant historical failure mode is **false-WARN / futile-RETRY**, but the most *damaging* (and the reason this is not closeable by patching) is the **silent-drop class**: an under-matching regex in a safety-net gate produces empty-harvest → empty-diff → silent pass, which is **strictly worse than no gate** because it manufactures false confidence (v2.2.2 lost 31 verified Medium findings; v2.1.7 wrote ~30 findings as 0-finding placeholders; v2.3.3 produced a 42-byte `AUDIT_REPORT.md`).

`plamen_prompt.py` is a **non-participant** (0 LLM-output gates — it parses the shipped V1 template). `plamen_driver.py` is a **minor** participant (~5 true LLM-signal gates). The surface lives in **`plamen_validators.py`** (consumer gates) and **`plamen_parsers.py`** (signal extractors).

---

## 2. The Audit — prioritized by impact tier

### TIER A — GATING / RECALL-RISK (can HALT or silently drop)

| File:Line | Function | Signal | Consumer | Shape it misses |
|-----------|----------|--------|----------|-----------------|
| validators.py:18561-18613 | `_validate_inventory_structure._has_field` | Per-finding Source IDs / Severity / Location / Preferred Tag | Inventory hard-issue list; >40% missing → **HALT/retry** | `:`-only separator; **table cell `\| Severity \| High \|`**, `=` sep, backtick label. Uniform-tabular inventory trips the 40% hard issue. |
| driver.py:8907-8952 | niche spawn-manifest parse | Which niche agents are `Required=YES` | Depth-phase spawn pool — missed row = **whole analysis lane never spawns** | Heading must be exactly `Niche Agents`; Required cell literal `YES` (misses `Required`/`Y`/`✓`). |
| parsers.py:7009-7018 | `_MATRIX_IMPACT_RE` / `_MATRIX_LIKELIHOOD_RE` | Impact × Likelihood severity axes | `_enforce_severity_matrix` → expected-severity provenance gate | Leading-key-only, **TABLE-BLIND** (`\| Impact \| High \|` yields nothing → matrix silently skipped). |
| parsers.py:8648-8675 | `_NO_FINDINGS_HEADING_RE` / `_FINDINGS_SECTION_RE` | `## No Findings` rationale / `## Findings` | `_structural_completeness_ok` HARD completion gate | `^##` H2-exact; H1/H3 drift false-fails a complete negative-result artifact. |
| parsers.py:7996-8021 / 7053-7056 | `_non_reportable_marker` / `_MATRIX_VIEW_FN_RE` | refuted/duplicate/merged + downgrade modifiers | Forces severity→Informational + verdict→REFUTED | **NEGATION-BLIND substring** — "this is NOT a duplicate" silently demotes a real finding. |

### TIER B — RETRY-WASTE (futile / unwinnable retries)

| File:Line | Function | Signal | Shape it misses |
|-----------|----------|--------|-----------------|
| validators.py:19739-19794 | `_valid_poc_skip` mock-negation | Valid `EXTERNAL_DEPENDENCY_NO_FORK` PoC-skip | **LIVE.** 80-char-proximity `.{0,80}` DOTALL: any negation within 80 chars of `mock` false-fires across sentence boundaries → **verifier provably cannot win**. Secondary: `_poc_contract_required` (L19857) reads queue `poc class` not the verifier's reclassified `PoC Class:` ledger field. |
| driver.py:3066-3078 | `_chain_chunk_output_valid` (refactored away) | Impact / Source IDs presence in CC-chunk | Requires literal `^**Impact**:` bold+colon+line-start; misses em-dash, `Source ID:` singular, table-cell. |
| validators.py:7073 / 8608 | `_parse_inventory_finding_meta` (+ tolerant twin) | title/severity/location/root_cause | Heading requires `:` after `]`; fields require literal bold+`:`. Two near-duplicate copies. |
| parsers.py:4880 | `_compute_dedup_candidate_pairs` | Location / Severity for dedup pairing | Raw `**Location**:` / `**Severity**:` exact — misses bullet/plain/table/`**Location:**`. |
| parsers.py:2120-2221 | `classify_poc_testability` | PoC class from keyword substrings | No negation, no word boundary — "no overflow check" hits `overflow`→narrow_unit→impossible harness. |

### TIER C — NOISE (false-WARN, non-blocking)

| File:Line | Function | Status | Shape it misses |
|-----------|----------|--------|-----------------|
| validators.py:3643-3648 | `_SEMANTIC_GAP_COUNTER_RE` | **LIVE** (word-fallback protects) | Requires `:`/`=`; misses table cell `\| \`sync_gaps\` \| **5** \|` — loses the count. |
| validators.py:8789-8853 | `_validate_invariants_pass2` `_FLAG_TOKEN` (refactored away) | **LIVE** (soft) | Same pipe-blindness as sibling counter. |
| validators.py:8854-8998 | `_validate_attention_repair` SAFE_REASON closure | **LIVE** (soft) | Rigid `SAFE_REASON:<ENUM>`; flags rich `[TRACE]`/`[VARIATION]` prose closures. |
| validators.py:10188-10224 | `_missing_perturbation_block_ids` | soft (under-warns) | Verdict/Severity literal bold+`:`. |
| validators.py:9256-9288 | step-trace file:line | NOISE / **internal inconsistency** | Accepts only `file:L42`; twin now unified at L9223 accepts `lines 42`/`L42`(space)/`#L42`. |
| validators.py:13261 | `internal_id_leak` | gating FP (v2.7.8) | ID findall over prose flags legit report IDs. |
| validators.py:19221 | `_has_live_placeholder_language` | **DEAD** (v2.7.9) | 6 stacked negation exemptions — the whack-a-mole exhibit. |
| parsers.py:4399-4432 | `_parse_source_findings_for_ids` | NOISE | `^###` H3-exact; `**Location**:` literal. |

---

## 3. Why whack-a-mole failed

**The root pattern (confirmed across ~15 versions):** the driver makes control-flow / gating / counting decisions by extracting *structured signals* out of *free-form LLM prose* with *exact-format regexes*. The LLM renders the same datum in a different valid shape each run, so every single-shape regex has recurring false-negatives.

Every post-mortem patched **one shape at one site**:
- **v2.2.2** widened one ID regex (`H-\d+` → `H-[CHMLI]?\d+`) — then *immediately found the same bug in a sibling filename regex*. The bug class replicates.
- **v2.1.7** fixed one counts heading; **v2.3.5** fixed four more in one sweep yet still left ~7 deferred.
- **v2.5.1** found ~20 sites, shipped 13; **v2.5.3** hardened 26 entry points; **v2.8.0** audited ~30 gates.
- Cadence hit **4 hits in 48h (v2.3.1/2/3/4)** → the user called the approach *"flawed at possibly every phase"* and directed **"stop patching."**

Three escalating durability levels emerged: **L1 per-shape** (widen one regex — never converges); **L2 per-class** (shared primitives `_llm_norm`, `_is_separator_row`, `_field_from_markdown`, `_match_canonical_header`, plus unified ID/tag sources-of-truth — reduces but doesn't eliminate); **L3 architectural (v2.3.3 + v2.8.0)** (deterministic fallback from a driver-owned artifact; prose gates = WARNING, mechanical gates = FAIL). The deferred plan is the **missing L4 capstone**.

**The union of shapes a real fix MUST cover** (from `must_cover_shapes`):
- **Separator/structure:** table cell `\| key \| val \|` (the `\|` as kv-separator — #1 live miss), separator rows containing literal `---`, variable column counts, last-column-wins for IDs, header-driven column mapping.
- **KV separators:** `:` / `=` / `\|` / bullet `- key: val` / whitespace-only.
- **Wrappers:** `**bold**`, `**label:**`, `` `backtick` ``, `[bracketed]`, `_underscore_`, leading `- `/`* `, indentation — on **both labels and values and IDs**.
- **Case:** insensitive everywhere.
- **Heading level/synonyms:** `#{1,6}`; H2-vs-H3 body termination; `Operational Implications`≈`Implications`, `Master Finding Index`≈`Promoted Findings`; appendix-class negative-scope set.
- **Field-label aliases:** `Preferred Tag`≈`Preferred Verification`≈`Evidence Tag`; `Finding ID`≈`ID`; PoC headings & skip-labels; status `SPAWNED`≈`COMPLETED`/`DONE`/`YES`.
- **ID formats (catalog ALL):** SC `H-22`, L1 `H-C01`/`L1-H-12`, chain `CH-1`/`CC-1`, `F-01`, verbose `DEPTH-CONSENSUS-INVARIANT-1`, leading-zero `H-1`≡`H-01`, filename `verify_H-C01.md` — permissive capture + category validation, **not** prefix enumeration.
- **Numeric:** `1,234`, `~500`, `≈500`, `500 lines`, `500 LOC`.
- **Negation-near-keyword:** must NOT false-fire when negation governs an *unrelated* noun (the live `_valid_poc_skip` bug); word-boundary so `id`≠`invalid`, `covered`≠`uncovered`.
- **Prose-vs-structured:** narrative bullets + range shorthand (`H-01 through H-20`) instead of a table; rich free-text closures vs rigid token form.
- **Text normalization:** CRLF→LF, HTML entities, smart quotes, zero-width, ANSI/control.

---

## 4. Safe Integration Plan

### Architecture: 3-layer signal channel + gate-class discipline

**L1 — Mandated machine-readable signal block (source-side, deterministic).** Every signal-*producing* phase emits a fenced machine block parsed with zero shape ambiguity. **Extend the already-proven `<!-- PLAMEN_X: value -->` HTML-comment channel** (driver L7913 parser `re.finditer(r"<!--\s*PLAMEN_([A-Z_]+):\s*([^>]+?)\s*-->")`, already used for STATUS/ARTIFACT/EXPECTED_OUTPUT, whitespace-tolerant + format-invariant) with a `PLAMEN_SIGNALS` family carrying single-line JSON:
```
<!-- PLAMEN_SIGNALS: {"sync_gaps":5,"accumulation_exposures":0,"conditional_writes":2,"cluster_gaps":1} -->
```
Appended right before the agent's `PLAMEN_STATUS: COMPLETE` marker — the same disk-gate-validated region the driver already trusts. JSON inside an HTML comment is deterministic by construction; no shape variance possible.

**L2 — One shared, fixture-hardened tolerant extractor (`_field_anywhere`).** Fallback for legacy/malformed/missing blocks. **Not new infrastructure** — it *converges* the ~15 scattered raw regexes onto the existing tolerant toolkit (`_llm_norm`, `_field_from_markdown`, `_split_markdown_table_row`, `_match_canonical_header`, `_INTERNAL_FINDING_ID_RE`/`_FID_ALLOWED_PREFIXES`/`_DEPTH_EVIDENCE_TAG_RE`). The single gap it closes: **table-cell kv extraction** + an **opt-in clause-scoped negation guard**. Signature:
```python
def _field_anywhere(text, labels, *, value_pattern=None, table_ok=True,
                    negation_guard=False, first_match=True) -> tuple[str, str]:
    # returns (value, shape_tag in {kv,bullet,bold,backtick,table,heading,none})
```
Tolerance rules: `_llm_norm` first; delegate kv/bullet/bold/backtick to `_field_from_markdown`; **ADD** table-cell scan; alias matching with word-boundary for ≤3-char labels + longest-first; ID/tag validation via canonical sources; `#{1,6}` headings + synonyms; **clause-scoped negation** (suppress only when negation shares the same clause/sentence as the trigger — fixing the `_valid_poc_skip` cross-sentence false-fire).

**L3 — Gate-class discipline (v2.8.0 principle, enforced uniformly).** A gate hard-FAILs **only** when parsing a mechanical artifact the driver owns (file existence, ID set, L1 JSON, byte count). A gate parsing LLM **prose** is **WARNING-only** with a deterministic fallback from a driver-rebuilt structured artifact (v2.3.3). **Zero-harvest tripwire** (feedback_id_regex_catalog): every extractor LOGS on empty-harvest-with-nonempty-evidence — turning the silent-failure signature into a visible, test-asserted condition.

### Backward-compat: strict-superset guarantee (nothing that passed before fails now)

`_field_anywhere` accepts a **provable superset** of each old regex. Old behavior is retained as a subset:
- `:` / `=` separators preserved; `\|` table-cell **added**.
- `**Field**:` / `**Field:**` / `` `Field` `` preserved + broadened.
- H2/H3-exact → `#{1,6}` (old matches are a subset).
- Hardcoded `H-\d+` → permissive-capture + category-validate (every old SC ID still matches; L1/chain/verbose/leading-zero newly matched).
- **Negation is the one place behavior intentionally narrows — recall-safely:** the old `_valid_poc_skip` proximity rule was *over-rejecting* valid skips (a recall hazard → futile retry). The clause-scoped guard suppresses *fewer* valid skips, so it can only let MORE valid skips through, never drop a finding.

Each migrated site ships with a `legacy_regex_accepts/` fixture set asserting **value-identity** on the old accept-set, plus negative controls asserting old intended rejects still reject.

### Rollout order (gating / recall-risk FIRST) + regression strategy

Ordering from the design `rollout_order`: **Phase 0** (inert substrate) → **Site 1** inventory-structure HALT gate → **Site 2** niche spawn-manifest → **Site 3** severity-matrix → **Site 4** PoC mock-negation → **Site 5** chain CC-chunk → **Site 6** inventory finding-meta/dedup/source-ID convergence → **Site 7** noise batch last.

Regression strategy against the ~2900-test suite:
1. **Strict-superset proof** per site (mechanical, blocks merge if any legacy accept regresses).
2. **Negative-control preservation** (catches over-broadening — `id`≠`invalid`, proximity-negation, separator rows).
3. **Recall-safe / detection-only** — no migrated gate may DROP a candidate; prose path = WARNING-or-fallback, never FAIL (test-asserted).
4. **Sibling-sweep rule** (v2.2.2 lesson) — when migrating, grep siblings of the same field/ID/shape and migrate in the same commit (e.g. the two `**Location**:` extractors, the step-trace twin L9256 vs L9223, now unified).
5. **Canonical-source reuse** — IDs/tags/severities resolve through single sources-of-truth (v2.4.9/v2.6.0).

---

## 5. Phased execution

| Phase | What to do | Exit criteria |
|-------|-----------|---------------|
| **0 — Substrate (inert)** | Land `PLAMEN_SIGNALS` HTML-comment parser in driver + `_field_anywhere` in parsers.py with full fixture corpus, **zero call-sites migrated**. | Full ~2900 suite shows **0 delta** (proves pure addition). Fixture corpus covers all `must_cover_shapes` per signal incl. the zero-harvest tripwire fixture. |
| **1 — Inventory-structure HALT gate** (validators.py:18561) | Route `_has_field` through `_field_anywhere(table_ok=True)`; emit `PLAMEN_SIGNALS` field-presence from inventory phase as L1 authoritative source. | Tabular-inventory fixture passes (no false 40% hard issue); legacy `:`-form accepts unchanged; full suite green. |
| **2 — Niche spawn-manifest** (driver.py:8907) | Heading + Required-cell via `_field_anywhere` + alias table; recon emits `PLAMEN_SIGNALS` niche list as L1. | All Required-cell variants (`YES`/`Required`/`Y`/`✓`) spawn the lane; heading synonyms matched; existing union-superset repair preserved. |
| **3 — Severity-matrix** (parsers.py:7009) | Route `_MATRIX_*` through `_field_anywhere(table_ok=True, value_pattern=severity_enum)`. | Table + header+row Impact/Likelihood fixtures extract; provenance gate computes matrix instead of silently skipping. |
| **4 — PoC mock-negation** (validators.py:19739) | Replace 80-char DOTALL proximity with clause-scoped `negation_guard`; fix `_poc_contract_required` (L19857) to read verifier `PoC Class:` ledger field. | Live false-fire prose returns valid=True; genuine "no mock provided" still rejected; targeted retry becomes winnable. |
| **5 — Chain CC-chunk + retry-waste** (driver.py:3066, refactored away) | Route Impact/Source-IDs presence through `_field_anywhere`. | Em-dash/singular/table-cell forms accepted; no futile chain retries on complete chunks. |
| **6 — Finding-meta / dedup / source-ID convergence** (validators 7073+8608, parsers 4880+4399) | Converge all `**Field**:`-exact extractors onto `_field_anywhere`; collapse the duplicate twin into one call. | One extractor path; all bold/plain/table/`=` forms; dedup recall up; suite green. |
| **7 — Noise batch (LAST)** (validators 3643/8789/8854/10188/9256, parsers 2120/7996) | Single batch: semantic-gap counter + invariants_p2 (table cell), attention_repair (accept rich prose closures), perturbation verdict/sev, step-trace twin alignment, `_non_reportable_marker` negation guard, `classify_poc_testability` word-boundary+negation. | False-WARN noise eliminated; counts read from table cells; all changes WARNING-class only. |

Each phase is independently shippable, fixture-backed, and recall-safe. A single unexpected suite delta blocks the commit.

---

## 6. Risks + the one rule

**THE ONE RULE: when in doubt, a tolerant extractor must be a strict SUPERSET of the regex it replaces. Never tighten, only broaden. Gating/recall-risk sites get fixtures *before* code.**

Risks and mitigations:
- **Over-broadening** (tolerant extractor matches noise): mitigated by negative-control fixtures + word-boundary for short aliases + clause-scoped (not proximity) negation.
- **The negation narrowing** is the only intentional tightening — proven recall-safe because the old rule over-*rejected* valid PoC-skips; narrowing can only let more valid skips through, never drop a finding.
- **New rendering shapes still appear**: now fixed **once** in `_field_anywhere` (one fixture + tolerance), not re-discovered at 15 sites; and the L1 JSON block makes the authoritative signal shape-independent regardless.
- **Silent residual mismatch** (the strictly-worse-than-no-gate signature): eliminated by the zero-harvest tripwire — empty-harvest-with-evidence now LOGS a WARNING, never silently passes.

Nothing in this plan drops a finding or halts a run: every prose-parsing gate is demoted to WARNING-with-fallback (L3), only deterministic L1 mechanical checks can hard-FAIL, and the strict-superset guarantee means every input that passed before passes now — the only changes are previously-missed shapes now caught (recall up) and the over-rejecting mock-negation narrowed (futile-retry eliminated, recall up).