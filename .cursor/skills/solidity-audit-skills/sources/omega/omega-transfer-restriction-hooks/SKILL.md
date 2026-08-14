---
name: omega-transfer-restriction-hooks
description: Audit permissioned and compliance-gated tokens — whitelists, blacklists, sanctions lists, KYC gating and transfer hooks. Checks which parties a restriction actually covers, whether sentinel addresses in the list disable core operations, whether restriction blocks exit paths and permanently seizes assets, whether two lists can diverge, whether the protocol itself can be restricted by an integrated token, and which round-trip paths bypass the gate entirely. Use when auditing RWA or securities tokens, wrapped or bridged permissioned assets, allowlisted vaults, invite-gated systems, or any contract with a _beforeTokenTransfer hook.
---

# Transfer Restriction Hooks

Permissioned tokens invert a normal assumption: transfer is deny-by-default, and
a list decides. That inversion creates a failure family of its own, and it is
badly served by general access-control analysis — the bug is rarely a missing
modifier. It is almost always the restriction covering the wrong set.

> Three questions per restriction: **which parties does it actually cover**,
> **what does it prevent that you did not intend to prevent**, and **what
> unrestricted path achieves the same economic outcome?**

---

## 1. Sentinel addresses inside the list

The most under-appreciated defect in the family. Restriction lists take
arbitrary addresses, but some addresses are load-bearing protocol machinery.

```solidity
function _update(address from, address to, uint256 v) internal override {
    require(!blocked[from] && !blocked[to], "restricted");
    super._update(from, to, v);
}
```

Mint is `from == address(0)`. Burn is `to == address(0)`. So adding
`address(0)` to the list **disables minting and burning globally** — for
everyone, from a function that looks like it restricts one account. A role
scoped to "block a bad actor" turns out to hold a protocol-wide kill switch.

Other addresses with the same property: the contract itself (breaks any
escrow, wrapper or self-custody path), a bridge or vault escrow, the fee
treasury, and any address the protocol transfers through rather than to.

**Test:** enumerate every address that appears as `from` or `to` in an
*internal* transfer the protocol depends on. Each is a candidate. Either
exclude them from the list explicitly, or apply the restriction only on the
paths where both parties are real accounts.

## 2. The restriction covers the value path but not the initiator

A hook sees `from` and `to`. It does not see who *called*.

```solidity
transferFrom(victim, recipient, amount)   // hook checks victim and recipient
                                          // …never msg.sender
```

A restricted address that cannot hold or send tokens can still be granted an
allowance and move other people's — acting as an operator for value it is
barred from owning. Widely-deployed compliance tokens extend the check to the
spender for exactly this reason; a fresh implementation usually does not.

The mint path has the same shape and is worse, because the sentinel hides it:

```solidity
_mint(receiver, shares);
// → _beforeTokenTransfer(address(0), receiver, shares)
//   from == 0, so only `receiver` is ever checked — the depositor is invisible
```

A restricted party calls `deposit(assets, cleanAddress)` and passes value
through the contract into an unrestricted address. The hook fired, the check
passed, and nothing that mattered was examined.

**Test:** for every restricted operation, list the three roles — value source,
value destination, transaction initiator — and check which the hook actually
receives. Then repeat for mint, burn, and every delegated or meta-transaction
path, where the initiator is distinct from both.

## 3. The restriction is applied to the wrong party

A category error rather than a gap. A list of *accredited investors* checked
against the `msg.sender` of `transferFrom` restricts routers, vaults and
aggregators — which are contracts and will never be on an investor list — while
leaving the actual counterparties unchecked.

