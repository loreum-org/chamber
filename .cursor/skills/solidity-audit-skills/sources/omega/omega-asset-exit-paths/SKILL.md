---
name: omega-asset-exit-paths
description: Find permanently trapped funds by tracing every asset's exit path instead of hunting bug classes. For each asset that can enter a contract, enumerate the ways in and the ways out, then ask which reachable states have no way out and who can force the system into them. Catches stuck NFTs, unclaimable remainders, single-token failures that block whole batches, overwritten balances, push-payment blockades, and residue that can never be swept. Use when auditing vaults, escrows, auctions, staking, reward distribution, bridges, or any contract that custodies assets.
---

# Asset Exit Paths

A structural lens, not a signature match. The governing question:

> For every kind of asset this contract can hold, and every reachable state, is
> there an account that can get it out — and can anyone else prevent that?

## Why this beats a bug-class checklist

Trapped-value bugs do not share a bug class. They share a *shape*: an
asymmetry between the paths in and the paths out. Individually they look like an
auction bug, a lock bug, a rounding bug, a refactor slip. A checklist for
"unbounded loop" or "unchecked return" catches almost none of them. The
exit-path question catches all of them, because it is the question they are all
answers to.

Critically, the offending line usually reads as correct. There is no missing
`require`, no unchecked call. The defect is in what the code *does not* have —
a branch, a caller, a state.

---

## The procedure

### 1. Inventory the assets

Every distinct thing of value the contract can hold:

- **ETH** — via `receive`, `fallback`, `payable` functions, `selfdestruct`
  force-feed, block rewards
- **Each ERC-20 in a configured list** — plus **any ERC-20 anyone can transfer
  in directly**
- **NFTs** — arriving via `safeTransferFrom` *and* plain `transferFrom` (the
  latter bypasses your receiver hook, so it never registers in your bookkeeping)
- **Internal claims** — shares, credits, accrued rewards, escrowed request
  amounts, vesting balances, buffer credit
- **Assets held elsewhere on the contract's behalf** — LP positions, aTokens,
  vault shares in an integrated protocol

> **Do not restrict yourself to assets the contract intends to hold.** A large
> fraction of these bugs involve an asset that arrived unexpectedly. The
> recurring shape: code approves a computed amount but then operates on a
> *balance*:
>
> ```solidity
> uint256 minted = pool.addLiquidity(...);
> lpToken.approve(spender, minted);   // approves the delta
> spender.depositAll();               // spends the whole balance
> ```
>
> Anyone who transfers 1 wei of `lpToken` in directly makes every future
> deposit revert. **Tell:** an `approve(x)` whose argument is not the same
> expression the callee will consume.

### 2. Build a ways-in / ways-out table

Per asset. Then look for asymmetry.

| Asset | Ways in | Ways out | Every exit gated by |
|---|---|---|---|
| NFT | `deposit()` | `settle()` → winner only | *a bid existing* |
| ETH | `bid()` | distribution loop | *every recipient accepting ETH* |
| Reward token | `addRewards()` | `claim()` over the array | *every token transferring successfully* |

The third column is where the findings are. Write it as a precondition, and ask
whether that precondition is guaranteed. "A bid existing" is not guaranteed.
"Every recipient accepting ETH" is not guaranteed, and is attacker-controlled.

### 3. Check the exit in every reachable state

Not just the happy path. States that reliably have missing exits:

| State | What to check |
|---|---|
| **Empty / zero** | No bids, no stakers, zero supply, first depositor |
| **Expired / timed out** | Does the expiry branch *preserve* the balance or reset it? |
| **Cancelled / paused / emergency** | Is the exit disabled along with everything else? |
| **Liquidated / insolvent** | Who absorbs the shortfall — is it the last withdrawer? |
| **Partially filled** | Does the remainder have a claimant? |
| **Sanctioned / blacklisted / de-whitelisted** | Is the *asset* frozen or just the *transfer*? |
| **Post-upgrade** | Does v2 still recognize balances v1 recorded? |

For each state × asset: **name the account that can get it out.** If you cannot
name one, that is the finding.

**Two high-yield shapes here.**

*Overwrite on the reset branch.* A conditional that accumulates in one branch
and assigns in the other:

```solidity
if (lock.amount > 0 && block.timestamp < lock.unlockTime) {
    lock.amount += amount;          // live: accumulate
} else {
    lock.amount = amount;           // expired OR new: assign  ← orphans the old balance
}
```

The `else` conflates "no existing position" with "existing but expired
position". **Tell:** any `else` branch that treats a stale state and an absent
state identically, where the stale state holds value.

*The unreachable remainder.* A distribution denominated against a constant
while the actual allocation is only bounded by it:

```solidity
require(totalShares <= 10_000);
// each holder later receives  bid * share / 10_000
```

Allocate 9,000 and 10% of every payout is permanently unclaimable. The
`require` is correct; the **bound** is the bug. **Tell:** a `<=` on a total
that a later division uses as if it were `==`. Either require equality, or
divide by the actual total.

### 4. Ask who can block the exit

An exit that a third party can block is not an exit.

**Single element fails the batch.** The most common blocking shape:

```solidity
for (uint i; i < tokens.length; ++i) {
    tokens[i].safeTransfer(msg.sender, owed[i]);   // any one revert kills all
}
```

One paused, blacklisting, non-standard, or malicious token in the list and
*nothing* in the batch is claimable. The same shape appears over collateral
lists, reward lists, shareholder lists, and strategy lists.

