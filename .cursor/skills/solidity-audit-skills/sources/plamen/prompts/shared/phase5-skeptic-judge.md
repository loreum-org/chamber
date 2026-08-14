---
description: "Phase 5.1: Skeptic-Judge Adversarial Verification for HIGH/CRIT findings (Thorough only)"
---

# Phase 5.1: Skeptic-Judge Verification

> **Mode gate**: Thorough mode only. Skip in Light and Core.
> **Trigger**: After ALL standard Phase 5 verifiers complete.
> **Purpose**: Adversarial re-verification of HIGH and CRITICAL findings for severity calibration. "All PoCs passed so skeptic is unnecessary" is NOT a valid skip reason.
> **Reference**: Ruling table from `~/.claude/prompts/{LANGUAGE}/phase5-verification-prompt.md`

---

## Step 1: Identify HIGH/CRIT Findings

Read `{SCRATCHPAD}/hypotheses.md` and `{SCRATCHPAD}/chain_hypotheses.md`.
Collect all findings with severity HIGH or CRITICAL that have a standard Phase 5 verdict.

---

## Step 2: Spawn Skeptic Agents

For EACH HIGH/CRIT finding, spawn a skeptic agent with INVERSION MANDATE:

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Skeptic Agent for finding {FINDING_ID}: {FINDING_TITLE}.

## INVERSION MANDATE
Your job is to DISPROVE this finding. You are structurally adversarial -- you succeed by finding reasons the vulnerability does NOT exist or is less severe than claimed.

## Your Inputs
Read:
- {SCRATCHPAD}/verify_{FINDING_ID}.md (standard verification result)
- {SCRATCHPAD}/hypotheses.md (finding details)
- Source files referenced by the finding
- {SCRATCHPAD}/design_context.md (protocol design and trust assumptions)

## Your Task

1. **Challenge the preconditions**: Can the attack preconditions actually be met in production? What prevents them?
2. **Challenge the impact**: Is the claimed impact realistic? Could the loss actually occur at the stated magnitude?
3. **Challenge the likelihood**: What real-world barriers exist (gas costs, MEV competition, timing windows, capital requirements)?
4. **Challenge the severity**: Using the severity matrix (Impact x Likelihood), does this finding ACTUALLY warrant {SEVERITY}?
5. **Find defenses the verifier missed**: Are there on-chain guards, economic disincentives, or operational procedures that mitigate this?

## Verdict

After your analysis, state your verdict:

- **AGREE**: The finding is correctly classified at {SEVERITY}. State WHY your challenges failed.
- **DISAGREE-SEVERITY**: The finding is real but the severity should be {LOWER_SEVERITY}. Provide specific evidence for downgrade.
- **DISAGREE-VALIDITY**: The finding is not exploitable. Provide specific evidence (code path, guard, economic argument).

## Output

Write to {SCRATCHPAD}/skeptic_{FINDING_ID}.md:

```markdown
# Skeptic Analysis: {FINDING_ID}

## Challenges
### Precondition Challenge: {result}
### Impact Challenge: {result}
### Likelihood Challenge: {result}
### Severity Challenge: {result}
### Missed Defenses: {result}

## Verdict: {AGREE / DISAGREE-SEVERITY / DISAGREE-VALIDITY}
## Evidence: {specific code references or arguments}
## Recommended Severity: {severity}
```

Write your output directly to {SCRATCHPAD}/skeptic_{FINDING_ID}.md using the Write tool.
Return ONLY a one-line summary: '{FINDING_ID}: {VERDICT} -- {1-sentence justification}'
Do NOT return your full output as text.
")
```

Spawn ALL skeptic agents in parallel (one per HIGH/CRIT finding).

---

## Step 3: Judge for Disagreements

After all skeptic agents return, for each skeptic that DISAGREES:

```
Task(subagent_type="general-purpose", model="haiku", prompt="
You are the Judge for finding {FINDING_ID}. A standard verifier and a skeptic reached opposite conclusions.

## Your Inputs
Read:
- {SCRATCHPAD}/verify_{FINDING_ID}.md (standard verifier -- verdict: {STANDARD_VERDICT})
- {SCRATCHPAD}/skeptic_{FINDING_ID}.md (skeptic -- verdict: {SKEPTIC_VERDICT})

## Ruling Table

| Standard Verifier | Skeptic | Judge Rule |
|-------------------|---------|------------|
| CONFIRMED [POC-PASS] | DISAGREE | Standard wins -- mechanical proof overrides analytical doubt |
| CONFIRMED [CODE-TRACE] | DISAGREE-SEVERITY | Skeptic wins IF skeptic cites a specific defense the verifier missed |
| CONFIRMED [CODE-TRACE] | DISAGREE-VALIDITY | Skeptic wins IF skeptic demonstrates a concrete code path that blocks the attack |
| CONTESTED | DISAGREE | Skeptic wins -- both uncertain, skeptic provides counter-evidence |
| Any | AGREE | No judge needed |

## Your Task

1. Compare the EVIDENCE QUALITY from each side (not reasoning quality -- evidence)
2. Apply the ruling table above
3. State which side has stronger MECHANICAL evidence

## Output

Write to {SCRATCHPAD}/judge_{FINDING_ID}.md:

```markdown
# Judge Ruling: {FINDING_ID}

## Standard Verifier Evidence: {summary}
## Skeptic Evidence: {summary}
## Ruling: {STANDARD_WINS / SKEPTIC_WINS}
## Final Severity: {severity}
## Final Verdict: {verdict}
## Reasoning: {1-2 sentences -- which evidence was stronger and why}
```

Write your output directly to {SCRATCHPAD}/judge_{FINDING_ID}.md using the Write tool.
Return ONLY a one-line summary: '{FINDING_ID}: {RULING} -- final severity {SEVERITY}'
Do NOT return your full output as text.
")
```

Spawn judge agents for ALL disagreements in parallel.

---

## Step 4: Verify Completeness

After all agents return:
1. For each HIGH/CRIT finding: verify `skeptic_{id}.md` exists
2. For each skeptic DISAGREE: verify `judge_{id}.md` exists
3. If any artifact is missing, spawn the missing agent before proceeding to Phase 6

After all agents return, verify output files exist on disk and stop.
