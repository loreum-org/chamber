---
name: omega-upgrade-diff-review
description: Audit an upgrade, a follow-up engagement, or a PR diff rather than a fresh codebase. Covers scoping to a commit range, diffing storage layout across versions, initializer and migration hazards, checking that a v2 still honours promises v1 made to existing holders and in-flight messages, verifying that fixes did not introduce new bugs, and re-checking findings left open by earlier reports. Use when the client has been audited before, when scope is a PR or commit range, or when reviewing a fix commit.
---

# Upgrade & Diff Review

Auditing a *change* is a different job from auditing a codebase, with its own
failure modes. Most repeat engagements are this job.

> Two questions govern the review: **what did this diff change**, and **what did
> the change silently break for state and counterparties that already exist?**

The second is the one that gets missed. A diff can be individually correct on
every line and still invalidate assumptions held by deployed state, pending
messages, and external integrators who read the old code.

---

## 1. Scope the diff precisely

Name both endpoints, always:

- **Base commit** — what the previous review covered, or what is deployed
- **Head commit** — what you are reviewing
- **For a fork:** the upstream commit it forked from. The delta from upstream is
  the real attack surface, and the fork point is the baseline.

"We audited the latest version" is not a scope. Write full hashes, and state
explicitly that scope is the diff, so it is unambiguous what you did *not* look
at.

## 2. Diff the storage layout

The mechanical check that most needs doing and most gets skipped.

```solidity
// v1                                  // v2
uint256 private _defaultGasLimit;      // ← removed
mapping(uint64 => Peer) peers;         mapping(uint64 => Peer) peers;
                                       mapping(uint64 => ChainInfo) chainInfos;  // ← inserted
mapping(address => bool) allowed;      mapping(address => bool) allowed;
```

Behind a proxy, the *deployed* layout persists. Removing a variable shifts
everything after it up a slot; inserting one shifts everything after it down.
The upgraded implementation then reads and writes the wrong slots, and the
corruption is silent — mappings and dynamic arrays hash their slot number, so
their entire contents become unreachable rather than merely wrong.

**Detection:** generate the layout for both versions (`forge inspect <C>
storageLayout`, `hardhat-storage-layout`) and diff them mechanically. Any change
to the slot, offset or type of a pre-existing variable is a finding.

**On mitigations that are deployment plans:** the common response is "this will
be a fresh deployment, not an upgrade." That is a valid mitigation and it should
be *recorded as contingent* — file the finding, note the plan, and mark it
resolved-by-decision rather than resolved-in-code. Plans change; the record
should show that the safety depends on one.

Also check `__gap` exists and is sized so the *next* upgrade has room, and that
inherited contracts' gaps were decremented rather than the child's storage being
appended blindly.

## 3. Initializers

Upgradeable contracts concentrate risk in initialization. Recurring hazards:

| Hazard | Shape |
|---|---|
| **Re-callable initializer** | `initialize()` without `initializer`, or a `v2`/`v3` re-init guarded by nothing |
| **Front-runnable migration** | A one-shot migration entry point that is permissionless — whoever calls first wins, and if that is an attacker the legitimate migration can never run |
| **Live implementation** | Implementation contract not disabled, so it can be initialized directly and, for UUPS, self-destructed or re-pointed |
| **Inline initializers** | `uint256 x = 5;` at declaration writes the *implementation's* storage, never the proxy's |
| **Version regression** | `reinitializer(n)` where `n` does not strictly increase, silently permitting a replay |

**Detection:** every `initialize*` function — one-shot guarded, *and*
access-controlled (one-shot alone does not stop a front-runner). Constructor
calls `_disableInitializers()`. No state variable relies on an inline
initializer. Reinitializer versions increase monotonically across releases.

## 4. Does v2 still honour v1's promises?

The subtlest class, and the one unique to diff review. Existing holders,
in-flight messages and outstanding approvals were made promises by v1.

Enumerate what the old version guaranteed, then check each still holds:

- **Standard conformance.** If v1 satisfied ERC-20/721/4626, v2 must too —
  integrators built against the standard, not against your implementation. A
  wrapper that gains a new standard's *interface* must actually satisfy that
  standard's *semantics*, not merely compile.
- **Return-value and revert semantics.** A function that returned `false` on
  failure and now reverts (or vice versa) breaks every caller that branched on
  it — and turns their error-handling branch into dead code.
