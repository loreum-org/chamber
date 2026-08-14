---
name: omega-time-indexed-state
description: Audit state that is indexed by time — epochs, checkpoints, historical balance snapshots, delegation records, vesting periods and reward accrual windows. Checks whether a checkpoint appends or overwrites, whether a historical query returns the value that actually held at that block, whether bounded history can lock a user out permanently, which side of a boundary an action lands on, what a discretized reward pays someone who straddles it, and whether two independently-settable windows must satisfy a relation nobody enforces. Use when auditing staking rewards, voting power, delegation, vesting, epoch-based accounting, or any getPastVotes / balanceOfAt / snapshot mechanism.
---

# Time-Indexed State

State that answers "what was true *then*" behaves differently from state that
answers "what is true now", and it fails differently. The defects are not in the
arithmetic — each individual number is right — they are in the indexing: which
record a write lands in, which record a read resolves to, and what happens at
the boundary between them.

> Two questions for every time-indexed value: **does a write at time T create a
> new record or modify an existing one**, and **does a read for time T return
> what was actually true at T?**

Both usually go unasked, because the happy path is correct and the tests are
written against the same mental model as the code.

---

## 1. The checkpoint overwrites instead of appends

The highest-severity shape in the family, because it directly enables
double-counting of voting power or rewards.

```solidity
function _writeCheckpoint(Checkpoint[] storage ckpts, uint256 value) internal {
    Checkpoint storage last = ckpts[ckpts.length - 1];
    last.value = value;              // ← overwrites, whatever the block
}
```

A correct implementation appends when the block has advanced and updates in
place only within the same block. One that always updates in place destroys the
history, and the exploit follows immediately:

```
1. hold tokens, vote on the live proposal
2. delegate to a second address you control
   → the delegation overwrites the latest checkpoint rather than appending
3. vote again from the second address against the same proposal
```

The snapshot the proposal reads no longer distinguishes "before delegation" from
"after", so the same tokens are counted twice.

**Test:** find every write to a checkpoint array. Confirm it compares the
current block (or timestamp) against the last record's, appends when they
differ, and updates in place only when they match. Then confirm the *read* path
picks the last record at or before the query point, not the last record overall.

## 2. The historical query does not return the historical value

A function named `balanceOfAt(user, block)` implies a clean answer. It often
does not give one.

The recurring defect is a query whose result blends the balance at the queried
block with adjustments recorded *after* it — typically because delegations,
rewards or transfers are checkpointed on a different schedule than balances, and
the lookup resolves to the first record on or after the query point rather than
the last one before it. The returned number was true at no point in time.

**Test:** for each historical getter, construct a case where the value changes
twice — once before the query block and once after — and assert the getter
returns the earlier value. The bug is invisible with a single change, which is
why unit tests miss it.

Also check what the getter does for a block *before the first checkpoint* and
*after the last*: zero, revert, and "the current value" are three different
answers and only one of them is right for your semantics.

## 3. Bounded history becomes a permanent lockout

Checkpoint arrays are unbounded, so implementations cap them — a maximum number
of interactions, delegations or records tracked per user. The cap is a gas
defence. It is also a weapon.

Once a user exceeds the cap, the historical lookup for older blocks can no
longer be satisfied, and typically **reverts**. The user is now permanently
unable to vote on, claim from, or exit anything that references an older
snapshot. Worse, the counter is usually driven by actions *other people* take:

```
attacker splits their holding across N addresses, just under any per-address threshold
→ each address performs the capped interaction against the victim
→ victim crosses the cap
→ victim is locked out of every proposal older than that point
```

A rate limit that anyone else can consume on your behalf is a denial of service.

**Test:** find every cap on historical records. Ask who can increment the
counter — if the answer includes anyone other than the record's owner, it is
griefable. Then ask what happens *at* the cap: reverting is the dangerous answer;
truncating or falling back to a bounded scan is usually recoverable.

## 4. Which side of the boundary does the action land on?

Epoch-indexed logic has to decide, for every action, whether it belongs to the
epoch that is ending or the one beginning. That decision is frequently
undocumented, and frequently not what the documentation claims.

The classic instance: a `payReward()`-style function invoked lazily on the first
interaction of a new epoch, which pays out the *previous* epoch — while the
documentation describes it as paying the current one. Everything works; the
mental model in the docs is off by one epoch; and every downstream statement
about who earned what is wrong.

**Test:** for each epoch-scoped action, write down the epoch it credits and the
epoch a reader would assume it credits. Check the transition explicitly: an
action in the first block of epoch N, and one in the last block of epoch N−1.

## 5. Discretization is an incentive

When a continuous quantity (time staked, time held) is rewarded on a discrete
schedule using an instantaneous measurement (the balance *at* the epoch
boundary), the reward stops tracking the thing it is meant to reward.

```
user A: stakes day 1 of epoch N, holds through          → full epoch reward
user B: stakes day 7 of epoch N, holds through          → full epoch reward
```

B contributed a seventh of the capital-time and receives the same. Two
consequences, and the second is the finding:

- It is **unfair**, which is a design opinion.
- It creates a **standing incentive** to stake as late as possible in an epoch
  and unstake as early as possible in the next — which is a mechanism defect,
  because the protocol is paying for capital it does not have for most of the
  period.

