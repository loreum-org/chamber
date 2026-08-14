# L1 Self-Check Checklists

## Finding Self-Check

- Is the primary location inside the configured subsystem scope?
- Is the triggering input controlled by an attacker, peer, RPC caller, operator,
  or restart sequence?
- Is the vulnerable path reachable before a guard rejects the input?
- Is the impact concrete: consensus split, invalid acceptance, crash/DoS, resource
  exhaustion, data loss, privilege exposure, or observability failure?
- Is the recommendation specific enough to implement?
- If this is a duplicate, does the report preserve one clear root-cause finding?

## Verification Self-Check

- Can the finding be refuted by a guard, precondition, scope boundary, or wrong
  location?
- Does the evidence tag match the actual evidence produced?
- For Critical/High, is there mechanical evidence beyond code trace?
- Does the verify file include Verdict, Severity, Impact, Likelihood, Location,
  Description, Recommendation, and Evidence Tag?

## Report Self-Check

- No internal IDs in client-facing body sections.
- Every active report ID appears exactly once.
- Excluded findings stay in Appendix/Excluded tables only.
- Scope header lists only audited in-scope components.
- `[REPORT-BLOCKED: ...]` is visible when evidence is insufficient.
