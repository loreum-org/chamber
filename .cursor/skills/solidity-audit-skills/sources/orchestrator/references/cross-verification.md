# Cross-Methodology Verification

Tier 3. Merges the output of four methodology orchestrators into one finding
set, and decides what the audit actually claims.

## Why this tier is different from the merges below it

Each methodology already merged its own agents. Those merges reason about agents
that **share an author, a framework, a vocabulary and a set of blind spots**:

| Merge | What agreement means there |
|---|---|
| pashov, 12 specialists | Expected overlap — remits intersect by design. Weak signal. |
| omega, 5 generalists | Real evidence — each saw everything independently. |
| quillshield, topic plugins | Expected overlap — adjacent bug classes touch the same lines. |
| plamen, language + injectables | Mixed — some remits nest inside others. |

Across methodologies almost nothing is shared. Four independent teams wrote
them, for different purposes, in different vocabularies, with different
blind spots. So:

> **Cross-methodology agreement is the strongest evidence this system can
> produce.** When an adversarial attacker agent and a structural exit-path lens
> land on the same defect from opposite directions, it is real.

And the trap, which is the same one every merge in this library warns about but
sharper here because there are four sources to average away:

> **A finding raised by one methodology is not weak. It is what that methodology
> exists for.** pashov exists to find what a structural review misses; omega
> exists to find what an attacker sweep misses. Preferring corroborated items
> converges on the intersection of four reviews, which is worse than any one of
> them alone.

## Procedure

### 1. Normalize

Every methodology was told to emit `{bundle}/finding-format.md`. Parse all four
into one table keyed on `(file, function, mechanism)`.

**Key on mechanism, never on title.** The vocabularies differ hardest here — the
same defect will arrive as "unchecked external call return", "CEI violation",
"trust boundary gap" and "asset can be stranded". The test for sameness is
whether **the same code change fixes both**. Apply it literally; when in doubt,
keep them separate and cross-reference.

### 2. Tier by methodology count

| Raised by | Treatment |
|---|---|
| **3–4 methodologies** | Near-conclusive. Accept. Spend your time on the write-up and on getting severity right, not on re-verifying. |
| **2 methodologies** | Strong. Light verification — confirm the mechanism exists, then accept. |
| **1 methodology** | Full verification, every one. See §3. |

Count **methodologies, not agents**. Five pashov agents flagging one line is one
methodology, not five — they share a bundle and a framework. Collapsing agent
counts into methodology counts is the whole point of this tier.

### 3. Verify single-methodology findings

This is the expensive step and it is where the audit earns its value. Most deep
findings arrive from exactly one lens.

For each, go to the code and settle three questions: does the described
mechanism exist, is the state reachable, does the consequence follow? Then
**promote**, **demote to lead**, or **reject with a stated reason**. Never "keep
because it might be real"; never "drop because only one methodology saw it".

Two priors worth applying:

- A finding from the methodology whose remit naturally covers it is more likely
  real — an asset-trapping finding from omega's asset-centric pass, an economic
  finding from pashov's economic agent, a language-semantics finding from
  plamen's language pack.
- A finding in an area **every** methodology covered, raised by only one, needs
  more scrutiny than one in a corner only that methodology reaches.

### 4. Resolve contradictions

Different methodologies will disagree — about whether a guard holds, whether a
path is reachable, or how severe something is.

Resolve **in the code**, never by majority and never by averaging severities.
Three outcomes:

- **One is right.** Take it, and note the misreading — if a competent
  methodology misread this code, that is worth a line in the report even when
  the code is correct.
- **Both partly right.** Usually means the behaviour is state-dependent and
  neither enumerated the states. That is itself the finding.
- **Unresolvable.** Then the code is genuinely unclear, which is reportable at
  `info` at minimum: independent methodologies reached opposite conclusions from
  the same source.

Do not resolve by re-engaging a methodology. They are finished; asking one
anchors the answer.

### 5. Chain across methodologies

The composite findings only this tier can see: methodology A's output is
methodology B's precondition.

An unchecked value from a quillshield external-call finding feeding an omega
accounting drift; a plamen language-semantics quirk enabling a pashov economic
extraction. Neither methodology could see the chain because neither held both
halves.

For each pair of confirmed findings, ask whether one's consequence satisfies the
other's precondition, and whether the combined impact exceeds either alone. File
those as their own findings at `min(severity of the links)` unless the
composition escalates it — which it often does. Expect zero to three per audit;
they are frequently the highest-severity items in the report.

### 6. Reconcile the cleared lists

An area is reported as "checked and found sound" only when **at least two
methodologies examined it and neither raised anything**. One methodology's
clearance is one review, not four.

Where only one cleared it, either verify it yourself or leave it out. This is
the part of the report a reader is least able to check, and the only part where
an unearned claim makes the document *wrong* rather than merely incomplete.

### 7. Rank and write

Root causes get one finding; consequences point at it. Rank by severity per the
omega ladder, number per-file per omega's report structure.

## Completeness check

Print before writing the report:

```
METHODOLOGY      FINDINGS  LEADS  CLEARED  AGENTS(ok/failed)
pashov                  N      N        N        12/0
omega                   N      N        N         5/0
quillshield             N      N        N         8/1
plamen                  N      N        N        11/0

Raised by 4 methodologies:   N
Raised by 3:                 N
Raised by 2:                 N
Raised by 1:                 N   -> all verified?  yes/no
     promoted:               N
     demoted to lead:        N
     rejected:               N   -> each with a stated reason?
Contradictions:              N   -> all resolved in the code?  yes/no
Cross-methodology chains:    N
Leads promoted / retired:    N / N

FINAL FINDINGS:              N
```

Every raw item from every methodology lands in exactly one bucket. An item in
none has been silently dropped — go back and find it.

**Sanity band.** If single-methodology findings are under ~25% of the total,
suspect the methodologies collapsed onto each other — check whether they really
ran different agents, or whether one returned little. If over ~70%, suspect one
methodology is generating noise, or that mechanism-keying is splitting the same
defect into four. Say which in the engagement record.

## What not to do

- **Do not review the code yourself before the methodologies return.** An
  orchestrator with its own view anchors every adjudication after it.
- **Do not let methodologies see each other's output**, during or after. There
  is no legitimate reason to, and it retroactively destroys the independence
  that makes this tier work.
- **Do not weight by methodology.** None is more authoritative. Systematically
  trusting one is a signal about your prompt or model assignment, not the code.
- **Do not report methodology counts to the client.** They are internal
  calibration for ordering and effort allocation. The client needs mechanism,
  consequence and severity.
- **Do not average severities.** Two methodologies calling something medium and
  high does not make it medium-high. Read the impact argument and decide.
