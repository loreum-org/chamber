# Security Findings Review

**Target**: `src/` directory  
**Date**: 2026-02-06  
**Reviewer**: AI Security Review (Skills: security-review, adversarial-testing, lifecycle-testing)

---

## Executive Summary

A comprehensive security review of the Chamber protocol identified **1 Critical**, **2 High**, **3 Medium**, and **1 Low** severity finding beyond the previously-reported issues (unauthorized upgrade, double delegation, board DoS — all fixed). All 7 findings have been remediated and verified with passing tests.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | **Fixed** |
| High | 2 | **Fixed** |
| Medium | 3 | **Fixed** |
| Low | 1 | **Fixed** |

**Test Coverage**: All findings have corresponding proof-of-concept tests in `test/findings/` confirming the fixes block the exploits. Full test suite (244 tests) passes.

---

## Finding 4: ERC4626 Withdraw Bypasses Delegation Locks [CRITICAL] — FIXED

**Location**: `Chamber.sol` — missing override of `_update()`

**Description**:  
Chamber overrides `transfer()` and `transferFrom()` to enforce that a user cannot transfer shares below their `totalAgentDelegations`. However, ERC4626's `withdraw()` and `redeem()` call `_burn()` internally, which calls `_update(account, address(0), value)` — this path never hits the overridden `transfer`/`transferFrom`. The delegation check is completely bypassed.

**Impact**:  
A user can deposit, delegate all shares, then `withdraw()` to reclaim tokens while retaining stale delegations — enabling **infinite delegation inflation with zero economic stake**.

**Fix Applied**:  
Added `_update()` override in `Chamber.sol` that enforces delegation constraints on all outgoing token movements (transfers and burns):

```solidity
function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && value > 0) {
        uint256 fromBalance = balanceOf(from);
        if (fromBalance >= value && fromBalance - value < totalAgentDelegations[from]) {
            revert IChamber.ExceedsDelegatedAmount();
        }
    }
    super._update(from, to, value);
}
```

Redundant delegation checks in `transfer()` and `transferFrom()` were removed (now handled centrally in `_update()`).

**Test**: `test/findings/Finding4_DelegationBypassViaWithdraw.t.sol` — verifies `withdraw()` and `redeem()` revert with `ExceedsDelegatedAmount` when user has active delegations.

---

## Finding 5: Agent `getDirectorTokenId` Returns 0 — Dead Code Path [HIGH] — FIXED

**Location**: `Agent.sol:125-144` and `Agent.sol:103-117`

**Description**:  
`getDirectorTokenId()` always returns `0` (placeholder). The two-parameter `autoConfirm(address chamber, uint256 transactionId)` calls this function, then passes `0` to `Chamber.confirmTransaction(0, transactionId)`. Chamber's `_isDirector(0)` immediately reverts.

**Impact**:  
The two-parameter `autoConfirm` is permanently broken — any call always reverts.

**Fix Applied**:  
- Removed `getDirectorTokenId()` function entirely
- Removed the broken two-parameter `autoConfirm(address, uint256)` overload
- Only the three-parameter `autoConfirm(address, uint256, uint256)` remains, which explicitly takes `tokenId`

**Test**: `test/findings/Finding5_AgentDeadCodePath.t.sol` — verifies the three-parameter version works correctly.

---

## Finding 6: ERC4626 First Depositor / Donation Attack [HIGH] — FIXED

**Location**: `Chamber.sol` — inherits `ERC4626Upgradeable` without inflation protection

**Description**:  
Classic ERC4626 inflation attack: attacker deposits 1 wei, donates tokens directly to inflate share price, subsequent depositors get 0 shares due to rounding.

**Impact**:  
First depositor can steal subsequent deposits via share price manipulation.

**Fix Applied**:  
Added `_decimalsOffset()` override returning `3`, which adds 1000 virtual shares to the calculation. This makes the inflation attack economically infeasible:

```solidity
function _decimalsOffset() internal pure override returns (uint8) {
    return 3;
}
```

With this offset, shares = assets * 1000 (approximately), so an attacker would need to donate 1000x more capital to execute the same attack. Vault tests updated to account for the 1:1000 asset-to-share ratio.

**Test**: `test/findings/Finding6_FirstDepositorAttack.t.sol` — verifies victims receive meaningful shares even after attacker donation.

---

## Finding 7: Stale Seat Update Supporters [MEDIUM] — FIXED

**Location**: `Board.sol` — `_executeSeatsUpdate()`

**Description**:  
Seat update proposals count all original supporters toward quorum, even if supporters have lost their directorship between proposal creation and execution.

**Impact**:  
A seat update could pass with stale support from non-directors.

**Fix Applied**:  
Added `_isInTopSeats()` helper and modified `_executeSeatsUpdate()` to validate each supporter is still in the top seats at execution time. Only valid supporters count toward quorum:

