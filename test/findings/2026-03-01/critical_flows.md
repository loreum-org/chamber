# Critical Flows - Chamber Protocol

## 1. Deposit & Delegation Flow
**Purpose**: Users deposit ERC20 tokens and delegate governance power

**Steps**:
1. User calls `deposit(amount, receiver)` on Chamber (ERC4626)
2. Chamber mints shares to receiver
3. User calls `delegate(tokenId, amount)` on Chamber
4. Chamber validates NFT exists, checks balance >= delegation
5. Updates `agentDelegation[receiver][tokenId]` and `totalAgentDelegations[receiver]`
6. Calls `_delegate(tokenId, amount)` in Board contract
7. Board maintains sorted linked list of delegations
8. If user becomes top N, they gain director status

**Critical Checks**:
- NFT ownership verification (try-catch around ownerOf)
- Balance integrity: `balanceOf(user) >= totalDelegatedAmount(user)`
- Linked list integrity maintained

## 2. Transaction Submission & Approval Flow
**Purpose**: Directors propose and approve fund movements

**Steps**:
1. Director calls `submitTransaction(tokenId, target, value, data)`
2. Validates director status via `_isDirector(tokenId)`
3. Validates target address (allows address(this) for upgrades)
4. Creates Transaction struct and auto-confirms for submitter
5. Other directors call `confirmTransaction(tokenId, transactionId)`
6. When `confirmations >= quorum`, director calls `executeTransaction()`
7. Executes via low-level call, updates executed flag

**Critical Checks**:
- Director verification (NFT ownership + EIP-1271)
- Quorum calculation (51% + 1 of seats)
- Reentrancy protection on all wallet functions
- State updates before external calls (CEI pattern)

## 3. Undelegation Flow
**Purpose**: Users can withdraw their delegated voting power

**Steps**:
1. User calls `undelegate(tokenId, amount)`
2. Validates sufficient delegation exists
3. Updates delegation mappings
4. Calls `_undelegate()` in Board
5. Board removes/updates node in sorted list
6. If user was director and drops below threshold, loses director status

**Critical Checks**:
- Delegation amount validation
- Board ranking updates correctly
- Director status updates

## 4. Seat Update Flow
**Purpose**: Governance can change the number of board seats

**Steps**:
1. Director calls `updateSeats(tokenId, newSeats)`
2. If no active proposal, creates SeatUpdate struct
3. Other directors call `updateSeats()` to support (increments supporters)
4. After 7 days, director calls `executeSeatsUpdate()`
5. Validates timelock expired and quorum maintained
6. Updates seats count, clears proposal

**Critical Checks**:
- Only directors can propose/execute
- Timelock enforcement (7 days)
- Dynamic quorum validation at execution time
- Supporters still in top seats check

## 5. Upgrade Flow
**Purpose**: Governance can upgrade the Chamber implementation

**Steps**:
1. Directors submit upgrade transaction via `submitTransaction()`
2. Transaction targets Chamber contract, calls `upgradeImplementation(newImpl, data)`
3. Multisig confirmation process
4. When executed, calls ProxyAdmin.upgradeAndCall()
5. New implementation deployed with initialization data

**Critical Checks**:
- Only Chamber can call upgradeImplementation (msg.sender check)
- Chamber owns ProxyAdmin (ownership verification)
- UUPS authorization in new implementation

## 6. ERC4626 Transfer Flow
**Purpose**: Share transfers with delegation constraints

**Steps**:
1. User calls `transfer(to, amount)` or `transferFrom(from, to, amount)`
2. `_update(from, to, amount)` called
3. Validates `balanceOf(from) - amount >= totalDelegatedAmount(from)`
4. Performs transfer if constraint satisfied

**Critical Checks**:
- Delegation constraints enforced on all transfers
- Redeems/withdrawals also constrained
- Virtual shares prevent inflation attacks (_decimalsOffset = 3)