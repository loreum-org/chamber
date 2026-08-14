---
name: omega-accounting-consistency
description: Find broken bookkeeping by checking that every counter, aggregate and index is updated on every path that changes what it measures. Catches double-counting from add-vs-assign confusion, counters decremented on some state transitions but not others, per-class or per-group totals not updated on the reversal path, irrecoverable drift that underflows later, aggregates derived from a stale or partial view, and double-spend where two parties both hold a claim on the same balance. Use when auditing staking, vesting, reward accrual, share accounting, proposal state machines, fee calculation, or any system with a running total.
---

# Accounting Consistency

Where `omega-asset-exit-paths` asks whether value can leave, this asks whether
the **numbers describing** the value are right.

> For every state variable that summarises something — a count, a total, an
> index, an accrual — enumerate **every** code path that changes the underlying
> thing, and check that each one updates the summary correctly.

The bug is almost never on the path the tests cover. It is on the reversal, the
timeout, the partial fill, the failure branch, or the path a refactor rerouted.

---

## Failure modes

### 1. Assign where you meant to accumulate

```solidity
pending[user] = amount;    // should be +=
```

Correct on the first call, silently destructive on the second. It orphans a
previously credited but unredeemed balance.

**Detection:** every write to a balance-like mapping. Ask specifically: *what
happens on the second call, before the first is consumed?* If the answer is
"the first is lost," it needs `+=`. The inverse error exists too — `+=` where a
recomputed absolute value was intended, which double-counts.

### 2. Double counting — the callee already aggregated

```solidity
(uint256 harvest, uint256 reserve) = _calculateCommit(user);
commit.harvest += harvest;      // but _calculateCommit returned old + delta
commit.reserve += reserve;
```

The helper returns a *new total*; the caller treats it as a *delta*. Every
commit inflates the running value.

Trace the consequence past the wrong number. Inflated bookkeeping usually
terminates in an unchecked subtraction elsewhere, and the revert — not the
arithmetic — is what makes it high severity: a user whose accounting has drifted
becomes unable to call *any* function that routes through the shared commit
path, which is typically deposit, withdraw, borrow and repay. Say that.

**Detection:** for each `x += f(...)`, read `f`'s contract. Delta or total?
Ambiguous names (`calculate`, `update`, `get…Commit`) are where this hides.

**A generalisable review note:** helpers reached through only one caller are
under-tested by construction. When you find this class, recommend direct unit
tests for the helper, not just for the caller — the bug is invisible from the
caller's tests because both were written against the same misunderstanding.

### 3. The aggregation key is not unique

```python
results[(market.name, chain_id)] = compute(market, chain_id)
```

If names are not unique in the source domain, entries silently overwrite each
other and downstream sums count some entries twice and others not at all. The
same shape appears on-chain with symbols, string identifiers, or any key that
omits a dimension the data actually varies along (commonly the chain ID, or the
contract address).

**Detection:** for every map keyed by an identifier drawn from an external
system, ask what *guarantees* uniqueness. Usually nothing does. Key on
`(address, chainId)` or another tuple that is unique by construction.

### 4. The counter is decremented on some exits, not all

State machines leak here, and the drift is one-way and permanent.

```
        ┌──────────► BarCrossed ──► counter--   ✅
Boosted ┤
        └──────────► TimedOut   ──► (nothing)   ❌
```

**Detection:** *draw the state machine*. For every transition edge into and out
of the counted state, check the counter is adjusted. The bug is always on the
edge nobody draws — timeout, cancel, force-close, revert-and-retry, admin
override.

Then ask two follow-ups:

- **Is the drift recoverable?** If no other path decrements, the error is
  permanent and compounds. That fact belongs in the severity clause.
- **Where does it terminate?** A monotonically drifting counter compared against
  a maximum eventually locks out the operation it gates; a counter that drifts
  the other way eventually underflows. Name the terminal failure.

Related shape: decrementing on a path where the state transition *did not
actually occur* — the guard rejected the transition, but the counter was
already adjusted.

### 5. The reversal path forgets the aggregate

```solidity
function contribute(uint256 amt) { classCollected[c] += amt; ... }
function withdrawContribution(uint256 amt) { /* refunds, never decrements */ }
```

