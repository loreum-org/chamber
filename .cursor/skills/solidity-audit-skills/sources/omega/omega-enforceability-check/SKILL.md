---
name: omega-enforceability-check
description: Find security checks that exist but constrain nothing. For every guard, limit, penalty, cooldown, threshold or flag, identify who it is meant to bind and prove it actually binds them — catching limits avoidable with a second address, cooldowns controlled by the party they restrict, validation whose result is discarded, reversed conditions, setters that write the wrong key, flags with no code path behind them, and calldata-sniffing allowlists that miss equivalent calls. Use when reviewing access control, rate limits, penalties, slippage protection, permission registries, pause logic, or any require/modifier that looks correct.
---

# Enforceability Check

Static analysers and consistency detectors look for guards that are **absent**.
This lens looks for guards that are **present, correct-looking, and completely
inert**.

> For every check in the contract, answer two questions in writing:
> **who is this meant to constrain**, and **what is the cheapest way for that
> party to do the thing anyway?**

If you cannot answer the second with "there isn't one," you have a finding —
regardless of whether the `require` is syntactically perfect. The useful word
for the finding is **unenforceable**, not "missing check": the check is right
there, and a report that calls it missing will be dismissed.

---

## The seven failure modes

### 1. The constrained party controls the constraint

A limit is only a limit if the limited party cannot move it.

```solidity
uint256 public cooldown;                              // limits the admin
function setCooldown(uint256 c) external onlyAdmin;   // …set by the admin
```

**Detection:** for every parameter that bounds behaviour, resolve its setter and
that setter's access control. Then ask whether the bounded party can reach it —
directly, through a role they can grant themselves, through an upgrade, or
through governance they control. If yes, the bound is decorative.

**Reviewing partial fixes:** a common response is to split the role — an
"updater" that is rate-limited, plus an "owner" that is not. That is not a fix.
If the unbounded path still exists and the same principal can reach both, the
original finding stands. Say so explicitly rather than accepting the split.

### 2. A second address defeats it

Per-account state is not per-person state. Addresses are free.

```solidity
require(block.number > lastMint[msg.sender] + DELAY);  // move tokens, use a fresh address
```

Anything keyed on an account, a balance, or a token holding is cheap to
duplicate: penalties, cooldowns, per-user caps, one-shot bonuses, first-N
rewards. The same applies off-chain to per-record limits where the caller can
create records.

**Detection:** ask what scarce resource the check is keyed to. If the answer is
"an address" or "a balance," it is not scarce. Genuine Sybil resistance needs
something costly — locked capital with a real opportunity cost, an identity
attestation, or a global rather than per-account counter.

**Recommendation posture:** when a mechanism cannot be made Sybil-resistant,
recommend **removing** it rather than patching. A penalty that only catches
unsophisticated users is worse than no penalty.

### 3. The check runs but its result is thrown away

Mechanically trivial, frequently high severity.

```python
_validate_slippage(slippage)          # returns the clamped value — discarded
tx = build(amount_out_min=slippage)   # uses the unclamped original
```

Four variants, all worth grepping for:

| Variant | Tell |
|---|---|
| **Return value discarded** | A validator/clamp/normalizer called as a statement, not an assignment |
| **Polarity inverted** | `if (isEnough(x))` where `isEnough` returns true when it is *not* enough |
| **Wrong key written** | A setter that marks, caches or invalidates under a neighbouring field's key |
| **Wrong key read** | A two-dimensional mapping written `m[a][b]` and read `m[b][a]` |

**Detection:** for every function whose name is a predicate or a transform,
trace its return value to a use. For every predicate, read its *name* against
its *implementation* — a naming inversion becomes a logic bug at every call
site, and is invisible when reading the call site alone. For every symmetric-
looking mapping, check writes and reads agree on index order.

### 4. The flag is set but nothing reads it

```solidity
new Vesting(beneficiary, /* revocable */ true);   // nothing ever calls revoke()
```

Configuration that no code path consumes: a `revocable` flag whose revoker is
unreachable, a `timeDelay` never compared against, a constant referenced by a
name that does not exist, a function parameter silently ignored by the body.

**Detection:** enumerate every constructor argument, config struct field and
state flag, then grep for reads. Zero reads — or reads only inside an
unreachable branch — is a finding. Also check ownership: a flag whose effect
requires a call from an owner that is a *factory contract with no such function*
is inert even though the flag is read.

**The fail-open default.** A related and more dangerous variant: a guard that
permits everyone when it has not been configured.

```solidity
modifier onlyRole(bytes4 fn) {
    require(hasRole(functionRoles[fn], msg.sender));   // unset mapping → role 0x00
    _;                                                  // …which nobody has, or everybody does
}
```

Where the role for a function was never assigned, the lookup returns the zero
value, and depending on the role check that means either "nobody can call this"
or — far more often — "anyone can". A protected-looking function is open, and it
is open precisely on the functions someone forgot to configure, which are the
ones least likely to be tested.

