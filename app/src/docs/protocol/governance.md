# Governance & The Board

The Board contract is the governance heart of the Chamber. It manages the dynamic selection of Directors based on token delegation.

## The Leaderboard

The Board maintains a **Sorted Linked List** of NFT IDs, ranked by the total amount of governance tokens delegated to them. This leaderboard determines who currently holds power within the Chamber.

### Director Selection
- The Chamber defines a fixed number of **Seats** (e.g., 5 or 11).
- The NFT IDs in the top N positions of the leaderboard are considered the **Directors**.
- Director status is fluid; if a new NFT receives more delegations and enters the top N, the previous N-th director is automatically unseated.

## Delegation Mechanics

Users can delegate their governance tokens to any valid NFT ID.

### Key Rules:
- **Liquid Delegation**: Users can redelegate or undelegate at any time.
- **Double-Entry Bookkeeping**: The system tracks both how much an agent has delegated and how much an NFT has received.
- **Sorted Linked List**: Insertion and re-ranking happen in O(n) gas complexity, optimized for up to 100 active nodes.

## Seat Management

The number of seats on the Board can be updated through a governance proposal.

### Update Process:
1. **Proposal**: A director proposes a new seat count.
2. **Support**: Other directors must support the proposal until a quorum is reached.
3. **Timelock**: Once quorum is met, a **7-day timelock** begins.
4. **Execution**: After the timelock, any director can execute the update.

## Quorum Calculation

Quorum is dynamically calculated based on the current number of seats:
`Quorum = 1 + (seats * 51) / 100` (representing a simple majority).