**Test:** read what the list *is* (in the client's own words), then read who the
check *applies to*. "Accredited investors" and "the caller of `transferFrom`"
are different populations. Where they diverge, either the list or the check is
wrong, and the client has to say which.

## 4. The restriction blocks the exit

Restriction is normally intended to prevent *acquiring* or *moving* an asset. If
the same gate also sits on withdrawal, redemption or debt repayment, then listing
an address does not restrict them — it **seizes** their position, permanently and
without a process to reverse it.

The shapes recur:

- A restricted borrower can no longer repay, so their debt sits in the system
  forever and the protocol carries it.
- Tokens of a de-listed holder are stranded inside a wrapper with no unwrap path.
- A restricted user's queued redemption can neither settle nor cancel.

Whether that is acceptable is a policy question the client must answer
explicitly. It is very rarely what they meant, and it is almost never
documented. The safe default is to gate **entry and transfer**, and leave
**exit-to-self** open.

**Test:** for every restricted address, walk `omega-asset-exit-paths` with the
restriction applied. Every exit that closes is a finding until the client
confirms the seizure is intended.

## 5. Two lists that can diverge

Wrappers, bridges and vaults over a permissioned asset frequently end up with
their own list *plus* the underlying's list.

Ask: which governs? What happens when they disagree — is the effective policy
the union, the intersection, or whichever the code happens to check first? Who
keeps them in sync, and what happens between the two transactions that update
them?

The usual correct answer is to hold one list — have the wrapper read the
underlying's — because two lists that must agree will eventually not.

**Test:** count the restriction lists reachable from one transfer. More than one
is a finding unless a documented precedence rule exists.

## 6. The protocol itself gets restricted

The mirror case, and easy to miss because it is not about your list at all.

Integrated tokens have their own compliance machinery. A reward token, a
collateral asset or a bridged stablecoin can blacklist *your contract*. When it
does, any batch operation that touches it reverts — and if that operation is on
a sole exit path, the assets behind it are stuck.

**Test:** for every third-party token the protocol holds or routes, ask what
happens if the protocol's own address is restricted by it. There must be a way
to skip, isolate or abandon that token without halting everything else — the same
"single element fails the batch" argument from `omega-asset-exit-paths`, arriving
from the compliance direction.

## 7. The round-trip bypass

The restriction covers direct transfer. It rarely covers economic equivalence.

```
A ──restricted──✗──> B          direct transfer blocked
A ──> deposit ──> receipt token ──> transfer receipt to B ──> B redeems   ✓
```

Any wrapper, vault share, LP position, receipt token or queued claim that is
itself transferable reconstitutes the transfer the gate refused. So does a
deposit into a shared pool followed by a withdrawal to a different address.

**Test:** for each restricted asset, list every transferable claim on it. Each
one is a bypass unless it carries the same restriction. If the bypass is
acceptable, the restriction is decorative and should be described honestly as
such (see `omega-enforceability-check`).

## 8. List mutation has no defined semantics

Adding and removing are usually implemented; what they *mean* for existing state
usually is not.

- Does de-listing unwind, freeze, or ignore an existing position?
- Does re-listing restore a previously frozen position, or is that lost?
- Is removal from the list the emergency unfreeze lever? If so, it is a
  privileged operation with protocol-wide effect and needs the corresponding
  role scrutiny, delay and event.
- Are batch add/remove operations atomic, and are they bounded?
- Is every mutation evented? Compliance state that changes without an event is
  unauditable off-chain, which defeats the purpose of having it.

## 9. Hooks that change what standard views mean

Where the restriction mechanism is a pluggable hook, check what else the hook can
reach. A hook able to override `balanceOf`, `totalSupply` or `ownerOf` changes
the meaning of the token's public interface, and every integrator reading those
functions inherits the change without knowing.

Two questions: can the hook make the token's views disagree with its transfers,
and who can set the hook? A hook setter reachable by the token holder rather than
by governance turns "restricted" into "self-service unrestricted" — see
`omega-enforceability-check` §1.

---

## Writing it up

Severity turns on *who bears the consequence*:

| Situation | Typical rating |
|---|---|
| Restriction seizes a compliant user's assets with no recovery | **High** |
| A restricted party achieves the restricted outcome anyway | **Medium** — the control does not work |
| A list entry can disable protocol-wide operations | **Medium**, higher if the role is broadly held |
| The protocol can be frozen by a third-party token's list | **Medium** |
| Two lists that can diverge; unclear mutation semantics | **Low** |

State the intended policy first, in the client's words, then the gap. These
findings are frequently met with "that is the intended compliance behaviour," and
the only way through is to have written down what the behaviour was supposed to
be before describing how it differs.

---

## Checklist

- [ ] Every sentinel address (`address(0)`, the contract, escrows, treasury)
      excluded from the list or unreachable by it
- [ ] Mint and burn paths checked — which party does the hook actually see?
- [ ] The transaction initiator checked, not only source and destination
- [ ] Delegated / meta-transaction / permit paths checked for the same gap
- [ ] The population the list names matches the party the check applies to
- [ ] Exit paths walked with the restriction applied; every closed exit
      confirmed as intended seizure or reported
- [ ] Exactly one restriction list governs a transfer, or precedence is documented
- [ ] The protocol survives being restricted by an integrated token
- [ ] Every transferable claim on a restricted asset carries the restriction
- [ ] De-list / re-list semantics defined for existing positions
- [ ] Mutations bounded, atomic and evented
- [ ] Hook cannot make views disagree with transfers; hook setter is governance-held

**Pairs with:** `omega-asset-exit-paths` for the seizure cases ·
`omega-enforceability-check` for the bypass cases · **[Q]**
`external-call-safety` for the underlying token-integration mechanics.
