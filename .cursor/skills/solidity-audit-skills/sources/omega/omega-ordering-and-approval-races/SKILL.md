---
name: omega-ordering-and-approval-races
description: Find transaction-ordering vulnerabilities by cataloguing six recurring shapes — permissionless functions that consume someone else's approval, front-running an operator's approval to change the terms, racing between two entry points that accept the same authorization, imposing a penalty or state on a victim before their transaction lands, reverting a victim's transaction by consuming a bound first, and claiming a pending payout before an asset transfer. Use when auditing any two-step approve-then-act flow, auction or buyout, operator-approved request queue, bridged message execution, or capped mint or sale.
---

# Ordering & Approval Races

Ordering findings cluster into a small number of recognisable shapes. Learning
the shapes is faster than reasoning from first principles at every call site.

> The governing question: **between the moment a user commits value or
> authorization and the moment it is consumed, what can a third party do?**

Any gap between commitment and consumption is an attack window. Enumerate the
gaps first, then walk the six shapes against each.

---

## Shape 1 — Approval granted, then anyone may act on it

The user approves a contract intending a specific subsequent call. That call is
permissionless and its parameters are attacker-controlled.

```solidity
token.approve(vault, tokenId);      // tx 1, by the owner
// ---- window ----
function wrap(uint256 id, address admin, address operator) external {   // anyone
    token.transferFrom(ownerOf(id), address(this), id);
    _setRoles(admin, operator);      // attacker names themselves
}
```

The approval is a bearer instrument. Whoever calls first supplies the terms.

**The callback variant** is the same shape with a less obvious entry point.
Flash-loan callbacks, ERC-721/1155 receiver hooks, and cross-chain message
receivers are *public functions*, and a permissionless initiator plus a callback
that trusts its own contract as caller reconstructs the whole privileged flow:

```solidity
function takeLoan(bytes calldata params) external { lender.flashLoan(...); }   // anyone
function executeOperation(...) external {
    require(msg.sender == address(lender));    // ← true for the attacker's call too
    _migrateFundsTo(abi.decode(params, (address)));
}
```

The callback authenticates the *lender*, not the *initiator*, so the
authorization check passes while the attacker chose the destination.

**Detection:** for every function reachable while a third party holds an
outstanding approval, ask who may call it and whether they choose the
parameters. Enumerate callbacks as first-class entry points. Where a callback
must be reachable, bind it to a flag set by the legitimate initiator in the same
transaction, and derive the destination from the initiator rather than from
calldata.

## Shape 2 — Front-run the operator's approval

A privileged actor approves a request the submitter still controls.

```
user submits request  →  operator broadcasts approve(id)
                              ↑
                    user front-runs: update(id, worseTerms)
                              ↓
                      approve(id) mines against the new terms
```

The operator's transaction commits to an *identifier*, not to *content*.

**Detection:** any queue where an operator authorizes an item the submitter can
still mutate. The fix is to make the approval commit to content — hash the
request and have the operator approve the hash, or freeze the request on
submission.

**On recommending a delay:** requiring the mutation window to elapse before
approval does close the race, but it forces every request to sit for the full
window, during which prices move and the order may no longer be favourable to
anyone. Say so, and prefer the structural fix — see Shape 6's *bound, not exact
value* principle, which makes operator-set terms safe and dissolves the race
entirely.

## Shape 3 — Two doors, one authorization

```solidity
function executeA(bytes sig) external { _verify(sig); deliverTokenA(); }
function executeB(bytes sig) external { _verify(sig); deliverTokenB(); }
```

Identical verification, different effect, both permissionless. The
authorization does not determine the outcome, so the first caller chooses it —
and a griefer picks the outcome the recipient did not want.

**Detection:** find entry points with identical authorization and different
effects. Where a *third* sibling function does carry an extra restriction, that
inconsistency is your strongest evidence.

**Fix:** bind the choice into the authorized payload. If the signed message or
bridged message named the token, there is only one valid door.

## Shape 4 — Impose state on a victim before their transaction lands

The attacker does not steal directly; they move the victim into a state where
the victim's own pending transaction harms them.

```solidity
lastAction[to] = block.timestamp;    // keyed on the RECIPIENT
...
if (block.timestamp < lastAction[to] + DELAY) { penalise(); }
```

Anyone can send the victim a dust transaction naming them as `to`, setting the
victim's timer, so the victim's in-flight transaction incurs the penalty.

