---
name: omega-share-and-index-accounting
description: Audit balances that are derived rather than stored — shares times a multiplier, principal times an interest index, rebasing supply. Checks round-trip asymmetry when a lazily-updated accrual moves mid-transaction, mutating functions that forget the index basis, multipliers that can reach an absorbing zero and wipe every balance at once, index updates gated on a flag that must exactly track a numeric condition, accrual parameters changed without settling first, and one-shot guards keyed on a value that is legitimately resettable. Use when auditing rebasing or multiplier tokens, interest-bearing receipt tokens, vault shares, or any balanceOf computed from a global scalar.
---

# Share & Index Accounting

When a balance is *stored*, a bug affects one account. When a balance is
*derived* — `shares × multiplier`, `principal × index`, `assets × rate` — a bug
in the scalar affects **every** account simultaneously, and no individual
balance write is wrong.

> Two questions: **is the scalar current at every point it is read**, and **does
> converting out and back in return what you started with?**

Neither is guaranteed by code that looks correct, because the conversion
functions are usually right and the defect lives in *when* they are called.

---

## 1. Round-trip asymmetry across a lazily-updated scalar

The highest-severity shape, and the hardest to see. Accrual is applied lazily by
a modifier or an internal hook, so the scalar can change *inside* the very
function that is converting with it:

```solidity
function delegatedTransferShares(address to, uint256 shares) external {
    uint256 amount = _sharesToAmount(shares);   // reads the STORED multiplier
    _transfer(msg.sender, to, amount);
    //   └─ _beforeTokenTransfer → updateMultiplier()   ← scalar moves here
    //   └─ converts amount back to shares with the NEW multiplier
}
```

Shares in, amount out, shares back — computed against two different scalars.
The value transferred is not the value requested, and the discrepancy is exactly
the accrual that landed mid-call.

**Test:** for every function that converts in both directions, or that converts
and then calls something that converts back, confirm the scalar is settled
**before** the first conversion. The rule: apply the accrual modifier at the
outermost entry point, not on the internal helper — and check that every entry
point actually carries it. A missing modifier on one function out of a dozen is
the whole bug.

## 2. A mutating function that forgets the index basis

Where the scalar is maintained against a tracked aggregate (`balanceAtIndex`,
`totalPooled`, `lastTotal`), every function that changes the underlying amount
must update it.

```
mint()        → updates balanceAtIndex   ✅
burn()        → updates balanceAtIndex   ✅
mintBuffer()  → updates balanceAtIndex   ✅
burnBuffer()  → …forgets                 ❌   skews every later calculation
```

The omission is invisible locally: `burnBuffer` does its own job correctly. The
damage is that every subsequent index computation is derived from a basis that
no longer matches reality, so *all* balances drift together.

**Test:** enumerate every function that changes the underlying quantity, and
diff that list against the functions that touch the index basis. This is
mechanical and it is where the high-severity findings are. Treat any asymmetry
in a set of near-twin functions (`mint`/`mintBuffer`, `burn`/`burnBuffer`) as a
finding until proven otherwise.

## 3. The scalar can reach an absorbing zero

If every balance is `shares × index`, then `index == 0` makes **every balance in
the system zero simultaneously**. Check whether the update formula can produce
it:

```solidity
newIndex = index - (index * (prevBalance - newBalance) / prevBalance);
//   newBalance == 0  ⇒  newIndex == 0  ⇒  every user balance == 0
```

Full liquidation, a fully-drained strategy, or any edge that legitimately drives
the tracked balance to zero reaches it through *ordinary operation*, not attack.
And because the index is multiplicative, there is no path back: zero times
anything is zero.

**Test:** for the scalar's update formula, solve for the inputs that produce
zero (or one, or any other fixed point) and ask whether they are reachable. Then
ask whether recovery exists. Floor the scalar, or special-case the degenerate
input — do not rely on it being unreachable.

## 4. The index update is gated on a flag that must track a comparison

A common structure guards the scalar's update with a boolean supplied by an
external system, where correctness silently requires the boolean to be true in
*exactly* the cases a numeric comparison holds:

```solidity
if (hasBeenLiquidated) { /* handle balance decreased */ }
if (prevBalance > 0 && prevBalance < newBalance) { /* handle balance grew */ }
```

This is only correct if `hasBeenLiquidated == (newBalance < prevBalance)`, always.
When the flag is false but the balance did decrease, the index is not written
down, and users withdraw more than they are owed. When it is true but the
balance did not decrease, the branches are not mutually exclusive and both — or
neither — run.

**Test:** whenever a numeric decision is gated on a boolean from elsewhere,
write the invariant that must hold between them, then look for a state where it
does not. Prefer deriving the condition from the numbers you already have over
trusting a flag that describes them.

## 5. Accrual parameters changed without settling first

Setters for period length, fee rate, accrual start time or rate curve must apply
the accrual **for the elapsed period** before writing the new value. Otherwise
the new parameter is applied retroactively to time it was never in force:

```solidity
function setPeriodLength(uint256 n) external onlyAdmin {
    periodLength = n;          // ← past periods silently re-priced
}
```

