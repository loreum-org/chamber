# Governance competitor deep analysis (mogkit)

Generated: research loop iteration 3 · `graphify` → `assumption-audit` → `discovery-query`
Corpus: **15 sources** · health: **developing** · nodes: **82**

---

## Executive summary

Deeper research confirms Chamber competes in a **crowded composable stack**, not
against Safe alone. The incumbent pattern is **Safe + Zodiac modules + governance
UI (Tally/Aragon) + optional offchain layer (Snapshot)**. New deep dives add
**Llama** (policy/state-machine governance), **Moloch Baal** (ragequit + Shamans),
**Hats Signer Gate** (dynamic Safe signers — **closest overlap to Chamber's dynamic
board**), and **Tally MultiGov/Relay** (multichain + gasless UX bar).

The **June 2026 Zodiac Roles/Delay vulnerability** is strategically significant:
third-party modules carry real risk, which could support Chamber's native-queue
story — but only if buyers believe it; most large DAOs still run module stacks.

**Iteration 3** adds a **layered stack model**: OpenZeppelin Governor is the
token-DAO governance contract baseline (timelock holds treasury); **Commonwealth**
consolidates forum + Snapshot + onchain voting UX; **Parcel** is Safe payroll/ops
with external governance. Chamber is deepest on native custody+authority, shallowest
on coordination and recurring treasury ops.

---

## Competitor deep profiles

### Safe + Zodiac (incumbent stack)

| Component | What it does | Chamber contrast |
|-----------|--------------|------------------|
| Safe | Multisig avatar, $100B+ TVS | Chamber is native contract, not Safe module |
| Zodiac Governor | Token gov controls Safe | Token-weighted, not NFT delegation board |
| Zodiac Roles | Scoped executors without per-tx sigs | Similar JTBD to agent auto-confirm |
| Zodiac Delay | Timelock on module actions | Chamber has confirm→execute queue |

**Security (June 2026):** Roles Modifier v2.1.0/2.1.1 and Delay v1.1.0 affected;
Safe core unaffected. Treasuries using affected modules must remove or remediate.

### Tally (governance UX leader)

- Production governance: proposals, delegation, security councils, optimistic gov
- **MultiGov:** hub-and-spoke multichain (Solana + EVM) via Wormhole
- **Relay:** gasless voting/delegation (OpenZeppelin Defender sponsorship)
- **Gap vs Chamber:** mature proposal layer, multichain, gasless — Chamber app gaps

### Llama (programmatic governance framework)

- `LlamaPolicy` + strategies/guards/accounts — action state machine with quorum
- Integrates Safe + Snapshot + Tally for vote→execution coupling
- Used by Uniswap, Aave (per analyst sources — not primary interviews)
- **vs Chamber:** policy-based access control without ERC4626 vault or NFT board

### Aragon OSx + Snapshot

- Aragon: modular staged governance, Safe as governing body, sub-DAO hierarchies
- Snapshot: dominant offchain voting; execution gap unless Snapshot X + Safe avatar
- **Chamber wedge:** native onchain execution — weakened by Tally auto-execute + Llama

### Hats Protocol + Signer Gate ⚠️ closest dynamic-board competitor

- ERC-1155 role trees; **Hats Signer Gate** adds/removes Safe signers when hats minted/revoked
- Zodiac module + guard on Safe
- **Constraint:** must not attach alongside other Safe modules (lock risk)
- **vs Chamber:** dynamic authority without vault shares or ERC4626 — different model, similar "who can sign" job

### Moloch v3 (Baal)

- Governance layer on Safe via Zodiac
- **Ragequit:** minority exit with proportional treasury share before execution
- **Shamans:** privileged roles outside standard proposals
- Transferable ERC-20 shares/loot (v3 change)
- **Chamber gap:** no documented ragequit / minority exit primitive

### Colony

- Reputation + lazy consensus; Safe Control Motions trigger Safe txs
- Merit-weighted not NFT delegation leaderboard

### Nouns + Flows.wtf

- NFT identity (1 Noun = 1 vote) but treasury/capital deployment evolved:
  direct proposals → Prop House → **Flows.wtf** continuous streaming (605 builders early 2026)
- Competes on **capital deployment velocity**, not custody model

### Karpatkey

- Non-custodial treasury management via Safe + Zodiac Roles
- Professional execution within Snapshot-approved policy presets
- **vs Chamber agents:** human expert committee vs software director

### Agent Bravo