- **Event shapes.** Indexers and accounting systems are consumers too.
- **Message formats.** A message signed or emitted under v1 semantics may be
  executed under v2 semantics. If the encoding is unchanged but the *meaning* of
  a field changed, in-flight messages are now misinterpreted.
- **The meaning of stored values.** Same slot, same type, new interpretation is
  a silent migration bug.

**A useful severity lever:** the harm is often not to the direct caller but to
the *integration surface*. A function that no longer honours its documented
output will be called by a router or aggregator that assumed it did, and those
calls will fail or misprice. State that chain — it is usually what moves the
rating.

**Detection:** list in-flight state that crosses the upgrade boundary — pending
requests, unexecuted signed messages, unclaimed rewards, outstanding approvals,
queued withdrawals — and validate each against the new code.

## 5. Re-check the previous reviews' open findings

Treat this as an in-scope deliverable, not a courtesy. Two checks, not one:

- **Still-open findings** — for every previously reported issue marked not
  resolved or acknowledged, confirm the current state.
- **Regressions** — for every previously *resolved* finding, confirm it is still
  fixed. Fixes get reverted by later refactors, merges and branch resurrections,
  and a regression of a known bug is more embarrassing than the original.

Only a review that carries prior reports forward catches the second.

## 6. Audit the fix commit as new code

Fixes introduce bugs. A patch written under time pressure, against a narrow
description of a symptom, touching code the author has re-entered after a gap,
is high-risk code by construction — and it arrives *after* the main review, when
attention is lowest.

The characteristic failure: a fix rewrites a function to close the reported
path, and the rewrite's default initialisation, reordered guard, or new early
return opens a different one.

**Detection:** diff the fix commit in full and re-run every lens over the
changed code. Clients routinely bundle unrelated work into fix commits, so
review all of it, not only the lines you asked about.

## 7. Watch for divergence from upstream

Forked well-known code is a recurring source of high-severity findings, because
reviewers extend the original's reputation to the copy.

- **Dropped branches.** A fork that omits one case from a state transition the
  original handled. The original is the specification; diffing against it finds
  the omission immediately.
- **Broken initialization in copied crypto.** Domain separators, type hashes and
  chain IDs are set in the original's constructor; a fork that restructures
  initialization commonly leaves them empty or chain-independent, breaking
  replay protection while every individual line still looks plausible.
- **Unpatched upstream advisories.** The pinned version may predate a known fix.

**A meta-finding worth making:** when a fork's modifications are extensive and
not clearly motivated, the modification *itself* is the root cause — several
downstream findings collapse into "do not fork this; use the library." That is
a stronger recommendation than patching each symptom.

**Scoping out is also a finding, when you show your work.** Where a file is a
near-verbatim copy of an audited upstream release, identify the upstream
version, enumerate the differences, state that they are immaterial, and cite the
prior audit. That is a defensible reason to spend no further time — and it is
only defensible written down.

---

## Checklist

Scope
- [ ] Base and head commit hashes recorded; for forks, the upstream fork point
- [ ] Prior reviews for this codebase enumerated
- [ ] Stated explicitly that scope is the diff

Mechanics
- [ ] Storage layouts generated for both versions and diffed mechanically
- [ ] `__gap` present, correctly sized, and inherited gaps decremented
- [ ] Every `initialize*` one-shot **and** access-controlled
- [ ] `_disableInitializers()` in the implementation constructor
- [ ] No state relies on inline initializers behind a proxy
- [ ] Reinitializer versions strictly increasing
- [ ] Migration entry points cannot be front-run into a permanent lock

Semantics
- [ ] Standards satisfied by v1 still satisfied
- [ ] Return-value, revert, and event semantics unchanged, or deliberately and
      documentedly changed
- [ ] Stored values retain their meaning
- [ ] In-flight state — pending requests, unexecuted messages, unclaimed
      rewards, outstanding approvals — still valid under v2
- [ ] Integration-surface consequences traced, not just direct-caller ones

Continuity
- [ ] Every open finding from every prior review re-checked
- [ ] Every previously-resolved finding checked for regression
- [ ] Fix commit audited in full, including unrelated changes
- [ ] Forked files diffed against exact upstream; upstream advisories checked
- [ ] Deliberate scope exclusions written down with their justification

**Pairs with:** **[Q]** `proxy-upgrade-safety` for the mechanics of storage
collision, selector clashing and delegatecall context across Transparent/UUPS/
Beacon/Diamond patterns — this skill covers the *review of a change* rather than
the proxy pattern itself.
