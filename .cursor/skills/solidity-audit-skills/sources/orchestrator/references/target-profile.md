# Target Profile

Everything Tier 0 produces before dispatching. Runs unattended — every field has
a decidable default, and no step blocks on a question.

## 1. Acquire

Given a URL: `git clone`, then `git submodule update --init --recursive --depth 1`.
Given a path: use it in place.

Record the **full 40-character commit hash**. For a diff scope, record both.

If the request names a PR or a commit range, scope is the **diff**; otherwise
the full codebase. If a prior audit report is present in the repo (a `docs/` or
`audits/` directory, or a link in the README), that is a repeat engagement —
capture it for `history.md` and route the regression pass.

## 2. Platform detection

First match wins:

| Evidence | Platform |
|---|---|
| `*.sol`, `foundry.toml`, `hardhat.config.*` | EVM |
| `Anchor.toml`, `declare_id!`, `solana-program` | Solana |
| `Move.toml` + `sui::` imports | Sui |
| `Move.toml` + `aptos_framework::` | Aptos |
| `soroban-sdk` in `Cargo.toml` | Soroban |
| `*.daml`, `daml.yaml` | DAML |
| Go/Rust with consensus, p2p or mempool packages | L1 client |

Mixed repos are common — a Solidity core with a Python keeper. Record **every**
platform present; the primary drives the language pack, the others drive the
off-chain trigger.

## 3. Size and scope

```bash
find src contracts -name '*.sol' -not -path '*/test/*' -not -path '*/lib/*'
# normalized LOC — excluding blanks and comments — is the honest size signal
```

Exclude `test/`, `mocks/`, `interfaces/`, `lib/`, `node_modules/` from the audit
scope but keep them readable: agents need them for context and for writing
proofs of concept. Record the exclusion.

## 4. Build and run

Not optional, and it comes before any reading. It produces findings directly and
it is what gives Tier 2 a working harness for proofs of concept.

1. **Compile.** Capture every warning in `src/`. A repo that does not compile in
   its documented configuration is itself a finding.
2. **Run the test suite.** Capture failures and skips. Note which tests skipped
   and why — fork tests that self-skip for a missing RPC mean that whole surface
   is unverified, and the report must say so.
3. **Coverage.** Name the uncovered paths that matter; do not quote a percentage.
4. **Static analysis.** Run it, then triage. Only survivors reach the report,
   folded into the relevant per-file section. Never paste raw output.
5. **Dependency advisories.** `npm audit`, `cargo audit`, or equivalent.

If the build fails, **do not stop**. Record it as a high-signal finding, note
that PoC-writing is unavailable, and continue — static review still works.

## 5. Feature signals

Grep for the evidence the routing table keys on. Record hit counts and example
locations, not just booleans — "12 sites" routes differently from "1 site".

```bash
# upgradeability
rg -l 'delegatecall|ERC1967|UUPSUpgradeable|__gap|_authorizeUpgrade'
# oracles
rg -l 'latestRoundData|AggregatorV3|observe\(|slot0|consult\('
# signatures
rg -l 'ecrecover|ECDSA|_TYPEHASH|DOMAIN_SEPARATOR|permit\('
# shares / vaults / rebasing
rg -l 'ERC4626|convertToShares|totalAssets|sharesOf|multiplier|rebase|interestIndex'
# permissioned transfer
rg -l 'blacklist|whitelist|sanction|_beforeTokenTransfer|_update\('
# time-indexed state
rg -l 'epoch|checkpoint|getPastVotes|balanceOfAt|delegate\(|snapshot'
# external calls / reentrancy surface
rg -l '\.call\{value|safeTransfer|nonReentrant'
# flash loans
rg -l 'flashLoan|executeOperation|onFlashLoan'
# cross-chain
rg -l 'CCIP|LayerZero|Hyperlane|messageId|srcChainId'
# archetypes
rg -l 'liquidate|healthFactor'            # lending
rg -l 'sqrtPriceX96|getAmountOut'         # dex
rg -l 'onERC721Received|tokenURI'         # nft
rg -l 'castVote|quorum|propose\('         # governance
rg -l 'UserOperation|validateUserOp'      # account abstraction
rg -l 'rewardPerToken|accRewardPerShare'  # staking
# loops over user data
rg -n 'for \(uint' | head -50
```

Also record: number of externally reachable functions, presence of `receive`/
`fallback`, and every callback the contracts expose — flash-loan callbacks,
token receiver hooks and cross-chain receivers are public entry points and
several routing rows depend on knowing they exist.

## 6. Integrated protocols

List every third-party protocol the code touches — from imports, interfaces and
hardcoded addresses. For each, **fetch its integration documentation** into
`context.md`.

This is the highest-yield input that pure code review cannot produce. Rate
functions correct for one class of underlying and wrong for another, TWAP windows
shorter than the integrated protocol recommends, and market configurations
assumed rather than verified are all invisible from the source alone.

## 7. Off-chain surface

Any backend, keeper, bot, API client or deployment automation in the repo. Record
language, entry points, and whether it holds credentials or signs transactions.
This fires the off-chain routing row and materially changes severity — an auth
defect in a keeper that signs transactions is not a low.

---

## Output

`{bundle}/profile.md`, structured so downstream agents can read it mechanically:

```
TARGET      <url or path>
COMMIT      <full sha>            [BASE <sha> for diff scope]
SCOPE       full | diff
PLATFORM    <primary>             OTHER: <...>
SIZE        <n> files, <n> normalized LOC
BUILD       compiles: yes/no | warnings: n | tests: n pass / n fail / n skip
            coverage gaps: <named paths>
            static analysis: <n> triaged survivors
SIGNALS     upgradeability(12) oracles(3) vaults(8) permissioned(0) ...
CALLBACKS   <every externally reachable callback>
INTEGRATES  <protocol> -> <docs fetched y/n>
OFFCHAIN    <language, entry points, signs-transactions y/n>
PRIOR       <prior report(s), or none>
EXCLUDED    <paths, with reason>
```

Anything undeterminable gets recorded as `unknown` with a one-line reason and
routed as if it fired. Never block on it.
