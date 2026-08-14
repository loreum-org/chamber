# By Bug Class

Find the skill you need for a specific vulnerability class. Coverage
symbols: ●  primary · ◐  partial · ○  none.

Each row points to the actual file under `sources/` so you can drop it into
the agent with `@`.

---

## Access control

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/access-control-agent.md` | ●  Attacker-mindset methodology for permission models. Map every role, find inconsistent guards, hijack initialization, escalate privileges. |
| **[L]** | `sources/plamen/agents/skills/soroban/auth-validation/SKILL.md` | ●  Soroban-specific auth verification. |
| **[L]** | `sources/plamen/agents/skills/<lang>/semi-trusted-roles/SKILL.md` | ●  Per-language treatment of semi-trusted roles. |
| **[Q]** | `sources/quillshield/plugins/semantic-guard-analysis/skills/semantic-guard-analysis/SKILL.md` | ●  Detect inconsistent modifiers automatically via the "Consistency Principle". |
| **[O]** | `sources/omega/omega-enforceability-check/SKILL.md` | ●  Guards that exist but bind nobody: the constrained party controls the constraint, a second address defeats it, the validator's result is discarded, the flag has no reader. |
| **[O]** | `sources/omega/omega-transfer-restriction-hooks/SKILL.md` | ●  Permissioned-token gating: which parties a whitelist/blacklist/sanctions hook actually covers, sentinel addresses that disable mint and burn, restrictions that seize assets by blocking the exit, and round-trip bypasses. |

**Recommended combo:** [Q] for detection → [P] for attacker framing → [L] for
language-specific idioms.

---

## Arithmetic / precision / overflow

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/math-precision-agent.md` | ●  WAD/RAY/BPS scale mixing, wrong-direction rounding, division-before-multiplication amplification. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/numerical-gap-agent.md` | ●  Cross-lens seam: precision × invariant × boundary. |
| **[L]** | `sources/plamen/agents/skills/soroban/overflow-safety/SKILL.md` | ●  Soroban `i128` overflow. |
| **[L]** | `sources/plamen/agents/skills/sui/bit-shift-safety/SKILL.md` | ●  Sui Move bit-shift safety. |
| **[L]** | `sources/plamen/agents/skills/niche/dimensional-analysis/SKILL.md` | ●  Cross-language unit/scale mismatch. |
| **[Q]** | `sources/quillshield/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md` | ●  Precision loss, rounding, ERC4626 inflation, unsafe casting. |
| **[O]** | `sources/omega/omega-share-and-index-accounting/SKILL.md` | ●  Derived balances (`shares × multiplier`, `principal × index`): round-trip asymmetry across a lazily-updated scalar, mutating functions that forget the index basis, multipliers that reach an absorbing zero and wipe every balance at once. |

**Recommended combo:** [Q] for catalog → [P] `math-precision` for attacker
framing → [P] `numerical-gap` for seam bugs → [L] for language-specific
edge cases (Soroban i128, Sui bit-shift).

---

## Boundary / edge cases

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/boundary-agent.md` | ●  8 corner cases per external call site (no code, non-standard token, zero/max input, return-value handling, sentinel, false-returning ERC20, ERC165 dispatch, ERC721 hook re-entry). |
| **[L]** | `sources/plamen/agents/depth-edge-case.md` | ●  Mandatory "always-on boundary checklist" over `{0, 1, max, boundary-1, boundary, boundary+1, empty-container}`. |
| **[L]** | `sources/plamen/agents/skills/<lang>/zero-state-return/SKILL.md` | ●  Initial zero state + return-to-zero state. |
| **[Q]** | `sources/quillshield/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md` | ◐  ERC4626 inflation subset. |
| **[O]** | `sources/omega/omega-time-indexed-state/SKILL.md` | ●  Checkpoints, snapshots, epochs and delegation: append-vs-overwrite, historical reads that return a value true at no point in time, bounded history weaponized into permanent lockout, and discretized rewards that pay for capital the protocol does not hold. |

