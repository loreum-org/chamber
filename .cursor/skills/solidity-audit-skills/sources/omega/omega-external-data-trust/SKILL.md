---
name: omega-external-data-trust
description: Audit the boundary where a system accepts data it did not compute — oracles, third-party APIs, bridged messages, user-supplied request fields, and off-chain backends. Checks that returned values are validated against the constraints that were requested, that staleness is measured on the right timestamp, that independently-sourced fields are correlated, that errors are not swallowed into plausible-looking defaults, and that no security decision rests on a number the beneficiary supplied. Use when auditing oracle integrations, DEX/bridge quote consumption, keeper and relayer flows, agent backends, or any API-fed pricing or accounting logic.
---

# External Data Trust

The boundary where a value the system did not compute becomes a value it acts
on. Applies equally to Solidity oracle reads and to the Python/TypeScript
backends that increasingly sit behind on-chain agents.

> For every external input: **what is this trusted for**, **what happens if it
> is wrong or stale**, and **who benefits from it being wrong?**

---

## 1. The response is not validated against the request

The most transferable pattern here. You send a constraint with your request;
nothing checks the response honours it.

```python
quote = api.get_quote(src, dst, amount, dst_amount_min=min_out)
execute(quote.tx)          # quote.dst_amount is never compared to min_out
```

A parameter named `minOut`, `slippageTolerance`, `deadline` or `recipient` in a
*request* is a hint to the counterparty, not a guarantee. Only an assertion on
the response is a guarantee.

**Detection:** for every request carrying a bound, find the line that re-checks
it on the response. If it does not exist, the bound is advisory. Verify
empirically where you can — issue the call with a deliberately unsatisfiable
bound and observe whether the service honours or ignores it. An API's *present*
behaviour is not part of its contract either way: even if it currently
complies, nothing prevents it from changing.

### The compounding variant: protection derived from an unprotected number

```python
quote = get_quote(...)              # already embeds unknown slippage
min_out = quote.amount * 0.995      # "0.5% slippage protection"
```

The 0.5% is applied to a number that is itself unbounded, so the composite
bound is unbounded. This renders the protection ornamental while looking
rigorous — which is why it survives review.

**The rule:** a hardcoded tolerance is a **ceiling**, never a **basis**.

```python
min_out = max(quote.amount * (1 - MAX_SLIP), oracle_value * (1 - MAX_SLIP))
```

Derive the expected value independently, then cap the deviation. Deriving a
bound from the number you are trying to bound gives you no bound.

The same error appears with fixed percentages chosen by intuition. A hardcoded
2% cross-chain slippage is both arbitrary and usually far worse than the
quotable rate; fetch the expected rate and use the constant only as an upper
limit.

## 2. Staleness measured on the wrong clock

Feeds carry more than one timestamp, and they prove different things:

| Timestamp | Proves |
|---|---|
| Publisher's own (`publishedAt`, embedded in payload) | when the value was *produced* |
| On-chain `updatedAt` | when it *reached the chain* |
| `roundId` monotonicity | ordering, where the feed implements it |

Checking only the publisher timestamp proves the value was produced recently.
It does **not** prove a newer value does not exist. The failure: publisher emits
at t₀ and the relayer pushes it; publisher emits at t₁ and the relayer fails;
the consumer keeps serving t₀ as fresh until t₀'s own window expires.

**Detection:** for each timestamp the code checks, write down which property it
proves, then write down the property you actually need. Check `updatedAt`
against a window matched to the *relayer's* expected cadence, which is typically
far shorter than the data's validity window.

Pair time checks with **value** sanity checks. Non-zero is not enough; bound the
permissible move between consecutive readings so a single bad print cannot
propagate.

## 3. Independently-sourced fields assumed to correspond

Reading a price from one source and its timestamp from another, with nothing
guaranteeing they describe the same observation. If the two are updated in
separate transactions, you can pair a stale price with a fresh timestamp and
conclude, wrongly, that the price is current.

**Detection:** whenever two values are read from separate calls or separate
contracts and then used *together*, ask what guarantees atomicity. Usually
nothing does. Note that the obvious fix — correlate by round ID — silently fails
against feeds that return a constant round ID; verify the discriminator actually
varies before relying on it, and fall back to a tolerance check on the two
update times if it does not.

## 4. Errors swallowed into plausible defaults

The most systemic version of this class. Failures of external services return
values indistinguishable from success:

| Call | On error | Caller sees |
|---|---|---|
| `get_active_markets()` | logs, returns `[]` | "no markets available" |
| `get_prices()` | logs, returns `{}` | "no prices" |
| `is_expiring()` | logs, returns `False` | "not expiring" |
| `get_apr()` | logs, returns `0.0` | "zero yield" |
| `should_execute()` | logs, returns `True` | **"safe to proceed"** |

