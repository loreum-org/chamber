# Chamber Protocol Invariants

## Core Accounting Invariants

### Balance Integrity
- **Invariant**: `balanceOf(user) >= totalAgentDelegations[user]` ∀ users
- **Rationale**: Users cannot delegate more tokens than they own
- **Check Points**: After delegate(), undelegate(), any transfer/withdrawal
- **Violation Impact**: Negative delegation state, governance corruption

### Delegation Consistency
- **Invariant**: `sum(agentDelegation[user][tokenId] for all tokenId) == totalAgentDelegations[user]` ∀ users
- **Rationale**: Individual delegations sum to total delegations
- **Check Points**: After all delegation operations
- **Violation Impact**: Inconsistent accounting, wrong board rankings

## Governance Invariants

### Board Ordering
- **Invariant**: Board linked list is properly sorted by delegation amount (descending)
- **Rationale**: Top N delegates are always the directors
- **Check Points**: After _insert(), _remove(), _reposition()
- **Violation Impact**: Wrong directors elected, governance compromise

### Director Eligibility
- **Invariant**: Directors own their NFT tokens and are in top seats
- **Rationale**: Only legitimate token holders can act as directors
- **Check Points**: Before director-only functions execute
- **Violation Impact**: Unauthorized governance actions

### Quorum Enforcement
- **Invariant**: Transactions require >51% of current directors to confirm
- **Rationale**: Majority rule prevents single points of failure
- **Check Points**: Before executeTransaction()
- **Violation Impact**: Insufficient approval for fund movements

## Transaction Invariants

### Execution Atomicity
- **Invariant**: Transactions execute exactly once or revert completely
- **Rationale**: Prevent double-spending or partial execution
- **Check Points**: In _executeTransaction()
- **Violation Impact**: Fund loss or state corruption

### Confirmation Integrity
- **Invariant**: `transaction.confirmations == count(isConfirmed[txId][tokenId] where tokenId is director)`
- **Rationale**: Confirmation count matches actual confirmations
- **Check Points**: After confirm/revoke operations
- **Violation Impact**: Wrong quorum calculations

## Seat Management Invariants

### Seat Update Timelock
- **Invariant**: Seat changes require 7+ day delay and ongoing quorum support
- **Rationale**: Prevent governance parameter manipulation
- **Check Points**: Before _executeSeatsUpdate()
- **Violation Impact**: Sudden governance structure changes

### Dynamic Quorum
- **Invariant**: Quorum calculated as `1 + (seats * 51) / 100` and seats > 0
- **Rationale**: Proportional representation with minimum security
- **Check Points**: When seats change
- **Violation Impact**: Too low/high approval thresholds

## ERC4626 Invariants

### Share Protection
- **Invariant**: Virtual shares prevent inflation attacks (_decimalsOffset = 3)
- **Rationale**: First depositor cannot manipulate share price
- **Check Points**: During deposit/mint operations
- **Violation Impact**: Economic attacks on vault

### Transfer Constraints
- **Invariant**: All share transfers respect delegation limits
- **Rationale**: Delegated tokens cannot be transferred away
- **Check Points**: In _update() override
- **Violation Impact**: Delegation state corruption

## External Interaction Invariants

### NFT Ownership
- **Invariant**: Director checks use current NFT ownership (with error handling)
- **Rationale**: Ownership can change between checks and execution
- **Check Points**: Before director actions
- **Violation Impact**: Stale ownership assumptions

### EIP-1271 Validation
- **Invariant**: Smart contract directors validate signatures correctly
- **Rationale**: Contract-based directors follow proper authorization
- **Check Points**: During _isDirector() for contracts
- **Violation Impact**: Unauthorized contract access

## Upgrade Safety Invariants

### Proxy Ownership
- **Invariant**: Chamber contract owns its ProxyAdmin
- **Rationale**: Only governance can upgrade implementation
- **Check Points**: Before upgradeImplementation()
- **Violation Impact**: Unauthorized upgrades

### Implementation Authorization
- **Invariant**: Only Chamber contract can call upgradeImplementation
- **Rationale**: Upgrades require governance approval
- **Check Points**: In upgradeImplementation()
- **Violation Impact**: Direct proxy manipulation

## Circuit Breaker Invariants

### Reentrancy Prevention
- **Invariant**: Circuit breaker prevents nested delegation operations
- **Rationale**: Linked list operations are atomic
- **Check Points**: During _delegate(), _undelegate(), _reposition()
- **Violation Impact**: Linked list corruption

### State Consistency
- **Invariant**: All state changes are atomic or properly reverted
- **Rationale**: Partial failures don't leave inconsistent state
- **Check Points**: After external calls
- **Violation Impact**: Inconsistent internal state