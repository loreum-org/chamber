# Finding Format

The output contract every Phase 3 pass writes to. Copy this file into the bundle
so each agent has it.

Passes that emit different shapes cannot be merged mechanically, and the
reconciliation degrades into rewriting them all. One shape, so the merge is about
the code rather than about parsing.

---

## FINDING

Emit when you can state the mechanism, state the consequence, and show a
concrete path or a passing PoC.

```
FINDING
file:         src/contracts/ExitQueue.sol
function:     pullRequest
mechanism:    <the code-level defect, one sentence>
consequence:  <what happens as a result, and to whom>
trigger:      <who can cause it: anyone / token holder / keeper / admin>
severity:     high | medium | low | info
rationale:    <one clause: likelihood × impact, and which dominates>
poc:          <path to a passing test, or "none — reasoning only">
evidence:     <quoted lines, a trace, or worked numbers>
fix:          <the smallest change that removes the defect>
related:      <IDs of other items this causes or is caused by, if any>
```

Notes on the fields that get filled in badly:

- **mechanism vs consequence.** "The counter is not decremented on the timeout
  edge" is a mechanism. "Governance eventually halts" is a consequence. A finding
  with only the first is unrated; with only the second, unactionable.
- **trigger** drives severity more than anything else. Be precise: "anyone" and
  "the admin acting against documented intent" are different findings.
- **rationale** must name likelihood *and* impact, and say which dominates when
  they pull opposite ways. "Medium — loss is possible but the precondition is
  improbable" is a rationale. "Medium" is not.
- **fix** is the smallest change, not a redesign. If the smallest change is a
  redesign, say so — that is itself informative.

---

## LEAD

Emit when something is wrong or unclear and you could not close it. Leads are
first-class output, not a consolation prize.

```
LEAD
file:         src/contracts/StrategyManager.sol
function:     _mintPerformanceFeeEVE
suspicion:    <what looks wrong>
blocked_by:   <what stopped you: needs a fork test / unclear intent /
               ran out of budget / depends on off-chain behaviour>
next_step:    <the specific thing that would settle it>
```

Do not pad a lead into a finding. An honest lead is more useful to the merge
than a finding whose evidence does not hold, and the reconciliation step has
budget to close leads that you did not.

---

## CLEARED

Emit for areas you examined specifically and believe are sound.

```
CLEARED
area:         AMM ETH accounting
checked:      <what you actually verified, one or two sentences>
```

These carry into the report's "checked and found sound" section, which is a real
part of the deliverable — it tells the client what the review covered rather than
what it happened to trip over.

Only claim an area you genuinely worked. The merge requires a majority of
passes to have cleared an area before it is reported as sound, so an unearned
entry here is one of the few things that can make the final report *wrong*
rather than merely incomplete.

---

## Rules for all three

1. **One item per defect.** Do not bundle two mechanisms into one FINDING because
   they share a function. The merge keys on mechanism, and bundled items get
   mis-merged.
2. **Do not rank, dedup, or write a report.** That is the orchestrator's job and
   it needs your raw output to do it.
3. **Do not reference the other passes.** You have not seen them and must not
   speculate about them.
4. **Quote, don't paraphrase, in `evidence`.** The orchestrator adjudicates
   contested items from your evidence field; a paraphrase cannot be checked.
5. **`severity` is your assessment, not a negotiation.** The orchestrator may
   revise it during reconciliation. Give your honest read.
