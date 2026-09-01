---
title: Session key for contract-owned membership NFTs
date: 2026-09-01
summary: Contract-owned membership NFTs can register a session-key operator. Queue and ChamberDetail show owner vs operator.
---

1 September 2026. Session key for contract-owned membership NFTs.

- If a membership NFT is owned by a contract wallet, the owner can set a session key. That key can submit, confirm, execute, and change the board the same way the owner can.
- Transfer clears the session. EOA-owned NFTs do not get this path. Chamber does not call ERC-1271.
- Queue and ChamberDetail show NFT owner vs operator.
