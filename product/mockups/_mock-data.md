# Shared mock data for product/mockups

Every mockup uses these values so the screens agree with each other. Addresses
marked *(illustrative)* are placeholders, not real deployments. Real addresses
are marked *(real)*.

## Dates ("today" in each mockup)
- App pages (M1 live): **Tue Mar 16, 2027, 14:20 UTC**
- Handoff preflight: **Tue Feb 16, 2027, 10:05 UTC** (before LORE moves to the gate)
- Phase 2 previews: **Tue Sep 21, 2027, 11:00 UTC** (after a GO at the Phase 2 gate)
- Gate dashboard: **Mon Apr 26, 2027** (gate review)

## Contracts
| Thing | Value |
|---|---|
| LORE token *(real)* | `0x7756D245527F5f8925A537be509BF54feb2FdC99`, maxSupply 100,000,000, totalSupply **10,070,000** (9.97M + 100,000 minted via gate op #2) |
| Explorers membership NFT *(real)* | `0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15`, mint 0.05 ETH, max 10,000 |
| Team Safe *(real)* | `0x5d45A213B2B6259F0b3c116a8907B56AB5E22095`, **4-of-7** after hardening |
| Loreum DAO Chamber (proxy) *(illustrative)* | `0x3F1c…A92e`, implementation **v1.2.0**, ProxyAdmin owned by the Chamber |
| Factory *(illustrative)* | `0x0Fa7…71C2`, owner: Team Safe via TimelockController (48h) |
| LoreMintGate *(illustrative)* | `0x6c1D…3F8b` |
| Loreum Guardian Safe *(illustrative)* | `0x9C44…E01d`, **3-of-5**, signers are not Team Safe signers, directors or large LORE holders |
| Vesting contract *(illustrative)* | `0x4dE2…9a07` |
| Grants Safe *(illustrative)* | `0x2c9F…d810` (3-of-5) |

## Chamber "Loreum DAO" (Ethereum mainnet)
- Asset LORE, share token **cLORE**. Vault totalAssets **7,712,450 LORE**. Delegation weight is in cLORE shares; the UI shows it as LORE at the current share price, with cLORE in a tooltip. cLORE has 21 decimals (LORE's 18 + `_decimalsOffset` 3), so 1 cLORE ≈ 1 LORE in display units (about 1,000 share base units per LORE base unit). Note: the live app's `BoardVisualization.tsx:482` formats shares with 18 decimals, so it shows weights 1,000× too large.
- Seats **5**, reachable directors **5**, quorum **3** (quorum = 1 + floor(n × 51 / 100)).
- `SEATING_DELAY` = 1 block. Seat-count changes: 7-day timelock (`SEAT_UPDATE_TIMELOCK`). Wallet tx max age 30 days.
- Treasury (non-vault): 2,410,000 USDC, 184.2 ETH.

### Board (rank, seat NFT, owner, delegated weight, seated since, session key)
1. Explorer **#7**, **aria.eth** (EOA `0x51a0…7C3e`), 2,410,000 LORE, seated Feb 2, 2027, no session key
2. Explorer **#12**, **kofi.eth** (Safe 2-of-3 `0x8b2d…11F0`), 1,905,000 LORE, seated Feb 2, 2027, session key `0xA11c…04e5` scope SUBMIT | REVOKE | CANCEL (0x31), expires Mar 28, 2027
3. Explorer **#31**, **Treasury Agent** (policy account, a Safe `0x9aB3…40d1`; ERC-8004 agent #212, display only), 1,120,000 LORE, seated Feb 5, 2027, session key `0x7E0f…19b2` scope SUBMIT | EXECUTE | REVOKE | CANCEL (0x35), expires Mar 30, 2027. Confirms only through its policy account.
4. Explorer **#44**, **lena.eth** (EOA `0x3c7B…aa15`), 980,000 LORE, seated Feb 9, 2027
5. Explorer **#58**, **marco.eth** (EOA `0xE2f0…6d3C`), 612,000 LORE, seated Feb 12, 2027
- Next in line (not seated): Explorer **#63**, **nadia.eth**, 540,000 LORE, needs 72,001 more to take seat 5.
- Seated weights total 7,027,000 LORE (7,567,000 with #63), within the vault's 7,712,450.
- Pending seat-count change **5 → 6**: proposed Mar 11, 2027 09:30 UTC by Explorer #12, supported by #12 and #7 (2 of 3 needed), 7-day timelock ends Mar 18 09:30. Executing it raises quorum to 4, and open proposals need max(submit quorum, live quorum), so #46–#48 would need 4 confirmations.
- lena.eth (Explorer #44 owner) holds 300,000 cLORE: 180,000 delegated to #44, 60,000 to #63, 60,000 undelegated.

### Session-key scope bits (from Chamber.sol)
SUBMIT = 1, CONFIRM = 2, EXECUTE = 4, UPDATE_SEATS = 8, REVOKE = 16, CANCEL = 32; UNSCOPED = type(uint32).max. Expiry is required. A newly set key can confirm/execute only after its live-at block (set delay). Keys are set by the NFT's current *contract* owner (EOA owners can't set keys); an NFT transfer clears the key.

### Transaction queue
- **#48** "Upgrade Chamber implementation to v1.2.1" (self-call `upgradeImplementation`, **high risk**), 1/3, deadline Mar 30, 2027
- **#47** "Execute LORE mint op #3 (250,000 LORE → Vesting)" (calls `LoreMintGate.execute(3)`), 2/3; simulation **reverts `NotReady`** until eta Mar 19, 2027 14:02 UTC
- **#46** "Fund Q2 grants round: transfer 120,000 USDC to Grants Safe", 3/3, **ready to execute**, simulation passes (treasury −120,000 USDC), deadline Apr 12, 2027
- **#45** executed Mar 9: "Co-sign the Treasury Agent Safe's `setDirectorOperator` for Explorer #31 (scope 0x35, expires Mar 30)". The Chamber can't set a key itself (only the NFT's contract owner can, and Chamber self-calls are limited to upgrade/pause/unpause), so the board approves the agent Safe's transaction with `approveHash` as one of its required signers.
- **#43** executed Mar 12: "Queue LORE mint op #3 via LoreMintGate"
- **#44** cancelled Mar 10 by cancel quorum: "Transfer 500,000 USDC to 0x9f3…" (unknown recipient)

## LoreMintGate (supply authority)
- `LORE.owner()` = LoreMintGate. Proposer = Loreum DAO Chamber. Guardian = Loreum Guardian Safe (can cancel, cannot mint).
- Delay **7 days** after queueing; execution window **14 days**; cap **1,000,000 LORE per quarter** (1% of maxSupply).
- Q1 2027 budget: executed 100,000 (op #2, Feb 26 → Grants Safe) + queued 250,000 (op #3) → remaining 650,000.
- Op #3: queued Mar 12, 2027 14:02 UTC by Chamber tx #43; eta Mar 19, 14:02 UTC; expires Apr 2, 14:02 UTC.
- Exits (TransferOwnership / Renounce / SetGuardian / SetProposer) need **dual control**: Chamber proposal + guardian approval + 30-day delay.

## Indexer
- Ethereum head **27,184,302**; indexed **27,184,300**; "Indexed 24 s ago". Lag states: warn at > 30 blocks ("Indexing 41 blocks behind · ~8 min"); down when the API is unreachable or the head stops moving ("Indexer stalled since 14:02 UTC · showing last known state").
- Display state always comes from the indexer. RPC is only used at transaction time (simulate / preflight, write, receipt), and the UI says so where it matters.

### Proposal timeline (as rendered on the queue and proposal pages)
- #46: submitted by kofi.eth's session key Mar 13 10:41 (1/3; a submit records the proposer's confirmation), Treasury Agent policy account confirmed Mar 13 15:20 (2/3, block 27,163,002), lena.eth confirmed Mar 14 09:30 (3/3).
- #47: submitted by marco.eth Mar 14 11:05, kofi.eth's Safe confirmed Mar 15 16:20 (2/3). Deadline set to the gate op's expiry, Apr 2.
- #48: submitted by aria.eth Mar 16 10:14 (1/3, block 27,183,075). The agent's mandate excludes upgrades.

## Explorers site
- Minted **1,247** of 10,000 (illustrative; on-chain supply was 70 in Sep 2026). Mint 0.05 ETH.

## Watcher alerts (feed)
- Mar 12 14:02 — Gate op #3 queued: mint 250,000 LORE → Vesting (eta Mar 19)
- Feb 26 09:40 — LORE totalSupply +100,000 (gate op #2 executed → Grants Safe)
- Mar 14 03:10 — Indexer lag > 30 blocks on Ethereum (resolved 03:22)
- Mar 9 16:55 — Session key set for Explorer #31 (scope 0x35)
- No change — Team Safe threshold 4-of-7; LORE owner = LoreMintGate

## Phase 2 preview data (Sep 21, 2027, after GO)
- Spokes funded through Across bridge templates: #52 Aug 3 (Base, 310,000 USDC), #55 Sep 7 (Arbitrum, 95,000 USDC; more than 30 clean days after Base, per P-27). Guardian drill #58 queued Sep 9, cancelled Sep 10.
- Base spoke: bridge receiver `0xB5e1…0c33` → Zodiac Delay (72h, 7-day expiration, guardian cancel) → Roles v2 (6 allowlisted target/selector pairs, 250,000 USDC / week allowance) → Safe `0xBa5e…77a1`. Balances: 310,000 USDC, 42.0 ETH.
- Arbitrum spoke: same pattern, Safe `0xA7b1…2e90`, 95,000 USDC.
- Verification: native OP Stack messenger (Base) / Arbitrum retryable tickets with address aliasing. The receiver accepts only messages whose L1 sender is the Loreum DAO Chamber.
- Cross-chain proposal **#61** "On Base: transfer 50,000 USDC to Base Grants Safe `0xB6a2…1f04`". Proposed Sep 17 → approved Sep 18 09:12 → sent Sep 18 09:14 (L1 tx) → delivered on Base Sep 18 09:16 → queued, eta Sep 21 09:16 (72h) → executes after eta.
- Bridge template: "Move 100,000 USDC Ethereum → Base spoke via Across `SpokePool` deposit", min received 99,900 USDC, fill deadline 2 h, exact-amount approve + revoke in the same batch.

## Phase 2 gate evidence (Apr 26, 2027)
- External orgs on mainnet: 4; meeting all criteria: 3 (≥3 independent directors, ≥1 real proposal/week for 8 weeks).
- Buyer interviews logged: 12; with assets or admin roles on ≥2 chains: 7; asked for multichain unprompted: 5.
- Audit: closed, 0 open critical/high. Bug bounty: live since Jan 29, 2027.
