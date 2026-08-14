---
name: omega-standard-conformance
description: Audit whether a contract honours the standards and interfaces it advertises — ERC-20/721/1155/4626, EIP-712/2612, and any declared interface. Checks the promise behind each signature rather than the signature itself: return-value versus revert semantics, callbacks that revert against correct counterparty implementations, domain separators left uninitialized by restructured init, hooks that change what standard views mean, and interfaces declared but not inherited. Use when auditing a token, vault, wrapper, or any contract other systems will integrate against.
---

# Standard Conformance

A standard is a promise to code you will never see. Integrators build against the
specification, not against your implementation, and they cannot inspect it at
call time — so a deviation does not fail loudly for you, it fails quietly for
them, later, in a transaction you are not part of.

> For every standard the contract claims: **what does the specification promise
> that this implementation does not deliver**, and **who finds out — the direct
> caller, or an integrator three hops away?**

That second question is the severity lever, and it is the one most reviews miss.

---

## 1. Matching the signature, breaking the promise

The commonest and highest-impact shape. A function keeps the standard's name and
arguments while changing what it guarantees:

- A `swap` that keeps a share of the output instead of delivering the requested
  minimum
- A `transfer` that silently moves less than the amount, or applies a fee
- A `deposit`/`redeem` that returns a value the vault standard says must be
  exact
- A function that reverts in a case the standard says must succeed, or succeeds
  where the standard says it must revert

**Why it matters more than it looks.** The direct caller may notice and handle
it. But these functions are almost never called directly — they are called by a
router, an aggregator, a vault, or a keeper that was written against the
standard, checks the standard's guarantees, and reverts or misprices when they do
not hold. The victim is a contract that never consented to your deviation.

**Test:** for each standard function, read the specification's normative text —
the MUSTs — and check them one at a time. Then ask which existing protocol
would call this function, and what it does with the return value.

## 2. Return-value versus revert semantics

Two ways to signal failure, and code that assumes the wrong one has a dead
branch:

```solidity
bool ok = token.transferSharesFrom(a, b, amt);
if (!ok) emit TransferFailed(a, b);          // never fires — the callee reverts
```

The handler exists, was reviewed, was tested against a mock that returns
`false`, and cannot execute against the real implementation. The inverse — a
function that returns `false` where the caller expects a revert — silently
continues past a failed transfer.

**Test:** for every branch on a call's boolean result, read the callee. Does it
actually return `false`, or does it revert? Mocks lie here more than anywhere
else: a mock written from the interface returns `false`, so the test suite
confirms a branch production will never take. Check the real implementation, not
the interface and not the mock.

## 3. A correct counterparty implementation still reverts

The subtle inverse of "handle non-standard tokens". Here the *counterparty* is
standard-compliant and your call fails anyway, because you invoked the standard
in a way it permits but the implementation does not tolerate.

The recurring instance is a receiver hook called with empty calldata:

```solidity
IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, "");
```

A receiver that validates its `data` argument — entirely within spec — reverts.
The transfer fails for a recipient that correctly implements the interface it
declares. And because this typically sits on a transfer path, the practical
consequence is that a legitimate holder cannot move or retrieve their asset.

The mirror case is the omitted safety check: `_mint` rather than `_safeMint` on
an NFT skips the receiver check entirely, so the token lands at a contract that
cannot handle it and is lost. Both directions of the same question — does the
transfer path respect what the recipient can actually accept?

**Test:** for every callback into a recipient, enumerate what a *compliant*
implementation is allowed to do with each argument, and confirm your call
survives all of it. Never assume optional arguments are ignored.

## 4. Copied crypto with uninitialized constants

Domain separators, type hashes and chain IDs are set during construction in the
original implementation. A fork that restructures initialization — moving to a
proxy, splitting the constructor, adding a factory — commonly leaves them empty
or chain-independent.

Nothing looks wrong. Every line is plausible, the tests pass because they sign
and verify with the same broken value, and the consequence is that signatures
replay across deployments and chains, and external wallets can no longer produce
a signature the contract accepts.