An attacker cycles contribute → withdraw to permanently consume a per-group
allocation without holding any position. No funds are stolen — which is exactly
why it gets under-rated. State the consequence in terms of what the aggregate
*gates*: capacity other users can no longer access, and any off-chain obligation
priced against it.

**Detection:** for every function that increments an aggregate, find its inverse
— cancel, refund, withdraw, unstake, revoke, expire — and confirm the aggregate
is decremented there. If no inverse exists, that is a different finding (see
`omega-asset-exit-paths`).

### 6. Two parties hold a claim on the same balance

```solidity
reward = staker.amount;              // default initialisation
if (won) { reward = computeWinnings(...); }
// losing branch falls through, returning the full stake
```

Both winners and losers now have a claim on the losers' stake. Whoever redeems
last is insolvent.

The other common source is a payout funded from a pool that nothing ever
credits — a bounty, fee or incentive paid out of the contract's balance where no
code path deposits it. The payout is real; the funding is imaginary; the money
comes from other users' principal.

**Detection:** sum every outstanding claim against the balance backing it. If
`Σ claims > balance` is reachable, someone eats the shortfall — identify who,
because "the last withdrawer" and "the protocol" are very different findings.
For every payout, name the deposit path that funds it.

### 7. The formula is right for one step, wrong for the sequence

Incremental recalculation that is individually plausible and cumulatively wrong.

**Detection:** run a concrete multi-step numeric scenario. Do not argue
abstractly — pick small round numbers, walk three or four steps, and show the
shortfall arithmetically. A worked example the reader can check with a
calculator is far more persuasive than a proof sketch, and it survives
disagreement about the model.

Two things to check explicitly:

- **Directional bias.** Is the error symmetric noise, or does it always favour
  the same party? A systematic bias compounds and is a materially worse finding
  than an equivalent-magnitude rounding error. Say "systematically
  underestimates," not "may be inaccurate."
- **Amortisation assumptions.** A one-time cost spread across a period assumes
  the position is held for that period. If positions can exit early, the cost is
  systematically understated. Likewise, a rate annualised against a horizon that
  does not apply.

### 8. The aggregate is computed from a source that does not represent it

A protocol-wide total derived by summing records that were never authoritative:
user-declared amounts, entries that are not decremented on withdrawal, or a view
that omits a component (accrued yield, positions on other chains, assets held by
a peer contract).

**Detection:** for each aggregate, **name its source of truth**. If the source
is a mutable record written by a party with an interest in the number, it is not
a source of truth. Prefer deriving from on-chain balances, caching if
performance requires it. See `omega-external-data-trust`.

---

## Writing it up

Show the drift and its endpoint:

> The counter is decreased when the proposal's state is `BarCrossed`. It is not
> decreased when a boosted proposal times out. **As there is no other path that
> diminishes the counter, this error is irrecoverable.**

Then let the severity clause carry the *systemic* consequence, not the
arithmetic. Nobody funds a fix for "a counter is off by one." They fund a fix
for "the counter gates the boost threshold, so drift makes governance
progressively harder and eventually halts it."

---

## Checklist

- [ ] Every balance-like write reviewed for `=` vs `+=` — ask what the *second*
      call does
- [ ] Every `x += f()` checked against whether `f` returns a delta or a total
- [ ] Every aggregation key proven unique in its actual domain
- [ ] State machine drawn; counter adjusted on *every* in- and out-edge,
      including timeout, cancel, override and failure edges
- [ ] No counter adjusted on a path where the transition was rejected
- [ ] Every incrementing function has its inverse, and the inverse decrements
- [ ] `Σ outstanding claims ≤ backing balance` shown to hold in all states
- [ ] Every payout has a named funding path that credits it
- [ ] Multi-step numeric scenario run for every incremental recalculation
- [ ] Directional bias checked separately from magnitude of error
- [ ] Amortisation horizons checked against actual holding periods
- [ ] Each aggregate's source of truth named and shown to be authoritative
- [ ] Drift identified as recoverable or permanent, and its terminal failure named

**Pairs with:** **[Q]** `state-invariant-detection` for automated inference of
`totalSupply = Σ balances`-style invariants · **[P]** `math-precision-agent` for
scale-mixing and rounding-direction analysis, which this skill deliberately does
not cover.
