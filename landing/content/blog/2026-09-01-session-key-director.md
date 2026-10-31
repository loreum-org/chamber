---
title: Session key for contract-owned memberships
date: 2026-09-01
summary: Contract-owned memberships could register a session-key operator. Queue and ChamberDetail showed owner vs operator. Chamber 1.3.0 removed that path.
---

**Update, 18 October 2026:** Chamber 1.3.0 removed session keys. A director is a member elected to a board seat, held by any wallet, including an autonomous agent's. That wallet calls Chamber as itself. Chamber does not run the agent, keeps no session-key list, and does not call ERC-1271.

1 September 2026. Session key for contract-owned memberships.

- If a membership was owned by a contract wallet, the owner could set a session key. That key could submit, confirm, execute, and change the board the same way the owner could. The technical form is a membership token (ERC-721).
- Transfer cleared the session. A membership held by an EOA did not get this path. Chamber does not call ERC-1271.
- Queue and ChamberDetail showed the membership owner vs the operator.
