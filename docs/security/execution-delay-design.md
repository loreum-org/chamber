# Design note: delay between quorum and execute

Not implemented. This is a proposal for a later version. Chamber 1.3.0 still executes in the same transaction that reaches quorum.

## What is missing

A wallet proposal can be submitted, confirmed, and executed as soon as live confirmations reach `max(submitQuorum, liveQuorum)`. On a one-seat board that is a single transaction: submit auto-confirms, and execute can follow in the same block. Cancel votes use the same bar and can lose a same-block race to execute. Seat changes already wait 7 days. Ordinary spends do not.

Holders and the other directors have no guaranteed window to undelegate, cancel, or exit after the vote is won and before the call runs.

## Proposed rule

When a confirm (including the submitter's auto-confirm) first makes live flags reach the required bar, store `quorumReachedAt[nonce] = block.timestamp`. `executeTransaction` reverts `ExecutionTooEarly` until `block.timestamp >= quorumReachedAt + EXECUTION_DELAY`.

Starting constant: **1 day**. Long enough to notice a spend, short of the 7-day seat timelock. A later version can make it a board parameter. Do not reuse `SEAT_UPDATE_TIMELOCK`; spends and seat changes are different risks.

Re-check the live bar at execute, as today (M-04). If a revoke, a controller change, or a seat change drops live flags below the bar, clear `quorumReachedAt`. The delay starts again the next time the bar is met. Do not freeze the clock while the proposal is under quorum.

Cancel stays available during the delay and does not wait.

## Pause

A delay on `pause` would leave a compromised key free to spend for a day. Exempt a self-call whose stored selector is `pause()`. `unpause` can wait.

## Storage

Append `mapping(uint256 nonce => uint256 quorumReachedAt)` to the Wallet ERC-7201 struct. Do not insert it above existing fields. Proposals that already exist at upgrade time have a zero timestamp; treat zero as "not yet reached" and stamp it on the next confirm that meets the bar, or on the first execute attempt that already meets it, then apply the delay. That avoids an instant execute of every in-flight proposal in the upgrade block, and it avoids bricking them.

## Code

Put the stamp and the check in `WalletLib`, next to confirm and execute. Chamber only needs the pause exemption, which it can pass in as a bool so the library stays free of the pause selector. `ChamberAuthHarness` must mirror the check or Halmos will not see it.

## What this does not do

It is not a guard against a board that already holds quorum and waits out the day. It does not replace the seat-update timelock. It does not change delegation locks. Bytecode belongs in `WalletLib`; the Chamber wrapper should stay a branch and a delegatecall so the EIP-170 margin is preserved.

Ship only with a PoC that a quorum-1 submit plus execute in one block reverts, and that the same proposal executes after the delay, including the pause exemption.
