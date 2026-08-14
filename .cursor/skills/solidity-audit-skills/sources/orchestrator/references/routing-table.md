# Routing Table

Maps profile signals to skills across all four collections. Apply every row
whose trigger fires; a skill may be pulled in by several rows and is loaded once.

**When a trigger is ambiguous, treat it as firing.** A skill that finds nothing
costs one agent. A skill left unloaded costs a finding.

Source tags: **[P]** pashov · **[L]** plamen · **[Q]** quillshield · **[O]** omega.

---

## 1. Always on — every EVM audit

These load regardless of what the profile says.

| Skill | Orchestrator |
|---|---|
| All 12 attacker agents in `sources/pashov/solidity-auditor/references/hacking-agents/` | pashov |
| All 11 omega lenses (`sources/omega/omega-*`) across 5 independent passes | omega |
| **[Q]** `semantic-guard-analysis` — guards other functions consistently apply | quillshield |
| **[Q]** `state-invariant-detection` — inferred invariants and their violators | quillshield |
| **[Q]** `behavioral-state-analysis` — contract-type scoping and threat selection | quillshield |
| **[L]** `agents/depth-edge-case.md` — the `{0, 1, max, boundary±1, empty}` sweep | plamen |
| **[L]** `agents/depth-state-trace.md` — cross-function state mutation tracing | plamen |
| **[L]** `agents/skills/evm/verification-protocol` | plamen |

**Pre-audit, run first at Tier 0:** **[P]** `sources/pashov/x-ray/SKILL.md`
produces the architecture, entry-point map and candidate invariants that every
later bundle benefits from. **[L]** `sources/plamen/skills/audit-prep/` scores
readiness and feeds the General section.

## 2. Platform — pick exactly one language pack

| Profile platform | Load |
|---|---|
| EVM / Solidity | **[L]** `agents/skills/evm/*` (18 skills) |
| Solana / Anchor | **[L]** `agents/skills/solana/*` |
| Sui / Move | **[L]** `agents/skills/sui/*` |
| Aptos / Move | **[L]** `agents/skills/aptos/*` |
| Soroban / Rust | **[L]** `agents/skills/soroban/*` |
| DAML | **[L]** `agents/skills/daml/*` |
| L1 node client (Go/Rust) | **[L]** `agents/skills/injectable/l1/*` + `agents/depth-consensus-invariant.md` + `agents/depth-network-surface.md` |

**Non-EVM note.** pashov and quillshield are EVM-specific — load them only for
EVM targets. The omega lenses are language-agnostic (they ask structural
questions, not Solidity questions) and should run on any platform.

## 3. Feature triggers

Each row: the evidence, then everything it pulls in.

### Upgradeability
**Fires on:** `delegatecall`, `ERC1967`, `UUPSUpgradeable`, `Initializable`,
`__gap`, `_authorizeUpgrade`, a proxy in the deploy scripts, or scope being a
diff between two commits.

**[Q]** `proxy-upgrade-safety` · **[O]** `omega-upgrade-diff-review` ·
**[L]** `evm/storage-layout-safety` · **[L]** `evm/migration-analysis`

### Price feeds and oracles
**Fires on:** `latestRoundData`, `AggregatorV3Interface`, `observe(`,
`consult(`, `getPtTo`, `slot0`, TWAP, any price API client.

**[Q]** `oracle-flashloan-analysis` · **[O]** `omega-external-data-trust` ·
**[L]** `evm/oracle-analysis` · **[L]** `evm/external-precondition-audit` ·
**[P]** `economic-security-agent`

### Signatures and meta-transactions
**Fires on:** `ecrecover`, `ECDSA`, `_TYPEHASH`, `DOMAIN_SEPARATOR`, `permit`,
`isValidSignature`, `nonces`, a relayer or forwarder.

**[Q]** `signature-replay-analysis` · **[L]** `niche/signature-verification-audit`
· **[O]** `omega-standard-conformance` · **[O]** `omega-ordering-and-approval-races`

### Vaults, shares, receipt tokens
**Fires on:** `ERC4626`, `convertToShares`, `previewDeposit`, `totalAssets`,
`sharesOf`, `pricePerShare`.

**[O]** `omega-share-and-index-accounting` · **[Q]** `input-arithmetic-safety` ·
**[L]** `injectable/vault-accounting` · **[L]** `evm/share-allocation-fairness` ·
**[L]** `evm/zero-state-return` · **[L]** `evm/staking-receipt-tokens`

### Rebasing / index / multiplier accounting
**Fires on:** `multiplier`, `interestIndex`, `rebase`, `balanceAtIndex`,
`getSharesBy`, a `balanceOf` computed rather than stored.

**[O]** `omega-share-and-index-accounting` (primary) ·
**[O]** `omega-accounting-consistency` · **[Q]** `input-arithmetic-safety` ·
**[L]** `niche/dimensional-analysis`

### Permissioned / compliance-gated tokens
**Fires on:** `blacklist`, `whitelist`, `sanctions`, `isAllowed`, `kyc`,
`_beforeTokenTransfer` with a list lookup, a transfer hook.

**[O]** `omega-transfer-restriction-hooks` (primary) ·
**[O]** `omega-enforceability-check` · **[Q]** `semantic-guard-analysis`

### Epochs, checkpoints, voting power, vesting
**Fires on:** `epoch`, `checkpoint`, `getPastVotes`, `balanceOfAt`, `delegate`,
`snapshot`, `vestingSchedule`, `lastTimeRewardApplicable`.