The fix is structural, not defensive. Not "wrap it in try/catch" but: **make
the per-item exit independently callable.** Keep the batch path for
convenience; the single-item path must exist as a fallback. Where the batch
also *burns* an entitlement, split burn from payout — credit an internal
balance on burn, let each asset be withdrawn separately afterwards.

**Push-payment blockade.** Any loop that *sends* value to an address a third
party chose is a hostage situation:

```solidity
for (uint i; i < holders.length; ++i) {
    holders[i].transfer(amount);   // holder deploys a reverting receive()
}
```

Two aggravating factors worth stating in the writeup: the address can be
registered *before* the contract is deployed there, so it is indistinguishable
from an EOA at registration time; and the attacker can hold the whole batch
hostage for a ransom up to the value of everything frozen. That converts a
"griefing" rating into an extortion rating. **Fix:** pull, not push.

**Unbounded or user-extendable iteration.** A list that grows without a cap, or
that users can append to, eventually exceeds the block gas limit — and the
assets behind it are then permanently stuck. Distinguish two cases: an
unbounded loop in a *view* is an inconvenience; an unbounded loop on the **only
exit path** is trapped value.

**Griefed entry.** The mirror image — an attacker prevents assets from getting
*in*, or forces a revert on someone else's deposit. Covered in
`omega-ordering-and-approval-races`, but check it here too since the tell is
the same: a balance-derived or supply-derived quantity that an outsider can
move.

### 5. Check the exit returns the right asset to the right place

An exit that fires but misdelivers is still a loss:

- **Caller-supplied asset address on a permissionless exit.** If `redeem(address
  outputAsset)` is callable by anyone, an attacker picks an asset that is
  approved-but-wrong; the swap succeeds, and the accounting function that
  expects the canonical asset can no longer see the proceeds.
- **Two exits, different value.** Where two functions redeem the same position
  but one omits a component (a secondary token, an accrued fee), the user who
  picks the wrong one silently forfeits value. **Tell:** overlapping redeem/
  withdraw/claim functions whose payouts are not obviously equal.
- **Ambiguous destination.** Two entry points that deliver different assets
  against the same authorization — whoever calls first decides what the
  recipient gets.

**General principle:** an exit should not take, as a parameter, something the
contract can derive itself. Asset addresses, principal amounts and recipients
that are configuration belong in immutable storage set at construction, not in
the calldata of a permissionless function.

### 6. Check the residue

After every normal operation completes, what is left over, and can it be
recovered?

- Overpayment — does the contract refund the excess, or keep it?
- Rounding dust accumulating across many operations
- Fees or shares allocated to an actor with no claim function
- Balances stranded by a configuration change (a removed chain, a de-listed
  token, a de-whitelisted holder)

**The self-bricking equality check** deserves its own tell:

```solidity
require(token.balanceOf(address(this)) == amount, "...");
```

An exact-balance assertion on a contract anyone can transfer to is permanently
falsifiable with 1 wei — and if there is no sweep function, both the dust and
the function are lost forever. Two independent defects: the strict equality,
and the missing sweep. Prefer `>=`, and provide a sweep for non-accounted
balances.

Finally: **a recovery path that requires breaking the system is not a recovery
path.** "The owner can point the vault at a temporary address, extract, and
point it back" is a finding, not a mitigation.

---

## Writing it up

State it as a lifecycle, not a line number. The three beats:

1. **Mechanism** — there is exactly one exit, and here is its precondition
2. **The state with no exit** — and how it is reached (ordinary operation is
   worse than attacker-induced)
3. **Consequence** — permanent, or recoverable by whom

Then let the recommendation name **the missing path**, not the broken line:
"allow the depositor to reclaim the asset when the auction closes with no bids."

**Severity calibration:**

| | |
|---|---|
| **High** | Value permanently unrecoverable by anyone |
| **Medium** | Recoverable only by privileged intervention, or the precondition is improbable |
| **Low** | Recoverable, but the path is undocumented or expensive |

Say which one applies and why, in a clause. An improbable precondition and an
unrecoverable loss pull in opposite directions — state which dominates.

---

## Checklist

- [ ] Every asset the contract *can* hold inventoried, including unexpected ones
- [ ] Ways-in / ways-out table built, with each exit's precondition written out
- [ ] Exit checked in every reachable state: empty, expired, cancelled, paused,
      liquidated, partially filled, sanctioned, post-upgrade
- [ ] For each state, the account that can exit the asset is *named*
- [ ] No `else` branch assigns where the live branch accumulates
- [ ] No division by a constant bound that the code only enforces as `<=`
- [ ] No batch exit depends on *every* element succeeding
- [ ] No exit pushes value to an address a third party chose
- [ ] No sole exit path iterates an unbounded or user-extendable list
- [ ] Exits deliver the right asset to the right recipient; no caller-supplied
      configuration on permissionless exits
- [ ] No `approve(delta)` paired with a callee that consumes a balance
- [ ] No strict equality on a balance an outsider can change
- [ ] Residue, dust, overpayment and stranded balances are sweepable
- [ ] Recovery paths do not require disrupting the system to use

**Pairs with:** **[Q]** `dos-griefing-analysis` for push-vs-pull and 63/64 gas
mechanics · **[L]** `depth-edge-case` for systematic zero/max/boundary
enumeration of the state space.