**The general rule:** state keyed on an address a *third party* can name is
attacker-writable. `msg.sender` is attacker-controlled only for the attacker's
own key; `to`, `receiver`, `beneficiary` and `onBehalfOf` are writable for
anyone.

**Detection:** grep for mappings keyed by a function *parameter* that is an
address, then ask who can call the writing function.

## Shape 5 — Consume the bound so the victim's transaction reverts

Griefing by exhausting a cap or falsifying a precondition first.

```solidity
require(minted + qty <= MAX_SUPPLY);   // buy 1 first; the bulk purchase reverts
```

```solidity
require(token.balanceOf(address(this)) == expected);   // send 1 wei; permanently false
```

Three sub-shapes, all with the same root: **a comparison against a quantity an
outsider can move.**

| Sub-shape | Fix |
|---|---|
| Cap consumed by a smaller purchase | Let users request "up to N", filling what is available |
| Strict equality on a balance | Use `>=`; add a sweep for unaccounted balance |
| Approval sized to a delta, spend sized to a balance | Approve the balance, or spend the delta |

**Detection:** every `==` on a quantity, and every cap. Ask who can change the
compared value from outside the intended flow. Prefer `>=` over `==`, and "up
to" over "exactly," in any user-facing amount.

## Shape 6 — Claim the pending payout before the asset moves

An asset that carries an attached, unsettled entitlement, transferred without
settling it. The seller front-runs the sale and drains the accrued claim; the
buyer paid for an asset that has just been emptied.

**Detection:** does any transferable asset carry an unsettled entitlement —
accrued rent, unclaimed rewards, pending fees, a redeemable position?

**Fix:** settle in the transfer hook, or key the entitlement to the account
rather than to the asset. Where a transfer *does* settle, check it settles for
the right parties: resetting an accrual checkpoint for both sender and receiver
can strip the sender of earnings they already accrued, which is the same bug
with the sign flipped.

---

## Adjacent: economic ordering

Some findings involve no mechanical defect — the reordering is legal and the
*economics* are broken. Where a mechanism pays a premium pro rata to current
holders, anyone can mint into the position immediately before the payout and
dilute existing holders out of it; where a payout is redeemable above spot,
arbitrageurs rather than the intended beneficiaries capture the spread.

**Detection:** for any mechanism that pays a premium, a bonus, or a
above-market redemption, ask whether the qualifying position can be acquired
*after* the payout becomes knowable. If yes, the premium accrues to whoever is
fastest, not to whoever was exposed.

These often have no clean fix — pausing issuance around the event is partial and
carries real UX cost. When that is the case, **say the fix is hard, give the
least-bad option, and let the client accept the risk explicitly.** Do not
present a partial mitigation as a resolution.

---

## Recommendation patterns, ranked

1. **Bind the authorization to the effect.** Put the token, price, recipient and
   deadline inside the signed message or the approved request hash.
2. **Restrict the caller.** If only one party ever legitimately calls it, say so
   — and derive privileged parameters from the caller rather than calldata.
3. **Key state to `msg.sender`, never to a caller-named recipient.**
4. **Settle entitlements in the transfer path.**
5. **Express user intent as a bound, not an exact value** — "at least X out,"
   "up to N minted." This dissolves whole classes of race rather than closing
   individual windows, because any execution satisfying the bound is acceptable
   regardless of ordering.
6. **Remove the racy feature.** Frequently the right answer, and frequently
   accepted.

---

## Checklist

- [ ] Every commitment→consumption gap enumerated
- [ ] Functions reachable while a third party holds an approval: caller
      restricted, or parameters not attacker-chosen
- [ ] Callbacks (flash loan, token receiver, cross-chain) treated as public
      entry points; initiator authenticated, not just the callback source
- [ ] Operator-approved requests immutable between submission and approval, or
      the approval commits to content
- [ ] No two entry points share an authorization but differ in effect
- [ ] No state keyed by an address a third party can name
- [ ] No strict equality on a quantity an outsider can change
- [ ] Caps expressed as "up to," not "exactly"
- [ ] Transferable assets carrying entitlements settle them on transfer, for the
      correct parties
- [ ] Premium, bonus and above-spot redemption mechanics checked for dilution
      and arbitrage entering in front
- [ ] Where no clean fix exists, the least-bad mitigation is stated as such

**Pairs with:** **[Q]** `signature-replay-analysis` for EIP-712 domain binding
and nonce management, the standard implementation of fix #1 · **[P]**
`hacking-agents/` for adversarial framing of the economic cases.