**Recommended combo:** [L] `depth-edge-case` for systematic enumeration →
[P] `boundary-agent` for per-call-site 8-corner-case checklist → [L]
`zero-state-return` for vault share inflation.

---

## Reentrancy

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/boundary-agent.md` | ◐  ERC721 hook re-entry is corner case #8. |
| **[L]** | `sources/plamen/agents/skills/aptos/reentrancy-analysis/SKILL.md` | ◐  Aptos Move-specific only. |
| **[Q]** | `sources/quillshield/plugins/reentrancy-pattern-analysis/skills/reentrancy-pattern-analysis/SKILL.md` | ●  All 4 variants (classic, cross-function, cross-contract, read-only) + ERC-777/ERC-1155 callback reentrancy. |

**Recommended combo:** [Q] is the primary source. [P] `boundary-agent` for
ERC721 hook specifics.

---

## Oracle manipulation / flash loans

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/economic-security-agent.md` | ◐  Flash-loan-attacker framing, "extract value atomically". |
| **[L]** | `sources/plamen/agents/skills/sui/oracle-analysis/SKILL.md` | ●  Sui oracle patterns. |
| **[L]** | `sources/plamen/agents/skills/<lang>/flash-loan-interaction/SKILL.md` | ●  Per-language flash-loan interaction. |
| **[Q]** | `sources/quillshield/plugins/oracle-flashloan-analysis/skills/oracle-flashloan-analysis/SKILL.md` | ●  Oracle trust-model taxonomy (Chainlink, TWAP, spot, Band, custom). 5 stale-price risks. |
| **[O]** | `sources/omega/omega-external-data-trust/SKILL.md` | ●  Integration failures with an *honest* oracle: staleness measured on the wrong timestamp, uncorrelated feeds, responses not checked against the constraints requested. |

**Recommended combo:** [Q] for oracle classification → [P]
`economic-security` for flash-loan attacker framing → [L]
`flash-loan-interaction` for language-specific patterns.

---

## Token integration / external calls

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/boundary-agent.md` | ●  Corner cases #2 (non-standard token), #5 (sentinel-placeholder), #6 (false-returning ERC20). |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/periphery-agent.md` | ●  Periphery contract bugs (libraries, encoders, helpers). |
| **[L]** | `sources/plamen/agents/depth-external.md` | ●  External call side effects, cross-chain timing, MEV vectors. |
| **[L]** | `sources/plamen/agents/skills/<lang>/external-precondition-audit/SKILL.md` | ●  Per-language external precondition audit. |
| **[Q]** | `sources/quillshield/plugins/external-call-safety/skills/external-call-safety/SKILL.md` | ●  Cataloged "weird ERC20" reference (fee-on-transfer, rebasing, USDT void return, ERC-777). |
| **[O]** | `sources/omega/omega-asset-exit-paths/SKILL.md` | ◐  One non-standard, paused or malicious token in a list blocking an entire batch claim or redemption. |
| **[O]** | `sources/omega/omega-standard-conformance/SKILL.md` | ●  The other direction — being a standard-compliant token rather than consuming one. Return-value vs revert semantics, receiver callbacks that revert against compliant recipients, `_mint` vs `_safeMint`, uninitialized domain separators in forked crypto. |

**Recommended combo:** [Q] for "weird ERC20" catalog → [L] `depth-external`
for MEV and cross-chain timing → [P] `boundary-agent` for per-call
corner cases.

---

## Signature / replay / EIP-712 / permit

| Source | File | Coverage |
|---|---|---|
| **[P]** | (incidental only — covered inside `first-principles-agent.md` and `boundary-agent.md`) | ◐ |
| **[L]** | `sources/plamen/agents/skills/niche/signature-verification-audit/SKILL.md` | ●  Cross-language signature replay, malleability, EIP-712, permit, nonce management. |
| **[Q]** | `sources/quillshield/plugins/signature-replay-analysis/skills/signature-replay-analysis/SKILL.md` | ●  5 replay types, ecrecover edge cases, ERC-1271 contract wallets, permit/permit2. |

**Recommended combo:** [Q] for catalog + prevalence stats → [L] for
language-agnostic methodology.

