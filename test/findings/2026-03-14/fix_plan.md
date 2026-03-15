# Fix Plan — Chamber Protocol v1.1.3

**Date**: 2026-03-14

---

## Priority 1 (Ship Blocker) — Fix Before Deployment

### SEC-DELEG-011: Permanent Delegation Lock on Evicted Board Nodes

**Effort**: Low (1–2 hours)
**Owner**: `src/Chamber.sol` + `src/Board.sol`

**Recommended fix** in `Chamber.undelegate()`:

```solidity
function undelegate(uint256 tokenId, uint256 amount) external override {
    if (tokenId == 0) revert IChamber.ZeroTokenId();
    if (amount == 0) revert IChamber.ZeroAmount();

    ChamberStorage storage $ = _getChamberStorage();
    uint256 currentDelegation = $.agentDelegation[msg.sender][tokenId];
    if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

    uint256 newDelegation = currentDelegation - amount;
    $.agentDelegation[msg.sender][tokenId] = newDelegation;
    $.totalAgentDelegations[msg.sender] -= amount;

    // Only update board if node still exists (handles evicted nodes)
    BoardStorage storage $b = _getBoardStorage();
    if ($b.nodes[tokenId].tokenId == tokenId) {
        _undelegate(tokenId, amount);
    }

    emit IChamber.DelegationUpdated(msg.sender, tokenId, newDelegation);
}
```

**Test**: `test/findings/2026-03-14/Finding11_EvictedNodeDelegationLock.t.sol`

---

## Priority 2 (High Priority, Ship Recommended) — Fix Soon After Deployment

### SEC-POLICY-012: Agent execute() Bypasses Governance Policy

**Effort**: Low (documentation + optional guard)
**Owner**: `src/Agent.sol`

**Option A** (documentation only — if bypass is intentional design):
Add explicit NatSpec to `execute()`:
```solidity
/// @notice WARNING: This function bypasses the governance policy set in autoConfirm().
/// @dev Owner escape hatch for emergency use. Use autoConfirm() for policy-governed confirmations.
function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
```

**Option B** (enforce policy on execute targeting Chamber):
```solidity
function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
    // Enforce policy if calling confirmTransaction on any chamber
    if (data.length >= 4 && bytes4(data) == IChamber.confirmTransaction.selector) {
        AgentStorage storage $ = _getAgentStorage();
        if (address($.policy) != address(0)) {
            // Decode transactionId from calldata and check policy
            // ... additional guard logic
        }
    }
    (bool success, bytes memory result) = target.call{value: value}(data);
    if (!success) revert("Execution failed");
    return result;
}
```

**Recommended**: Option A (document clearly). Option B adds complexity without full enforcement guarantee.

---

### SEC-EIP1271-013: Agent isValidSignature 32-Byte Path Ignores Hash

**Effort**: Low
**Owner**: `src/Agent.sol`

**Recommended fix**: Remove the 32-byte shortcut or restrict it with a hash commitment:

```solidity
function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
    address _owner = _getAgentStorage().owner;

    // Full ECDSA recovery only — no hash-agnostic shortcut
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
    if (err == ECDSA.RecoverError.NoError && signer == _owner) {
        return IERC1271.isValidSignature.selector;
    }

    return 0xffffffff;
}
```

**Note**: The Chamber's `_isDirector` calls `isValidSignature(hash, abi.encode(msg.sender))` where `signature.length == 32`. This won't match the ECDSA path. If fixing this, also update `_isDirector` to pass a real ECDSA signature or use a different authorization mechanism for contract-owned NFTs.

**Alternative**: Keep the 32-byte path but document its scope and risk explicitly.

---

## Priority 3 (Governance Improvement) — Fix When Resources Allow

### SEC-GOV-014: Seat Update Proposal Griefing by Minority Director

**Effort**: Medium (logic change + tests)
**Owner**: `src/Board.sol`

**Recommended fix**: Require multi-director consensus to cancel a proposal, or add a minimum age before cancellation:

```solidity
// Option: Require proposal to be less than 24 hours old to cancel
// OR: Require cancellation to come from the PROPOSER only
// OR: Add a cooldown before new proposals can start after cancellation
```

**Simplest fix**: Prevent single-director cancellation — require the same quorum to cancel as to execute, or simply emit a cancellation event without deleting (let the new proposal override via timelock expiry).