There is also a race: between such a setter and any call that triggers the
accrual, the outcome depends on ordering.

**Test:** every setter touching an accrual input carries the same update
modifier as the user-facing functions. If the modifier exists, check it is on
*all* of them — this is usually a partial fix.

## 6. One-shot guards keyed on a resettable derived value

A cheap alternative to `initializer` is to guard on a state value being zero:

```solidity
require(lastTimeFeeApplied == 0, "already initialized");
```

This holds only if the value can never legitimately return to zero. Where an
admin can set the multiplier, the activation time or the fee epoch back to zero
— often a valid operation — the initializer becomes callable again, by anyone,
and re-initialization typically resets the scalar.

**Test:** for every guard of the form "this field is still zero", find every
writer of that field and confirm none can write zero. This shape recurs; treat a
sentinel-value initialization guard as suspect on sight, and prefer a real
`initializer` / `reinitializer`.

## 7. The conversion is implemented more than once

`totalSupply()` and `balanceOf()` each computing `shares × multiplier / PRECISION`
inline, rather than both calling the same helper, is not a style issue in this
context. The two copies will eventually diverge — on rounding direction, on
precision constant, or when one is updated for a new fee mechanism and the other
is not — and a `totalSupply` that disagrees with the sum of `balanceOf` breaks
every integrator and every invariant test.

**Test:** exactly one implementation of shares→amount and one of amount→shares.
Every caller uses them. Check the two are actual inverses at the rounding
boundaries.

## 8. Signed or near-zero denominators in distribution

Where a share of a pot is computed as `userQuantity / totalQuantity`, and the
quantities can be negative or near zero (net position, active assets, equity
after debt), the distribution inverts or explodes:

```
farmEarnings = 1000, totalActive = -1, userActive = -1000
userShare = 1000 * (-1000) / (-1)  →  1,000,000
```

The user who most burdens the system receives the largest payout. Signs cancel
and the formula looks dimensionally fine.

**Test:** for every distribution ratio, ask whether numerator or denominator can
be zero or negative, and what the formula does there. A quantity named "net",
"active" or "excess" is a signed quantity even when it is typed unsigned —
because it is computed as a subtraction somewhere.

## 9. Checks and caps expressed in the wrong unit

A cap compared against a rebasing quantity is not a cap: the quantity grows on
accrual without any user action, so the check passes or fails based on time
rather than on the thing it meant to limit. The same applies to a check on
shares that was meant to bound assets, or vice versa.

**Test:** for every limit, name its unit — shares or assets — and confirm the
compared value is in the same unit and does not drift on its own.

## 10. Fee collection operating on the wrong account

Fee logic in share terms is easy to get backwards: burning shares from the
*caller* while crediting an amount computed from the *recipient's* balance, or
minting the fee to the treasury while debiting nobody. The function is
permissioned, so tests pass with owner == feeRecipient and the defect only
appears once those are different addresses.

**Test:** for fee settlement, write out whose shares decrease and whose increase,
and confirm the totals reconcile. Test with the fee recipient distinct from the
caller.

---

## Writing it up

Show the round trip. These findings land when the reader can see the same
quantity converted twice and arriving somewhere else:

```
shares_in  = 100
multiplier = 1.00  →  amount = 100
             ─── accrual applied mid-call ───
multiplier = 1.05  →  shares_out = 95.24     (≠ 100)
```

For scalar-wide defects, state the blast radius explicitly: "every balance in
the system", not "the balance". That is what separates this family from ordinary
accounting bugs and it is what sets the severity.

**Severity:** anything that moves the scalar wrongly is **high** — it is a
protocol-wide mispricing, and it is silent. A round-trip asymmetry that
misallocates on a single transfer is **high** if unprivileged, **medium** if it
needs an admin action. Duplicate conversion implementations and unit-mismatched
caps are **low** until they diverge.

---

## Checklist

- [ ] The accrual modifier is on **every** external entry point, not just most
- [ ] No function converts with a scalar that its own internal calls then update
- [ ] Every function changing the underlying quantity also updates the index basis
- [ ] Near-twin functions (`x`/`xBuffer`, `mint`/`mintTo`) checked for asymmetry
- [ ] The scalar's update formula solved for zero and other fixed points;
      reachability and recovery both checked
- [ ] Flags gating numeric branches: the required invariant written down and
      falsified
- [ ] Accrual-parameter setters settle before writing
- [ ] No one-shot guard keyed on a field that some writer can return to zero
- [ ] Exactly one shares→amount and one amount→shares implementation
- [ ] Distribution denominators checked for zero and for sign
- [ ] Every cap and limit checked for unit (shares vs assets) and for drift
- [ ] Fee settlement reconciles, tested with recipient ≠ caller

**Pairs with:** `omega-accounting-consistency` for stored counters and
aggregates · `omega-time-indexed-state` where the scalar is checkpointed per
block or epoch · **[Q]** `input-arithmetic-safety` for the rounding-direction
mechanics of the conversions themselves.
