# Skeptic-Judge Adversarial Verification

> **Mode gate**: Thorough mode ONLY.
> **Purpose**: Adversarial re-verification of HIGH and CRITICAL findings via
> inversion mandate and judge escalation.
> **Read templates from**: `~/.claude/prompts/{LANGUAGE}/phase5-verification-prompt.md`
> -> "Skeptic-Judge Verification" section for language-specific details.

---

## Overview

The Skeptic-Judge phase applies adversarial pressure to HIGH and CRITICAL
findings. Its purpose is severity calibration: ensuring that findings rated at
the highest tiers withstand structural opposition.

**"All PoCs passed so skeptic is unnecessary" is NOT a valid skip reason.**
The skeptic tests different things than the PoC: deployment assumptions,
environmental constraints, economic viability, governance response, and whether
the stated severity matches the realistic worst case.

---

## Identification

From the verify outputs already on disk:

1. Read `{SCRATCHPAD}/skeptic_manifest.json` first when it exists. It is the
   authoritative list of Critical/High finding IDs this phase must cover.
2. If the manifest is absent, identify all HIGH and CRITICAL findings with
   reportable standard verdicts from `verify_*.md` files.
3. Review each finding in this phase process. Do NOT spawn nested subagents.

---

## Skeptic Review - Inversion Mandate

For EACH HIGH/CRIT finding, apply structural inversion:

> Your job is to DISPROVE this finding. You are structurally opposed to its
> current verdict. Find every reason it could be wrong, overstated, or
> impractical. You succeed when you identify a concrete defense, precondition,
> or environmental constraint that the verifier missed.

### What the Skeptic Analyzes

1. **Precondition feasibility**: Are the attack preconditions actually
   achievable in production?
2. **Economic viability**: Does the attack cost exceed the profit? Include gas,
   capital lockup, and opportunity cost.
3. **Environmental constraints**: Are there deployment-context defenses
   (timelocks, multisig, monitoring) that block the attack path?
4. **Severity calibration**: Even if the bug exists, is the stated severity
   accurate? Could impact be lower than claimed?
5. **Alternative interpretations**: Is there a benign interpretation of the same
   code behavior?

### Skeptic Output

Write all skeptic reviews to `{SCRATCHPAD}/skeptic_findings.md`:

```markdown
# Skeptic Findings

## {finding_id} - {title}

Verdict: AGREE / DISAGREE
Original Severity: Critical/High
Proposed Severity: Critical/High/Medium/Low
Decision: KEEP / DOWNGRADE / UNRESOLVED

### Defense Identified
[What defense, constraint, or precondition blocks exploitation, or "None found"]

When you name a defense/precondition as blocking exploitation (i.e. a DOWNGRADE
or refute of a value-bearing finding), do NOT stop at "the defense holds". Commit
that defense as a falsifiable assertion and hand it to the falsifier. Emit a
`committed-invariant [CI-n]` block encoding the named defense as exactly ONE of
the six generic SHAPES — `CONSERVATION`, `REQUESTED_EQ_DELIVERED`,
`APPROVE_EQ_SPEND`, `NO_REVERT_AT_BOUNDARY`, `ROUNDTRIP`, `FRESHNESS` — with
symbols resolved at the locus but no protocol constant baked as "the answer":

```
committed-invariant [CI-n]
Locus: <file>:L<nn>  (fn: <enclosing function>)
Shape: <one of the six shapes>
Assertion: <the falsifiable defense relation, symbols resolved>
Falsify Class: <property | boundary | roundtrip | conservation>
Provenance: skeptic DOWNGRADE @ <finding_id>
```

This is strictly additive: it does not change your Decision, severity, or any
prior finding. The block is mechanically harvested downstream into a falsifiable
candidate — a survived assertion confirms the defense; a triggered one is a real
bug the downgrade would otherwise have hidden.

### Evidence
[Code references, deployment context, economic analysis]

### Recommended Action
[Keep severity / Downgrade severity / Mark unresolved]
```

---

## Judge Escalation Logic

### If Skeptic AGREES

Final verdict = the standard verifier verdict already on disk for this
finding. It has survived adversarial pressure. Still write a row in
`skeptic_judge_decisions.md` with `Decision = KEEP`.

### If Skeptic DISAGREES

Apply "prove it or lose it" judge framing inline. Do NOT spawn a judge subagent
and do NOT write `judge_<id>.md` shard files.