**Detection:** for every custom access-control mechanism, evaluate the guard
with the configuration *empty*. If the unconfigured default is permissive, that
is the finding regardless of what the deployment script happens to set. Make the
guard revert on an unset entry, or use a well-tested standard implementation
rather than a bespoke registry.

### 5. The allowlist enumerates the wrong thing

Trying to bound an **effect** by pattern-matching a **syntax**.

```solidity
bytes4 sel = bytes4(callData);
if (sel == IERC20.transfer.selector || sel == IERC20.approve.selector) {
    amount = abi.decode(callData[4:], (uint256));
    require(amount <= limit);
}
```

This is unfixable in principle, and saying so is the finding. `transferFrom`,
`increaseAllowance`, `permit`, a `safeTransfer` wrapper, a multicall, a token
with bespoke transfer functions, or any indirection through a third contract all
move value without matching. A token contract may define arbitrarily many
functions that transfer.

**The general fix, worth internalising:** *measure the effect, not the syntax.*
Snapshot balances and allowances before the call, compare after, enforce the
limit on the delta.

**Detection:** any guard that inspects selectors, function names, calldata
layout or event signatures. Enumerate ways to achieve the same effect that it
does not match. There will be some.

### 6. Coverage is incomplete — the guard protects some paths, not all

The guard is real and effective; it just is not everywhere it needs to be.

Two recurring shapes:

*The unguarded sibling.* A property is enforced on some functions and not on
others that depend on it equally. The systematic version: when a "safety mode"
or pause exists to distrust a price feed, **every** function whose correctness
depends on that feed must be disabled — withdraw, transfer, liquidate, and the
composite entry points — not just the two obvious ones. Enumerate by dependency,
not by intuition. (Conversely: functions that do *not* depend on it should not be
disabled, and pointing that out strengthens the finding.)

*The hook that sees the wrong party.* Where a check lives in a transfer hook, mint
and burn pass a sentinel:

```solidity
_beforeTokenTransfer(address(0), receiver, amount);   // mint: `from` is 0
```

A sanctions, blacklist or allowlist check written against `from`/`to` therefore
never sees the *caller* on a mint path. A restricted party calls
`deposit(assets, cleanAddress)` and passes through. The same gap appears in any
delegated or meta-transaction path, where the submitter is distinct from both
`from` and `to`.

**Detection:** for each guard, list every function that depends on the property
it protects, then diff against the functions that actually carry it. For hook-
based guards, enumerate every path reaching the hook and identify which party
each one leaves unchecked. This is the same consistency argument **[Q]**
`semantic-guard-analysis` automates — run it first, then apply this to what it
clears.

### 7. Two identical doors, one lock

```solidity
function executeA(bytes sig) external { _verify(sig); _doA(); }
function executeB(bytes sig) external { _verify(sig); _doB(); }
```

Identical authorization, different effect, both permissionless. The
authorization does not determine the outcome, so whoever calls first chooses it.

The related shape is a **shared identifier namespace with no type tag**:

```solidity
function cancelSubscription(uint256 id) external {
    Request storage r = requests[id];      // never checks r.kind == SUBSCRIPTION
    refund(r.asset, r.amount);
}
```

If subscription and redemption requests draw IDs from one counter, an attacker
constructs a cheap request of one kind and passes its ID to the other kind's
handler, which refunds against fields it never validated.

**Detection:** find near-duplicate entry points and diff their guards — any
asymmetry is either the bug or the evidence for it. Where the codebase's own
third variant *does* carry an extra check, that inconsistency is your strongest
argument. For shared ID spaces, confirm every consumer validates the discriminant.

---

## Writing it up

Separate the two claims, in this order:

> Users who redeem within the delay window incur a 90% penalty. **The penalty is
> however not enforceable, since a user can transfer the tokens to a different
> account they control and redeem from there.**

Intent first, then the concrete bypass sequence. Never "missing check."

**Recommend removal when the guard cannot be made to work.** A security control
that controls nothing is worse than none, because it buys false confidence from
the team and from integrators reading the code.

---

## Checklist

For every `require`, modifier, limit, penalty, cooldown, threshold and flag:

- [ ] Who is it meant to constrain? Written down.
- [ ] Can that party reach its setter — directly, via a grantable role, via
      upgrade, or via governance they control?
- [ ] Is it defeated by a second address, or by splitting into N transactions?
- [ ] Is the return value of every validator actually assigned and used?
- [ ] Does each predicate's name match its polarity?
- [ ] Do mapping writes and reads agree on index order?
- [ ] Does every configuration flag have a reachable code path that reads it —
      and a reachable caller for the effect it enables?
- [ ] If it matches on selectors or calldata, what equivalent effects slip past?
      (There will be some — measure the effect instead.)
- [ ] Does it cover *every* function depending on the property it protects?
- [ ] For hook-based guards: which party goes unchecked on mint, burn, and
      delegated paths?
- [ ] Do near-duplicate entry points carry identical guards?
- [ ] Is a shared ID namespace type-checked at every consumer?

**Pairs with:** **[Q]** `semantic-guard-analysis` — it finds guards that are
missing by consistency analysis; this one finds guards that are present and
inert.