---

## Proxy / upgrade safety

| Source | File | Coverage |
|---|---|---|
| **[P]** | (incidental only — covered inside `access-control-agent.md`) | ◐ |
| **[L]** | `sources/plamen/agents/skills/soroban/contract-upgradeability/SKILL.md` | ●  Soroban `update_current_contract_wasm`. |
| **[L]** | `sources/plamen/agents/skills/sui/package-version-safety/SKILL.md` | ●  Sui package upgrades. |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/hardfork-activation-and-protocol-upgrade/SKILL.md` | ●  L1 hardfork activation. |
| **[Q]** | `sources/quillshield/plugins/proxy-upgrade-safety/skills/proxy-upgrade-safety/SKILL.md` | ●  Transparent / UUPS / Beacon / Diamond / Minimal proxy patterns. |
| **[O]** | `sources/omega/omega-upgrade-diff-review/SKILL.md` | ●  The engagement around an upgrade: storage-layout diffing, initializer/migration front-running, whether v2 still honours v1's promises to in-flight state. |

**Recommended combo:** [Q] for EVM proxy patterns → [L] for non-EVM
upgrade patterns.

---

## DoS / griefing

| Source | File | Coverage |
|---|---|---|
| **[P]** | (incidental only — `periphery-agent.md` "Brick via gas complexity") | ◐ |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/mempool-asymmetric-dos/SKILL.md` | ●  L1 mempool DoS (asymmetric cost). |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/p2p-dos-and-eclipse/SKILL.md` | ●  L1 p2p eclipse / single-packet-kill. |
| **[Q]** | `sources/quillshield/plugins/dos-griefing-analysis/skills/dos-griefing-analysis/SKILL.md` | ●  Smart-contract DoS (unbounded loop, 63/64 rule, storage bloat, self-destruct force-feeding). |
| **[O]** | `sources/omega/omega-asset-exit-paths/SKILL.md` | ●  The stuck-funds framing: ways-in/ways-out table per asset, exits checked in every reachable state, single-element-fails-the-batch, push-payment blockades. |

**Recommended combo:** [Q] for smart-contract-layer DoS → [L] for L1
node-client DoS.

---

## State invariants / conservation laws

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/invariant-agent.md` | ●  Attacker view: find the path that violates the invariant and extract value. |
| **[L]** | `sources/plamen/agents/depth-state-trace.md` | ●  Cross-function state mutation tracing, constraint enforcement verification. |
| **[L]** | `sources/plamen/agents/depth-consensus-invariant.md` | ●  L1 consensus invariants (Byzantine-scenario reasoning). |
| **[L]** | `sources/plamen/agents/skills/niche/semantic-gap-investigator/SKILL.md` | ●  SYNC_GAP / ACCUMULATION_EXPOSURE / CONDITIONAL / CLUSTER_GAP flags. |
| **[Q]** | `sources/quillshield/plugins/state-invariant-detection/skills/state-invariant-detection/SKILL.md` | ●  Explicit taxonomy: sum / conservation / ratio / monotonic / synchronization. |
| **[O]** | `sources/omega/omega-accounting-consistency/SKILL.md` | ●  Counters updated on some transitions but not all, `=` vs `+=`, double counting when the callee already aggregated, reversal paths that skip the total. |
| **[O]** | `sources/omega/omega-time-indexed-state/SKILL.md` | ●  Checkpoints, snapshots, epochs and delegation: append-vs-overwrite, historical reads that return a value true at no point in time, bounded history weaponized into permanent lockout, and discretized rewards that pay for capital the protocol does not hold. |

**Recommended combo:** [Q] for invariant taxonomy → [L]
`depth-state-trace` for systematic enforcement verification → [P]
`invariant-agent` for attacker framing.

---