Worth stating in the report as a concrete comparison: someone staked 8 days
across a boundary can earn exactly what someone staked 20 days earns.

**Test:** for every reward computed from a point-in-time measurement, ask what
the optimal timing strategy is. If the answer is "arrive just before the
snapshot and leave just after", the measurement should be time-weighted or the
snapshot unpredictable.

## 6. Two windows with an unenforced relation

Epoch length, voting period, unstake wait period, vesting cliff, claim window,
timelock delay — these are usually independently settable and usually *must*
satisfy a relation. Almost never is the relation enforced.

The recurring instance is a voting period longer than the epoch or snapshot
retention window: votes remain open on proposals whose snapshot is no longer
resolvable, so participation silently fails, and per §3 it can be forced.

Others worth checking: an unstake wait shorter than a claim evaluation period
lets stakers exit before liability lands; a vesting cliff past the contract's
own end time makes tokens unreachable; a timelock longer than a proposal's
expiry makes execution impossible.

**Test:** list every configurable duration. For each pair, ask whether an
ordering between them is assumed anywhere in the logic. Every assumed ordering
needs a check in *both* setters — checking one is a common half-fix that the
other setter walks straight past.

## 7. The boundary-crosser pays for everyone

Lazy epoch transitions do the accumulated work on the first interaction after
the boundary. That user pays gas for a computation that benefits everyone, at an
amount they cannot predict.

It is not usually a security defect, but it is a real finding: it makes gas costs
for ordinary operations unpredictable and unfair, and at scale it can make the
first interaction of an epoch cost more than the block gas limit — at which
point the epoch cannot advance at all and the lazy transition becomes a liveness
failure.

**Test:** identify what work the boundary crossing performs and whether it is
O(1) or grows with users, epochs missed, or records. Bounded work is a fairness
note; unbounded work is an availability finding.

## 8. Formulas silently coupled to the current constants

```solidity
reward = totalStake * apr / REWARD_VESTING_PERIOD / HUNDRED_PERCENT;
```

This yields an *annual* rate only because `REWARD_VESTING_PERIOD` happens to be
52 and the epoch happens to be 7 days. Change either constant — a perfectly
ordinary governance action — and the variable named `apr` no longer means APR.
Nothing reverts, no test fails, and the error is a silent mispricing.

**Test:** for every formula mixing a rate with a period, check whether the
relationship between the constants is derived or coincidental. Derived is
`periodsPerYear = 365 days / EPOCH_LENGTH`; coincidental is a hardcoded 52. Any
constant whose *correctness* depends on another constant's value should be
computed from it.

## 9. Absorbing states in a rate that updates multiplicatively

A parameter updated as a proportion of its own previous value can reach a value
it can never leave. If a rate is adjusted by scaling the current rate, then zero
is absorbing: once it hits zero, every subsequent update is zero times something.
Recovery requires an out-of-band intervention that may not exist, and if the
parameter has a floor of zero, reaching it is reachable through ordinary
operation rather than attack.

The related critique: an update whose magnitude is proportional to the *current
value* rather than to the *error* has no principled gain. Being far from target
and being at a high absolute value are different things, and a controller that
confuses them oscillates.

**Test:** for any parameter on a feedback loop, enumerate its fixed points and
ask which are reachable and which are escapable. Then ask what the update is
proportional to.

---

## Writing it up

Anchor to a two-actor comparison or a two-transition trace. These findings are
hard to see in prose and immediate in a table:

| | stakes | unstakes | days staked | reward |
|---|---|---|---|---|
| A | epoch N, day 1 | epoch N+2, day 7 | 20 | 2 epochs |
| B | epoch N, day 7 | epoch N+2, day 1 | 8 | 2 epochs |

For checkpoint defects, give the sequence of blocks and the value the getter
returns at each — the discrepancy is only visible across at least two changes.

**Severity:** double-counted voting power or rewards is **high**. Permanent
lockout from voting or claiming is **high** if it is griefable, **medium** if it
requires the user's own actions. Boundary-timing incentives and unenforced window
relations are **medium** when they change who gets paid, **low** when they only
affect fairness. Gas allocation and constant coupling are **low**.

---

## Checklist

- [ ] Every checkpoint write appends across blocks and updates in place only
      within a block
- [ ] Every historical read resolves to the last record at or before the query,
      verified with *two* changes bracketing the query point
- [ ] Behaviour defined before the first and after the last checkpoint
- [ ] Every cap on historical records: who can increment it, and does hitting it
      revert?
- [ ] For each epoch-scoped action, the epoch it credits matches the epoch the
      documentation claims
- [ ] Boundary transitions traced explicitly at first and last block of an epoch
- [ ] Point-in-time reward measurements checked for the optimal timing strategy
- [ ] Every pair of configurable durations checked for an assumed ordering, and
      the check present in *both* setters
- [ ] Lazy boundary work is O(1), or the availability risk is stated
- [ ] Rate/period formulas derive their constants rather than hardcoding a
      coincidence
- [ ] Feedback-updated parameters: fixed points enumerated, escapability checked

**Pairs with:** `omega-accounting-consistency` for the non-time-indexed case —
counters and aggregates that must be right on every path · **[P]**
`economic-security-agent` for the incentive analysis behind §5 and §9 ·
`omega-enforceability-check` §1 where the window setters are reachable by the
party the window constrains.