**[O]** `omega-time-indexed-state` (primary) ·
**[L]** `evm/temporal-parameter-staleness` · **[L]** `injectable/governance-attack-vectors`
· **[P]** `invariant-agent`

### External calls and token integration
**Fires on:** `.call{value:`, `safeTransfer`, arbitrary ERC-20 addresses,
integration with any third-party protocol.

**[Q]** `external-call-safety` · **[Q]** `reentrancy-pattern-analysis` ·
**[P]** `boundary-agent` · **[L]** `niche/callback-receiver-safety` ·
**[L]** `evm/external-precondition-audit` · **[O]** `omega-standard-conformance`

### Flash loans
**Fires on:** `flashLoan`, `executeOperation`, `onFlashLoan`, `receiveFlashLoan`.

**[L]** `evm/flash-loan-interaction` · **[Q]** `oracle-flashloan-analysis` ·
**[O]** `omega-ordering-and-approval-races` · **[P]** `economic-security-agent`

### Cross-chain and bridges
**Fires on:** `CCIP`, `LayerZero`, `Hyperlane`, `messageId`, `srcChainId`,
`executeSignatures`, a message relayer.

**[L]** `evm/cross-chain-message-integrity` · **[L]** `evm/cross-chain-timing` ·
**[L]** `injectable/cross-vm-serialization-conformance` ·
**[O]** `omega-ordering-and-approval-races` · **[O]** `omega-external-data-trust`
· **[Q]** `signature-replay-analysis`

### Queues, batches, loops over user data
**Fires on:** iteration over an array of users/tokens/strategies, a request
queue, batch settlement, pull-payment accounting.

**[Q]** `dos-griefing-analysis` · **[O]** `omega-asset-exit-paths` ·
**[L]** `niche/multi-step-operation-safety` · **[P]** `asymmetry-agent`

### Protocol archetypes
| Archetype | Fires on | Load |
|---|---|---|
| Lending | `borrow`, `repay`, `liquidate`, `healthFactor`, `collateralFactor` | **[L]** `injectable/lending-protocol-security` |
| DEX / AMM | `swap`, `getAmountOut`, `sqrtPriceX96`, `addLiquidity` | **[L]** `injectable/dex-integration-security`, **[L]** `niche/stableswap-compliance` |
| NFT | `ERC721`, `ERC1155`, `onERC721Received`, `tokenURI` | **[L]** `injectable/nft-protocol-security`, **[O]** `omega-standard-conformance` |
| Governance | `propose`, `castVote`, `quorum`, `timelock` | **[L]** `injectable/governance-attack-vectors`, **[O]** `omega-time-indexed-state` |
| Account abstraction | `UserOperation`, `EntryPoint`, `validateUserOp` | **[L]** `injectable/account-abstraction-security` |
| Staking / rewards | `stake`, `rewardPerToken`, `earned`, `accRewardPerShare` | **[O]** `omega-time-indexed-state`, **[O]** `omega-accounting-consistency`, **[L]** `evm/staking-receipt-tokens` |

### Off-chain surface in the repo
**Fires on:** any `.py` / `.ts` / `.go` backend, keeper bot, API client, agent
runner, or deployment automation in scope.

**[O]** `omega-external-data-trust` §7 (auth binding, key scope, fail-open error
defaults, determinism, dependency pinning) · **[Q]** `defender` if CI/CD or
deployment config is in scope · **[L]** `agents/depth-external.md`

### Economic mechanism
**Fires on:** bonding curve, auction, premium or discount, fee schedule, reward
emission curve, incentive for a caller.

**[P]** `economic-security-agent` · **[L]** `evm/economic-design-audit` ·
**[O]** `omega-accounting-consistency` §7 (directional bias)

## 4. Always on — repo level

Regardless of platform or features:

**[O]** `omega-repo-hygiene-sweep` — dependency pinning and advisories,
licensing and copyright, coverage and CI, warnings, dead code, docs drift.
Run during the build at Tier 0; its output populates the report's General
section.

## 5. Scope modifier — diff audits

If scope is a commit range rather than a full codebase, add **[O]**
`omega-upgrade-diff-review` and **[L]** `evm/fork-ancestry` regardless of other
triggers, and instruct every tier-1 orchestrator that scope is the diff — while
noting that the *surrounding* code is still context they must read.

---

## Recording the decision

Print the manifest before dispatch:

```
PLATFORM: <evm|solana|sui|aptos|soroban|daml|l1>   SCOPE: <full|diff a..b>
TRIGGERS FIRED: upgradeability, oracles, vaults, queues, off-chain
TRIGGERS NOT FIRED: flash loans, cross-chain, NFT, account abstraction, governance

pashov       12 attacker agents
omega        11 lenses x 5 passes (+1 regression)
quillshield  7 plugins: proxy-upgrade, oracle-flashloan, input-arithmetic,
             external-call, reentrancy, dos-griefing, semantic-guard,
             state-invariant, behavioral-state
plamen       evm pack (18) + vault-accounting, lending-protocol-security,
             depth-edge-case, depth-state-trace, depth-external

TOTAL: ~38 leaf agents across 4 methodologies
SKIPPED: solana/sui/aptos/soroban/daml packs (platform), l1 pack (platform),
         nft-protocol-security (no trigger), account-abstraction (no trigger)
```

That block goes into the report as the coverage manifest. It is the only thing
that tells a reader what the audit actually looked at.