Each is locally reasonable and collectively catastrophic. An empty market list
from a slow API silently removes a venue from an optimisation; a `0.0` APR
silently deprioritises a position; and the last row is the worst shape of all —
**failing open on a go/no-go decision.**

**Detection:** for every `except`/`catch`/unchecked call, ask what the caller
does with the value, and whether the failure default is fail-open or
fail-closed. Empty collections, `0`, `False` and `0.0` are almost always
indistinguishable from legitimate results.

**Recommendation:** raise. Where liveness genuinely forbids raising, return a
value that is *structurally* distinguishable — `None` rather than `[]` — and
verify every caller handles it. Note separately that swallowed schema or
validation errors may indicate the system is *writing* malformed data, which is
a defect to fix rather than log.

Solidity equivalents: unchecked `transfer`/`transferFrom` return values;
low-level `call` whose success flag is ignored; a `try/catch` whose catch block
proceeds as though nothing failed; and branching on a `false` return from a
function that reverts rather than returning `false`, which makes the branch dead
code.

## 5. The beneficiary supplies the number

A caller passes a value that feeds accounting, fees, limits or eligibility, and
nothing verifies it against reality.

The consequence chain is characteristic and worth tracing all the way out:
unvalidated per-user input → a protocol-wide aggregate built from it →
a limit enforced against that aggregate → any single user can trip the limit
for everyone. A trust defect becomes a denial of service two hops later.

**Detection:** for every value a caller supplies that feeds a security or
economic decision, ask whether the system could **read** it instead of being
told it. If it can, it should. Prefer "observe the balance" over "accept the
declared amount"; prefer settling a fee in the same transaction that grants the
benefit over trusting a separate client-side payment step.

## 6. External identifiers assumed unique or stable

Two distinct assumptions, both usually unstated:

- **Unique** — a name, symbol or label from an external registry used as a
  primary key. Third-party systems rarely guarantee uniqueness of human-readable
  fields. Key on `(address, chainId)` instead.
- **Stable** — a value read at time A and re-read at time B, where the code
  requires them to be equal. If a third party can change it in between, the
  second read breaks the operation. Where an attacker can *cause* the change,
  it is an attack rather than an edge case.

**Fix pattern for stability:** snapshot the value at the first interaction and
use the snapshot thereafter, rather than re-deriving from the external source.

## 7. Off-chain service and backend surface

When scope includes a backend, the audit surface extends past the contracts:

- **Authorization must bind the session to the subject.** A token proving
  *someone* is authenticated is not a token proving *this* principal may act on
  *that* account. Check the identity in the credential against the resource
  identifier in the request — and where two request fields can both denote the
  subject, check they agree rather than validating whichever is present.
- **Key scope.** Service/job credentials that can reach any user's resources;
  endpoints that omit authentication entirely; user tokens and service tokens
  accepted interchangeably.
- **Timing-safe comparison** for secret material.
- **Determinism.** Queries whose result set depends on ordering, pagination or
  concurrent writes, used where completeness is assumed.
- **Freshness of decision inputs.** Automated decisions taken against cached
  state that may predate the last state-changing action.
- **Logging.** Secrets, keys and personal data excluded.
- **Dependency pinning.** Unpinned dependencies make builds irreproducible and
  widen supply-chain exposure.

## 8. Read the integrated protocol's own documentation

Some findings are invisible from the code under review. A rate function may be
correct for one class of underlying and wrong for another; a TWAP window may be
shorter than the integrated protocol recommends; a market may be assumed to use
particular assets without verifying it does.

**Detection:** for each integrated protocol, read its integration guide and list
the assumptions and caveats it explicitly warns about. Check each against the
code. This is the highest-yield activity that pure code review cannot produce.

---

## Checklist

- [ ] Every requested bound re-verified on the response
- [ ] No protection derived as a delta from an unbounded quote — caps only
- [ ] Expected values derived independently before tolerance is applied
- [ ] Staleness checked on the timestamp that proves the property you need
- [ ] Relayer-cadence window checked, not just data-validity window
- [ ] Value-movement sanity bounds, not just non-zero
- [ ] Fields from separate sources correlated; correlating discriminator
      verified to actually vary
- [ ] No error path returns a value indistinguishable from success
- [ ] Failure defaults fail-closed, especially on go/no-go decisions
- [ ] No security or economic decision rests on a caller-supplied number that
      could be observed instead
- [ ] Consequence chains traced from unvalidated input through aggregates to
      limits
- [ ] External identifiers proven unique; re-read values snapshotted
- [ ] Backend: session bound to subject; key scope minimal; comparisons
      timing-safe; queries deterministic; dependencies pinned; logs scrubbed
- [ ] Integrated protocols' own docs read and their stated caveats checked

**Pairs with:** **[Q]** `oracle-flashloan-analysis` for manipulation mechanics
and oracle trust-model classification — this skill covers the *integration*
failures that occur even with a perfectly honest oracle.