```solidity
uint256 validSupport = 0;
for (uint256 i = 0; i < proposal.supporters.length;) {
    if (_isInTopSeats(proposal.supporters[i])) {
        unchecked { ++validSupport; }
    }
    unchecked { ++i; }
}
if (validSupport < proposal.requiredQuorum) {
    revert IBoard.InsufficientVotes();
}
```

**Test**: `test/findings/Finding7_StaleSeatUpdateSupporters.t.sol` — verifies proposal reverts when supporters lose directorship.

---

## Finding 8: Permissionless Agent AutoConfirm [MEDIUM] — FIXED

**Location**: `Agent.sol` — `autoConfirm()`

**Description**:  
`autoConfirm` was callable by anyone, allowing any external actor to force the Agent to confirm transactions (policy permitting).

**Impact**:  
With `AllowAllPolicy`, any party can force-confirm transactions, removing the Agent owner's control over confirmation timing.

**Fix Applied**:  
- Added `authorizedKeepers` mapping and `onlyAuthorized` modifier
- `autoConfirm` now requires caller to be owner or authorized keeper
- Added `setKeeper(address, bool)` for owner to manage keepers
- Added `NotAuthorized` error

```solidity
modifier onlyAuthorized() {
    if (msg.sender != owner && !authorizedKeepers[msg.sender]) revert NotAuthorized();
    _;
}
```

**Test**: `test/findings/Finding8_PermissionlessAutoConfirm.t.sol` — verifies random users are blocked, owner and authorized keepers can confirm.

---

## Finding 9: Wallet State Visibility During External Call [MEDIUM] — FIXED

**Location**: `Wallet.sol` — `_executeTransaction()`, `Chamber.sol` — `submitTransaction()`, `confirmTransaction()`, `revokeConfirmation()`

**Description**:  
During `executeTransaction`, the external `.call()` allows the target to re-enter state-mutating functions (`submitTransaction`, `confirmTransaction`, `revokeConfirmation`) that were not protected by `nonReentrant`.

**Impact**:  
A malicious transaction target could leverage the callback to submit or confirm additional transactions.

**Fix Applied**:  
Added `nonReentrant` modifier to all state-mutating wallet functions in `Chamber.sol`:
- `submitTransaction`
- `confirmTransaction`
- `revokeConfirmation`
- `submitBatchTransactions`
- `confirmBatchTransactions`

Since `executeTransaction` already has `nonReentrant`, any reentrant call to these functions now reverts.

**Test**: `test/findings/Finding9_WalletReentrancy.t.sol` — verifies reentrant `submitTransaction` is blocked during execution.

---

## Finding 10: Unbounded Array Growth in Registries [LOW] — FIXED

**Location**: `ValidationRegistry.sol`, `ReputationRegistry.sol`

**Description**:  
`_validations[agentId]` and `_signals[agentId]` arrays grow without bound. Functions iterating over them (`hasValidAttestation`, `getAverageScore`) become uncallable due to gas limits.

**Impact**:  
View functions and onchain consumers eventually fail with out-of-gas errors.

**Fix Applied**:

**ValidationRegistry**:
- Added `_latestValidExpiry` mapping for O(1) `hasValidAttestation()` lookups
- Added paginated `getValidations(agentId, offset, limit)` function
- Added `getValidationCount()` function
- `postValidation()` now updates the expiry mapping

**ReputationRegistry**:
- Added `_totalScore` and `_signalCount` running totals for O(1) `getAverageScore()` 
- Added paginated `getSignals(agentId, offset, limit)` function
- Added `getSignalCount()` function
- `postSignal()` now updates running totals

**Test**: `test/findings/Finding10_UnboundedArrayDoS.t.sol` — verifies O(1) gas usage and pagination functionality.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/Chamber.sol` | Added `_update()` override, `_decimalsOffset()`, `nonReentrant` on 5 functions |
| `src/Board.sol` | Added `_isInTopSeats()`, updated `_executeSeatsUpdate()` with supporter validation |
| `src/Agent.sol` | Removed dead code, added keeper access control (`authorizedKeepers`, `setKeeper`, `onlyAuthorized`) |
| `src/ValidationRegistry.sol` | Added O(1) expiry lookup, pagination, count function |
| `src/ReputationRegistry.sol` | Added O(1) average via running totals, pagination, count function |

---

## Verification

All 244 tests pass (0 failures, 0 skipped) including:
- 21 finding-specific PoC tests (`test/findings/`)
- 80 Chamber unit tests
- 36 Board unit tests
- 18 Wallet unit tests
- 16 Vault unit tests
- 11 Chamber upgrade tests
- 15 Registry tests
- 23 fuzz tests
- 4 ERC-8004 tests
- 1 E2E lifecycle test
- 2 security tests
