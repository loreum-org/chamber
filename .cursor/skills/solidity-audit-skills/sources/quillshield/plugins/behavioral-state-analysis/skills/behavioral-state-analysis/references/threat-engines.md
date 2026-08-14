# Threat Engine Deep-Dive Reference

> **Optional reference.** Only read this file when performing a deep audit that needs granular engine checklists beyond what SKILL.md provides. Do NOT load this for standard audits.

## Economic Threat Engine (ETE) — Detailed Checklists

### Value Flow Tracing
- Map all entry/exit points: deposit, stake, withdraw, claim, liquidate, emergencyDrain
- Identify: value sinks (trapped funds), unexpected sources (minting), circular flows (flash loan amplification)

### Economic Invariant Verification
- Core: `sum(deposits) == sum(withdrawals) + contractBalance`
- Test under: normal ops, extreme values (uint256 edge), concurrent txs, oracle manipulation, flash loans

### Incentive Analysis
- For each public function: `if Benefit > Cost → exploit vector`
- Check: MEV opportunities, sandwich vectors, front-running, griefing (harm others at low cost)

## Access Control Threat Engine (ACTE) — Detailed Checklists

### Role Hierarchy
- Map complete role graph: Owner → Admin → Pauser/FeeManager; Governance → Executor; Guardian
- Per function: which roles can call, is check correct, is role assignment/revocation controlled

### Permission Boundary Testing
- Build matrix: Function × Role → Expected vs Actual access
- Flag any discrepancy between expected and actual permissions

### Privilege Escalation
- Test: user self-granting admin, admin bypassing timelock, msg.sender/tx.origin confusion
- Test: signature replay for unauthorized access, re-initialization to reset roles

## State Integrity Threat Engine (SITE) — Detailed Checklists

### State Transition Validation
- Per state-modifying function: are ALL variables updated atomically?
- Check for partial updates (e.g., balance decremented but pendingWithdrawals not updated)

### Sequence Vulnerabilities
- Test unexpected orderings: deposit before init, withdraw before deposit, action after pause
- Test re-initialization attacks: `initialize()` callable more than once

### Cross-Contract State Sync
- When A depends on B: test stale data, B paused, B returns 0, B reverts, B upgraded maliciously
- Verify all edge cases handled in caller's logic