## Token flow / first-depositor / share inflation

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/economic-security-agent.md` | ◐  Donation attack framing. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/math-precision-agent.md` | ◐  Zero-round-to-steal. |
| **[L]** | `sources/plamen/agents/depth-token-flow.md` | ●  Dedicated depth agent. Donation attack vectors + approval-collision analysis. |
| **[L]** | `sources/plamen/agents/skills/<lang>/zero-state-return/SKILL.md` | ●  Initial zero state + return-to-zero state residual assets. |
| **[L]** | `sources/plamen/agents/skills/<lang>/share-allocation-fairness/SKILL.md` | ●  Share allocation fairness. |
| **[Q]** | `sources/quillshield/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md` | ◐  ERC4626 inflation subset. |
| **[O]** | `sources/omega/omega-share-and-index-accounting/SKILL.md` | ●  Derived balances (`shares × multiplier`, `principal × index`): round-trip asymmetry across a lazily-updated scalar, mutating functions that forget the index basis, multipliers that reach an absorbing zero and wipe every balance at once. |

**Recommended combo:** [L] `depth-token-flow` is the most thorough →
[L] `zero-state-return` for vault-share inflation → [P]
`economic-security` for attacker framing.

---

## Economic / MEV / incentive

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/economic-security-agent.md` | ●  Unlimited-capital attacker, flash loans, ERC compliance breaking. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/trust-gap-agent.md` | ●  access × economics × asymmetry seam. |
| **[L]** | `sources/plamen/agents/skills/<lang>/economic-design-audit/SKILL.md` | ●  Per-language economic design. |
| **[L]** | `sources/plamen/agents/depth-external.md` §3 | ●  MEV vector analysis, multi-block arbitrage windows. |
| **[Q]** | `sources/quillshield/plugins/oracle-flashloan-analysis/skills/oracle-flashloan-analysis/SKILL.md` | ◐  Folded into oracle-flashloan. |
| **[O]** | `sources/omega/omega-ordering-and-approval-races/SKILL.md` | ●  Six recurring ordering shapes, including dilution into a buyout premium and arbitrage capture of a payout. |

**Recommended combo:** [P] `economic-security` for attacker framing → [P]
`trust-gap` for seam bugs → [L] `depth-external` §3 for cross-chain MEV.

---

## Semantic / logic consistency

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/asymmetry-agent.md` | ●  Asymmetry between paired functions, branches, writers/readers. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/first-principles-agent.md` | ●  Extract every assumption → violate it. |
| **[L]** | `sources/plamen/agents/skills/niche/semantic-consistency-audit/SKILL.md` | ●  Cross-contract config drift, formula semantic drift, magic-number consistency. |
| **[L]** | `sources/plamen/agents/skills/niche/spec-compliance-audit/SKILL.md` | ●  Doc-vs-code compliance. |
| **[L]** | `sources/plamen/agents/skills/niche/event-completeness/SKILL.md` | ●  Event emission coverage and parameter accuracy. |
| **[Q]** | `sources/quillshield/plugins/semantic-guard-analysis/skills/semantic-guard-analysis/SKILL.md` | ●  Detect functions that bypass the contract's own guards. |
| **[O]** | `sources/omega/omega-enforceability-check/SKILL.md` | ●  Complements guard-consistency detection: finds guards that are *present and inert* rather than missing. |

**Recommended combo:** [Q] for single-contract detection → [P] `asymmetry`
for paired-function bugs → [L] niche agents for cross-contract drift.

---

## Composability / cross-contract seams

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/flow-gap-agent.md` | ●  Seam hunter: execution × periphery × first-principles. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/shared-rules.md` | ●  Cross-contract pattern weaponization. |
| **[L]** | `sources/plamen/rules/phase4c-chain-prompt.md` | ●  Chain analysis phase prompt. |
| **[L]** | `sources/plamen/agents/skills/injectable/dex-integration-security/SKILL.md` | ●  DEX integration (when not the DEX itself). |
| **[L]** | `sources/plamen/agents/skills/injectable/lending-protocol-security/SKILL.md` | ●  Lending protocol integration. |
| **[L]** | `sources/plamen/agents/skills/injectable/vault-accounting/SKILL.md` | ●  Vault accounting. |
| **[L]** | `sources/plamen/agents/skills/injectable/nft-protocol-security/SKILL.md` | ●  NFT marketplace / collateral logic. |
| **[L]** | `sources/plamen/agents/skills/injectable/governance-attack-vectors/SKILL.md` | ●  Governor / Timelock / quorum / delegate attacks. |
| **[L]** | `sources/plamen/agents/skills/injectable/account-abstraction-security/SKILL.md` | ●  ERC-4337 / EntryPoint / UserOperation / Paymaster. |