**Test:** for any EIP-712 or permit implementation, confirm the domain separator
is non-zero after deployment, is bound to *this* contract address and *this*
chain id, and is recomputed if the chain can fork. Verify against the upstream
implementation the code was derived from rather than reading it in isolation.

## 5. Declared but not inherited

```solidity
contract Vault { ... }              // implements the shape of IVault, informally
interface IVault { ... }            // …but nothing enforces the correspondence
```

The point of inheriting the interface is not documentation — it makes drift a
**compile error**. Without it, an interface and its implementation diverge
silently over time, and integrators generated their bindings from the interface.

**Test:** every declared interface is actually inherited. Every function in the
interface exists in the implementation, and vice versa. This is mechanical and
worth doing even when nothing else about the contract concerns you.

## 6. Hooks and overrides that redefine standard views

A pluggable hook, or an override, that reaches `balanceOf`, `totalSupply`,
`ownerOf` or `decimals` changes what the token's public interface means — for
every integrator, silently.

Two consequences to check:

- **Views disagreeing with transfers.** A `balanceOf` that reports what a
  transfer will not honour breaks any integrator that checks before acting.
- **Downstream tooling constrained.** Snapshot/voting systems, indexers and
  accounting tools read these views and assume standard semantics. An
  implementation that reports a computed value rather than a stored one may
  quietly rule out whole categories of integration.

**Test:** list every standard view whose value is computed rather than stored, or
that a hook can influence. For each, ask what an integrator would conclude from
it and whether that conclusion holds.

## 7. Events are part of the interface

Indexers, accounting systems and subgraphs consume events as the authoritative
record. An event emitted with the wrong values, at the wrong time, or not at all
is an integration defect even when the contract's state is perfectly correct.

Check: standard events fire on every state change the standard says they should;
their arguments carry the values the standard defines (not an intermediate or a
pre-fee amount); and non-standard extensions do not reuse standard event
signatures with different semantics.

## 8. Standards adopted late

When a contract gains a standard's interface in a later version — a wrapper that
becomes a vault, a token that gains permit — the interface is usually added
before the semantics are. It compiles, it satisfies `supportsInterface`, and it
does not satisfy the specification.

Treat "we added ERC-XXXX support" as a claim to verify in full, not a feature to
note. See `omega-upgrade-diff-review` §4 for the version-to-version case.

---

## Writing it up

Name the standard and quote its normative text. "Does not follow ERC-4626" is
dismissible; "ERC-4626 requires `maxWithdraw` to return the maximum that will not
revert, and this implementation returns a value that reverts when the strategy is
illiquid" is not.

Then trace the harm to the integrator. The severity argument is almost always
"a router/vault/indexer written against the standard will do X, and X is wrong
here" — not "the caller might be surprised." A deviation that only the direct
caller sees is usually low; one that a composing protocol inherits is not.

Where the deviation is deliberate, say so and recommend the contract stop
claiming the standard: dropping the interface declaration is a legitimate fix,
and often the honest one.

---

## Checklist

- [ ] Every claimed standard's normative MUSTs enumerated and checked
- [ ] For each standard function, the likely on-chain caller identified and its
      assumptions checked
- [ ] Every branch on a boolean result verified against the real callee, not the
      interface or the mock
- [ ] Receiver callbacks survive anything a compliant recipient may do with
      optional arguments
- [ ] `_safeMint` versus `_mint` reviewed on every NFT mint path
- [ ] Domain separator non-zero, address-bound and chain-bound after deployment
- [ ] Declared interfaces actually inherited; no drift in either direction
- [ ] Computed or hook-influenced standard views cannot contradict transfers
- [ ] Standard events fire at the right time with the specified values
- [ ] Newly adopted standards verified in full, not assumed from the interface
- [ ] Deliberate deviations either fixed or the standard claim dropped

**Pairs with:** **[Q]** `external-call-safety` for the other direction —
consuming non-standard tokens rather than being one · `omega-upgrade-diff-review`
§4 for conformance a previous version established ·
`omega-transfer-restriction-hooks` where the deviation *is* the compliance gate.
