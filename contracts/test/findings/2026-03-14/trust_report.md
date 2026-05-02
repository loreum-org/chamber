# Trust Report — Chamber Protocol v1.1.3

**Date**: 2026-03-14
**Agent**: A8 — Permissions and Trust Risk

---

## Role Capabilities

### DIRECTOR (Board Member)

| Capability | Function | Blast Radius |
|------------|----------|-------------|
| Submit arbitrary transactions | `submitTransaction` | Any ETH value up to chamber balance; any target |
| Confirm transactions | `confirmTransaction` | Advances confirmation count toward quorum |
| Execute confirmed transactions | `executeTransaction` | Arbitrary external call (ETH + calldata) |
| Propose seat changes | `updateSeats` | Can also cancel existing proposals (griefing) |
| Execute seat changes | `executeSeatsUpdate` | Changes quorum for future votes |
| Trigger upgrade | via `executeTransaction → upgradeImplementation` | Full contract replacement |

**Quorum requirement**: `1 + (seats * 51) / 100` directors must confirm before execution.

**Who controls this role**: Holders of the top-`seats` NFT tokenIds by delegated chamber share amount. Purely economic — anyone with enough shares can reach directorship.

---

### AGENT_OWNER

| Capability | Function | Blast Radius |
|------------|----------|-------------|
| Set governance policy | `setPolicy` | Changes what transactions auto-confirm |
| Manage keepers | `setKeeper` | Grants/revokes autoConfirm permission |
| Arbitrary external calls | `execute` | Any contract, any calldata — **bypasses policy** |
| Upgrade Agent proxy | via ProxyAdmin | Full Agent replacement |

**Key risk**: `execute()` gives the owner full escape hatch. Policy is advisory, not enforced.

---

### REGISTRY_ADMIN (Registry)

| Capability | Function | Blast Radius |
|------------|----------|-------------|
| Grant/revoke roles | AccessControl | Can add new admins |
| Implementation is stored but not changeable post-deploy | n/a | Future Chambers use stored implementation |

**Note**: The Registry admin cannot affect existing Chamber proxies — they have independent ProxyAdmins.

---

## Centralization Assessment

| Component | Centralization Level | Notes |
|-----------|---------------------|-------|
| Chamber governance | PLUTOCRATIC | Directors = top stake-weighted NFT holders. Single whale can dominate. |
| Chamber upgrade | GOVERNANCE-GATED | Requires quorum + self-call. More decentralized than typical admin-key. |
| Agent control | OWNER-CENTRALIZED | Single owner key; no governance gate on execute(). |
| Registry | ADMIN-CENTRALIZED | Admin key controls implementation reference. |
| ValidationRegistry | ADMIN-CENTRALIZED | VALIDATOR_ROLE controlled by admin. |
| ReputationRegistry | ADMIN-CENTRALIZED | REPUTATION_MANAGER_ROLE controlled by admin. |

---

## "Who Can Rug?" Summary

| Attack | Who | How | Prevented? |
|--------|-----|-----|-----------|
| Drain ETH from Chamber | Board (quorum) | submitTransaction → target = attacker, value = balance | Only if quorum agrees |
| Drain assets from Chamber | Board (quorum) | executeTransaction → transfer ERC-20 from vault | Only if quorum agrees |
| Upgrade Chamber to malicious impl | Board (quorum) | executeTransaction → upgradeImplementation(malicious, "") | Only if quorum agrees |
| Lock user shares permanently | Market participant | Evict user's delegated node (Finding 11) | NOT PREVENTED |
| Bypass Agent policy | Agent owner | execute() directly | NOT PREVENTED (by design) |
| Cancel seat proposals | Any single director | updateSeats(different number) | NOT PREVENTED |
