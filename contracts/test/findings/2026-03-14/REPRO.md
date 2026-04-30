# Reproduction Guide — Chamber Protocol v1.1.3

**Date**: 2026-03-14

---

## Setup

```bash
cd /path/to/chamber
forge install
forge build
```

All reproduction tests are in `test/findings/2026-03-14/`.

---

## Finding 11: Permanent Delegation Lock on Evicted Board Nodes

**File**: `test/findings/2026-03-14/Finding11_EvictedNodeDelegationLock.t.sol`

```bash
forge test --match-contract EvictedNodeDelegationLockTest -vvv
```

**Expected output (vulnerability confirmed)**:
- `test_Vuln_DelegationLockedAfterEviction` — PASSES (demonstrates the lock occurs)
- `test_Vuln_UserCannotWithdrawAfterEviction` — PASSES (demonstrates withdrawal blocked)

**After applying fix** (`Chamber.undelegate()` updated):
- Both tests should FAIL (vulnerability no longer exploitable)
- Add `test_Fixed_UndelegateFromEvictedNode` — should PASS

---

## Finding 12: Agent execute() Bypasses Policy

**File**: `test/findings/2026-03-14/Finding12_AgentExecutePolicyBypass.t.sol`

```bash
forge test --match-contract AgentExecutePolicyBypassTest -vvv
```

**Expected output (vulnerability confirmed)**:
- `test_Vuln_ExecuteBypässesPolicy` — PASSES (demonstrates policy bypass)
- `test_Fixed_AutoConfirmEnforcesPolicy` — PASSES (autoConfirm correctly enforces policy)

---

## Finding 13: Agent isValidSignature Hash Ignored

**File**: `test/findings/2026-03-14/Finding13_AgentEIP1271HashIgnored.t.sol`

```bash
forge test --match-contract AgentEIP1271HashIgnoredTest -vvv
```

**Expected output**:
- `test_Vuln_AnyHashAcceptedWith32ByteSignature` — PASSES (any hash validates)
- `test_Fixed_ECDSAPathRequiresCorrectHash` — PASSES (ECDSA path correct)

---

## Finding 14: Seat Proposal Griefing

**File**: `test/findings/2026-03-14/Finding14_SeatProposalGriefing.t.sol`

```bash
forge test --match-contract SeatProposalGriefingTest -vvv
```

**Expected output**:
- `test_Vuln_SingleDirectorCancelsProposal` — PASSES (demonstrates griefing)

---

## Full Suite

```bash
forge test --match-path "test/findings/2026-03-14/*" -vvv
```