**Recommended combo:** [L] injectables for the protocol type → [P]
`flow-gap-agent` for cross-lens seam bugs.

---

## Cross-chain / bridges

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/agents/depth-external.md` §2 | ●  Message latency, stale state, multi-block arbitrage. |
| **[L]** | `sources/plamen/agents/skills/<lang>/cross-chain-timing/SKILL.md` | ●  Per-language cross-chain timing. |
| **[L]** | `sources/plamen/agents/skills/injectable/cross-vm-serialization-conformance/SKILL.md` | ●  Outbound encoding conformance (EVM → non-EVM). |
| **[O]** | `sources/omega/omega-ordering-and-approval-races/SKILL.md` | ◐  Shape 3 — two entry points accepting the same authorization but delivering different effects, raced to choose the outcome. |

**Only plamen covers this.** For cross-chain audits, start with
`depth-external.md` and add the per-language `cross-chain-timing` skill.

---

## Pre-audit / readiness

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/x-ray/SKILL.md` | ●  Single `x-ray.md` report + invariants.md + entry-points.md + architecture.svg. |
| **[L]** | `sources/plamen/skills/audit-prep/SKILL.md` | ●  8-phase scored readiness table (coverage/quality/docs/hygiene/deps/practices/deploy/context). |
| **[O]** | `sources/omega/omega-repo-hygiene-sweep/SKILL.md` | ●  The G-series sweep: dependency pinning and advisories, licensing/copyright compliance, coverage and CI, warnings, dead code, docs drift. |

**Recommended combo:** use both — they produce complementary outputs.

---

## Fuzz / invariant harness generation

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/fizz/SKILL.md` | ●  Full Echidna + Medusa pipeline, 5 discovery agents, Synthesizer, 2 implementers, Foundry repro generation. |
| **[L]** | `sources/plamen/agents/skills/<lang>/verification-protocol/SKILL.md` | ◐  Single-PoC test templates (Foundry, LiteSVM). |

**Only pashov generates full fuzz suites.** Plamen's `verification-protocol`
is for single PoCs.

---

## Release gate / deployment safety

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/skills/audit-prep/SKILL.md` (Phase 7) | ◐  Deployment readiness subphase. |
| **[Q]** | `sources/quillshield/plugins/defender/skills/defender/SKILL.md` | ●  CI/CD trust boundaries, config drift, signer OPSEC, deploy/upgrade execution paths. |

**Recommended combo:** [Q] `defender` is the only dedicated release-gate
skill. Use [L] `audit-prep` Phase 7 as a lighter alternative.

---

## L1 / node-client code (Go / Rust)

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/agents/depth-consensus-invariant.md` | ●  Byzantine-scenario consensus reasoning. |
| **[L]** | `sources/plamen/agents/depth-network-surface.md` | ●  p2p/RPC/mempool attack surface. |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/*` (25 skills) | ●  Per-L1-concern skill packs (fork-choice, p2p-dos, mempool-asymmetric-dos, BLS, state-sync, validator-lifecycle, etc.). |

**Only plamen covers L1 node-client code.**

---

## Behavioral intent extraction

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/first-principles-agent.md` | ◐  "Extract every assumption" framing. |
| **[L]** | `sources/plamen/prompts/*/phase1-recon-prompt.md` | ◐  Recon-phase intent extraction. |
| **[Q]** | `sources/quillshield/plugins/behavioral-state-analysis/skills/behavioral-state-analysis/SKILL.md` | ●  Dedicated BSA pipeline (intent → threat engines → adversarial simulation → Bayesian scoring). |

**Recommended combo:** [Q] BSA is the dedicated methodology → [P]
`first-principles` for the assumption-violation lens.