- AI agents vote in **GovernorBravo** systems via policy prompts
- Discord integration, conservative default policies
- **vs Chamber:** token Governor delegate, not NFT director seat + transaction queue
- Low adoption (prior research: ~4 GitHub stars)

### ERC-8004 / onchain-agent-kit

- Identity, reputation, validation registries — **composable**, not governance products
- Aligns with Chamber ValidationRegistry; EIP disclaims capability guarantees

### OpenZeppelin Governor (iter 3 — token DAO baseline)

- Modular Governor + ERC20Votes + TimelockController; timelock holds treasury
- Lifecycle: propose → vote → **queue** → execute; calldata passed at queue/execute (offchain storage)
- Tally is the documented UI pairing; also Zodiac OZ Governor module controlling Safe avatar
- **vs Chamber:** token-weighted delegation, not NFT board; same queue/calldata UX pattern

### Parcel (iter 3 — treasury ops layer)

- Safe-based payroll, grants, mass payouts; spending limit module
- Governance external (Snapshot → Safe → Parcel execute)
- Often paired with Llama for high-value governance + Parcel for recurring ops
- **vs Chamber:** ops JTBD adjacent; no authority model; contributor payout gap for Chamber

### Commonwealth / Common (iter 3 — coordination UX)

- Unified forum + chat bridges + Snapshot bidirectional + onchain proposal UI
- 700+ DAOs cited (Frax FIP-89); targets fragmentation pain (Discourse/Telegram/Discord/Snapshot/onchain)
- **vs Chamber:** competes on app/coordination layer; custody stays on existing contracts

---

## Competitive feature matrix (expanded)

| Capability | Chamber | Safe+Zodiac | Tally | Llama | Hats HSG | Baal | Aragon | Snapshot |
|---|---|---|---|---|---|---|---|---|
| Native vault (ERC4626) | ✓ | ✗ | ✗ | ✗ | ✗ | partial | ✗ | ✗ |
| Dynamic leadership | NFT delegation board | Roles/HSG | token delegate | policies | hat→signer | shares | bodies | offchain |
| Native tx queue + hash | ✓ | partial | auto-exec | policies | Safe txs | proposals | staged | ✗ |
| Ragequit / minority exit | ? | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Agent/AI governance | director seats | Roles | ✗ | ✗ | ✗ | Shamans | ✗ | ✗ |
| Multichain gov | per-chain registry | ✓ | MultiGov | multi-chain | multi-chain | multi-chain | multi-chain | ✗ |
| Module ecosystem | ✗ | ✓ | composes | composes | Zodiac only | Zodiac | composes | modules |
| Gasless voting | ✗ | ✗ | Relay | ✗ | ✗ | ✗ | ✗ | ✓ (offchain) |

---

## Strategic implications for Chamber

1. **Hats Signer Gate is the sharpest competitive threat to "dynamic board" positioning** — validate with buyers immediately.
2. **Tally + Llama set UX/ops bars** for proposals, gasless participation, and vote→execution coupling.
3. **Zodiac incident** is a messaging opportunity for native governance — needs security review backing, not marketing alone.
4. **Baal ragequit** may matter for contentious communities — product gap to assess.
5. **Flows/Nouns** matter for grant-heavy DAOs, not core treasury custody segment.
6. **OZ Governor + Tally** is the default path for token protocol DAOs — Chamber must clarify segment (NFT/community vs token DAO).
7. **Commonwealth** sets coordination UX expectations — build vs partner decision needed.
8. **Parcel** highlights treasury ops gap (payroll/recurring) if targeting operating DAOs.

---

## Governance stack layers (iter 3)

| Layer | Examples | Chamber |
|-------|----------|---------|
| Coordination UX | Commonwealth, Tally, Aragon app | App (queue-focused) |
| Governance rules | OZ Governor, Llama, Baal, Chamber | Native contracts |
| Treasury ops | Parcel, Karpatkey | None documented |
| Custody | Safe | Native vault |

---

## Recommended next research (iteration 4)

- **Buyer interviews** — stack walkthrough at each layer
- HSG displacement validation
- Zodiac security buyer impact
- Chamber segment thesis: community/NFT treasury vs token protocol DAO

---

## Mogkit artifacts

| Artifact | Path |
|----------|------|
| Graph | `graph/graph.json` |
| Assumption audit | `knowledge/assumption-audit/2026-05-26-iter-3.md` |
| Discovery query | `knowledge/discovery-query/2026-05-26-governance-stack-layers.md` |
| Loop journal | `knowledge/research-loop/iter-003.md` |
