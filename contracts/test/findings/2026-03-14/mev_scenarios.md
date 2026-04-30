# MEV and Economic Attack Scenarios

**Date**: 2026-03-14
**Agent**: A6 — Economic/MEV Adversary

---

## Scenario 1: Eviction-Based Delegation Lock (Targeted DoS)

**Goal**: Lock a specific user's shares by evicting their delegated node.

**Setup**:
- Board has 99 nodes
- Target user Alice has delegated 50 shares to tokenId #55 (ranked ~95th)

**Attack Steps**:
1. Attacker observes Alice has `agentDelegation[Alice][55] = 50`
2. Attacker deposits 51 shares into Chamber
3. Attacker delegates 51 shares to a NEW tokenId #101 (not yet in board)
4. `_insert(101, 51)`: size >= 99? No. Insert normally. Board now 100 nodes.
   - OR if board is already at 100: `_insert(101, 51)`: evicts tail if tail.amount < 51
5. If tokenId #55 was the tail (lowest-ranked), it's evicted
6. Alice's `totalAgentDelegations[Alice] = 50` persists; she cannot undelegate
7. Alice cannot withdraw or transfer her 50+ shares

**Cost to attacker**: 51 shares deposited (recoverable by undelegating their own node)
**Impact**: Alice's 50 shares locked indefinitely
**Likelihood**: Requires board to be at 100 nodes and target to be the tail

---

## Scenario 2: Board Seat Dominance via Capital Concentration

**Goal**: Control quorum by delegating large amounts to self-controlled tokenIds.

**Attack Steps**:
1. Attacker acquires multiple NFT tokenIds (e.g., tokenIds 201-205)
2. Attacker deposits large amount and delegates to all 5 tokenIds
3. With `seats = 5`, attacker controls all 5 board seats
4. Attacker has unilateral control over all governance: transactions, upgrades, seat changes

**Mitigations in place**: None — this is by design (plutocratic governance).
**Note**: This is an inherent design property of token-weighted voting, not a bug.

---

## Scenario 3: Seat Proposal Griefing (Gas War)

**Goal**: Block governance change to prevent seat reduction that would remove attacker.

**Attack Steps**:
1. Majority of directors (4/5) agree to reduce seats from 5 to 3 (to remove low-stake directors)
2. 4 directors call `updateSeats(tokenId, 3)` — proposal has 4 supporters
3. Before the timelock expires, attacker (5th director, smallest stake) calls `updateSeats(badTokenId, 4)` with DIFFERENT number
4. Proposal is cancelled (`delete $.seatUpdate`)
5. Repeat every time majority restarts the proposal

**Cost**: One `updateSeats` call per cancellation (~30k gas)
**Attacker benefit**: Maintains directorship indefinitely
**Attacker risk**: None — no penalty for cancellation

---

## Scenario 4: Agent Policy Bypass for Governance Acceleration

**Goal**: Agent owner accelerates governance by bypassing policy review.

**Note**: This is not strictly malicious — it's a design tension. The owner can legitimately want to skip policy for time-sensitive transactions. However, if the Agent represents a DAO sub-committee with policy constraints, bypassing them undermines the governance model.

**Attack Steps**:
1. Agent is configured with `ConservativeYieldPolicy` (MAX_VALUE = 10 ETH, whitelist targets)
2. Chamber has an urgent transaction to a non-whitelisted address with 15 ETH
3. Owner calls `agent.execute(chamber, 0, confirmCalldata)` to bypass policy
4. Transaction is confirmed without policy review

**Impact**: Policy as a governance control is ineffective against determined owners