Use these rules:

1. `[POC-PASS]` outweighs theoretical arguments — **but only when sourced
   from `verdict_manifest.json` `effective_tag`**, not from the verifier's
   prose `Evidence Tag` field. v2.0.8 (P3): the driver writes
   `verdict_manifest.json` after mechanical PoC execution. For each finding
   it records:
   - `mechanical_status`: PASS / FAIL / NO_TEST_FILE / etc.
   - `verifier_prose_tag`: what the verifier WROTE.
   - `integrity_state`: CONSISTENT | INFLATED_PROSE | MECHANICAL_UNAVAILABLE.
   - `effective_tag`: the authoritative evidence tag (mechanical truth
     wins; inflated prose gets downgraded to `[CODE-TRACE] [INTEGRITY-DOWNGRADE]`).
   When `integrity_state == INFLATED_PROSE`, the verifier claimed proof
   that mechanical execution could NOT confirm — weigh the finding using
   the downgraded `effective_tag`, NOT the inflated prose claim.
2. `[CODE-TRACE]` with real constants outweighs speculation.
3. Concrete defense (code-level mitigation) outweighs "the protocol could add a
   timelock".
4. The side that cites more specific code locations (`file:line`) wins ties.

Write every final ruling to `{SCRATCHPAD}/skeptic_judge_decisions.md`:

```markdown
# Skeptic Judge Decisions

| Finding ID | Original Severity | Final Severity | Decision | Rationale |
|------------|-------------------|----------------|----------|-----------|
```

Each reviewed finding ID must appear literally in this table. If the skeptic
disagrees and the judge cannot determine a clean winner, use
`Decision = UNRESOLVED` and apply a one-tier severity demotion with floor Low.

---

## Ruling Table

| Skeptic Verdict | Judge Ruling | Final Action |
|-----------------|--------------|--------------|
| AGREE | N/A | Keep original verdict and severity |
| DISAGREE | VERIFIER_WINS | Keep original verdict and severity |
| DISAGREE | SKEPTIC_WINS | Downgrade severity by 1 tier OR mark CONTESTED |
| DISAGREE | UNRESOLVED | Demote by 1 tier and retain in report body |

---

## UNRESOLVED Outcomes

When evidence is balanced or deployment-specific assumptions are required, the
outcome is `UNRESOLVED`:

- UNRESOLVED findings receive a -1 tier severity demotion (floor: Low).
- They REMAIN in the report body, not Appendix A.
- The tier writer flags them as `[UNRESOLVED - needs human review]`.
- The report includes both the verifier's case and the skeptic's case.

Both `UNRESOLVED` and `PARTIAL` carry the same semantics.

---

## Skip Rules

| Mode | Behavior |
|------|----------|
| Light | Skip entirely |
| Core | Skip entirely |
| Thorough | MANDATORY for every HIGH and CRITICAL finding |

In Thorough mode, this step MUST execute regardless of whether all PoCs passed,
the codebase is small, findings seem well-characterized, or context budget feels
limited.

Skipping this phase in Thorough mode is a WORKFLOW VIOLATION logged to
`{SCRATCHPAD}/violations.md`.

---

## Artifact Verification

Before returning, verify:

1. `skeptic_findings.md` contains a section for every manifest finding ID.
2. `skeptic_judge_decisions.md` contains a row for every manifest finding ID.
3. Section headings and judge-table `Finding ID` cells use only manifest
   finding IDs. Do not invent alternate IDs such as `CC-*`, `EX-*`, `OR-*`, or
   shorthand `INV-*` labels. If upstream/local labels are useful context, keep
   them in prose and do not treat them as reviewed finding IDs.

If any entry is missing, repair the aggregate files before returning.

---

## Output

Write ONLY:

- `{SCRATCHPAD}/skeptic_findings.md`
- `{SCRATCHPAD}/skeptic_judge_decisions.md`

Do NOT write `skeptic_{finding_id}.md`, `judge_{finding_id}.md`,
`judge_<id>.md`, report files, cross-batch files, or report-index files.

Return only: `DONE: {N} High/Critical findings reviewed`.

---

## Budget

| Component | Cost |
|-----------|------|
| Skeptic review | Current phase process |
| Judge framing | Inline in current phase process |
| Typical total | 1 phase subprocess |
