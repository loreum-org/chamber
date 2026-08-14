# By Target Language

Which skills to load for each target ecosystem. Plamen is the only source
with multi-language skill packs; pashov and quillshield are EVM-only.

| Source | Multi-language? |
|---|---|
| **[P]** pashov | ✗ EVM only (`solidity-auditor`, `x-ray`, `fizz`) |
| **[L]** plamen | ✓ EVM, Solana, Aptos, Sui, Soroban, DAML, L1 node-client (Go/Rust) |
| **[Q]** quillshield | ✗ EVM only (all 10 plugins) |

---

## EVM (Solidity / Vyper)

All three sources cover EVM. Pashov and quillshield are EVM-exclusive;
plamen's EVM tree has 18 skills.

| Source | File | Coverage |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/SKILL.md` + `references/hacking-agents/*.md` | ●  12-agent parallel attacker methodology. |
| **[P]** | `sources/pashov/x-ray/SKILL.md` | ●  Pre-audit x-ray report. |
| **[P]** | `sources/pashov/fizz/SKILL.md` | ●  Echidna + Medusa fuzz suite generation. |
| **[L]** | `sources/plamen/rules/skill-index.md` (EVM section) | ●  18 EVM skills (FLASH_LOAN_INTERACTION, ORACLE_ANALYSIS, TOKEN_FLOW_TRACING, ZERO_STATE_RETURN, STAKING_RECEIPT_TOKENS, EVENT_CORRECTNESS, SEMI_TRUSTED_ROLES, MIGRATION_ANALYSIS, CROSS_CHAIN_TIMING, TEMPORAL_PARAMETER_STALENESS, CENTRALIZATION_RISK, SHARE_ALLOCATION_FAIRNESS, FORK_ANCESTRY, ECONOMIC_DESIGN_AUDIT, EXTERNAL_PRECONDITION_AUDIT, VERIFICATION_PROTOCOL, STORAGE_LAYOUT_SAFETY, CROSS_CHAIN_MESSAGE_INTEGRITY). |
| **[L]** | `sources/plamen/agents/depth-*.md` | ●  EVM-compatible depth agents. |
| **[Q]** | All 10 plugins under `sources/quillshield/plugins/*/skills/*/SKILL.md` | ●  Topic-focused reference catalogs. |

**Recommended combo for an EVM audit:** [P] `x-ray` → [P] `solidity-auditor`
orchestrator with all 12 hacking agents → [Q] topic plugins as
reference → [L] depth agents + `security-verifier` for PoCs.

---

## Solana

Only plamen covers Solana. 20 skills in the Solana tree.

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (Solana section) | ●  20 Solana skills (ACCOUNT_VALIDATION, CPI_SECURITY, PDA_SECURITY, ACCOUNT_LIFECYCLE, TOKEN_2022_EXTENSIONS, INSTRUCTION_INTROSPECTION, SEMI_TRUSTED_ROLES, MIGRATION_ANALYSIS, CROSS_CHAIN_TIMING, TEMPORAL_PARAMETER_STALENESS, CENTRALIZATION_RISK, SHARE_ALLOCATION_FAIRNESS, FORK_ANCESTRY, ECONOMIC_DESIGN_AUDIT, EXTERNAL_PRECONDITION_AUDIT, VERIFICATION_PROTOCOL, TOKEN_FLOW_TRACING, ZERO_STATE_RETURN, FLASH_LOAN_INTERACTION, TRIDENT_API_REFERENCE). |
| **[L]** | `sources/plamen/agents/skills/solana/*/SKILL.md` | ●  Solana-specific skill files (19 skills available in this mirror). |
| **[L]** | `sources/plamen/agents/skills/<lang>/verification-protocol/SKILL.md` | ●  Solana PoC test templates (LiteSVM / Bankrun). |

---

## Sui (Move)

Only plamen covers Sui. 22 skills (21 standard + 1 core directives).

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (Sui section) | ●  22 Sui skills (MOVE_SAFETY_CORE_DIRECTIVES, ABILITY_ANALYSIS, BIT_SHIFT_SAFETY, TYPE_SAFETY, OBJECT_OWNERSHIP, FORK_ANCESTRY, VERIFICATION_PROTOCOL, ORACLE_ANALYSIS, FLASH_LOAN_INTERACTION, TOKEN_FLOW_TRACING, ZERO_STATE_RETURN, SEMI_TRUSTED_ROLES, TEMPORAL_PARAMETER_STALENESS, ECONOMIC_DESIGN_AUDIT, EXTERNAL_PRECONDITION_AUDIT, MIGRATION_ANALYSIS, CROSS_CHAIN_TIMING, PTB_COMPOSABILITY, PACKAGE_VERSION_SAFETY, DEPENDENCY_AUDIT, CENTRALIZATION_RISK, SHARE_ALLOCATION_FAIRNESS). |
| **[L]** | `sources/plamen/agents/skills/sui/*/SKILL.md` | ●  All 22 Sui skill files mirrored. |
| **[L]** | `sources/plamen/agents/skills/sui/verification-protocol/references/*.md` | ●  Sui verification protocol references (templates.md, advanced.md). |

---

## Aptos (Move)

Only plamen covers Aptos. 22 skills (21 standard + 1 core directives).

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (Aptos section) | ●  22 Aptos skills (similar to Sui but with REF_LIFECYCLE and FUNGIBLE_ASSET_SECURITY; no PTB_COMPOSABILITY or OBJECT_OWNERSHIP). |

Note: this mirror does not include the Aptos skill files themselves (only
the index entry). If you're auditing Aptos, install plamen upstream
directly to get the per-skill files.

---

## Soroban (Stellar Rust)

Only plamen covers Soroban. 19 skills (13 cross-language + 6 Soroban-specific).

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (Soroban section) | ●  19 Soroban skills (AUTH_VALIDATION, STORAGE_LIFECYCLE, OVERFLOW_SAFETY, CONTRACT_UPGRADEABILITY, SEP41_TOKEN_SAFETY, CUSTOM_TYPE_SAFETY, FORK_ANCESTRY, VERIFICATION_PROTOCOL, TOKEN_FLOW_TRACING, ZERO_STATE_RETURN, SEMI_TRUSTED_ROLES, TEMPORAL_PARAMETER_STALENESS, ECONOMIC_DESIGN_AUDIT, EXTERNAL_PRECONDITION_AUDIT, FLASH_LOAN_INTERACTION, MIGRATION_ANALYSIS, CROSS_CHAIN_TIMING, CENTRALIZATION_RISK, SHARE_ALLOCATION_FAIRNESS). |
| **[L]** | `sources/plamen/agents/skills/soroban/*/SKILL.md` | ●  All 19 Soroban skill files mirrored. |

---

## DAML / Canton

Only plamen covers DAML. 12 skills (7 DAML-specific always-on + 5 cross-language).

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (DAML section) | ●  12 DAML skills (AUTHORIZATION_MODEL, CHOICE_SEMANTICS, CONTRACT_KEY_SAFETY, CID_CAPABILITY_SAFETY, PRIVACY_DISCLOSURE, LOCKING_SEMANTICS, ENSURE_INVARIANTS, VERIFICATION_PROTOCOL, SEMI_TRUSTED_ROLES, ECONOMIC_DESIGN_AUDIT, SHARE_ALLOCATION_FAIRNESS, TEMPORAL_PARAMETER_STALENESS). |

Note: this mirror does not include the DAML skill files themselves (only
the index entry).

---

## L1 node-client (Go / Rust)

Only plamen covers L1 node-client code. 25 skills in the L1 tree.

| Source | File | Coverage |
|---|---|---|
| **[L]** | `sources/plamen/rules/skill-index.md` (L1 section) | ●  25 L1 skills (CONSENSUS_SAFETY_INVARIANTS, CONSENSUS_MATH_CORRECTNESS, FORK_CHOICE_AUDIT, P2P_DOS_AND_ECLIPSE, MEMPOOL_ASYMMETRIC_DOS, LIGHT_CLIENT_PROOF_VERIFICATION, RPC_SURFACE_AUDIT, BLS_AGGREGATION_AUDIT, STATE_SYNC_PRUNING, EXECUTION_CLIENT_HARDENING, CROSS_ENVIRONMENT_SEMANTIC_DRIFT, VALIDATOR_LIFECYCLE_AND_SLASHING, HARDFORK_ACTIVATION_AND_PROTOCOL_UPGRADE, GO_CONCURRENCY_SAFETY, RUST_UNSAFE_AUDIT, DEPENDENCY_AUDIT_NODECLIENT, DATA_AVAILABILITY_ENFORCEMENT, PEER_SCORING_CORRECTNESS, GOSSIP_CACHE_INVARIANCE, CONSENSUS_TX_IDENTITY_INVARIANTS, CONFIG_CORRECTNESS, WRITE_ERROR_DIVERGENCE, COSMOS_SDK_MODULE_SAFETY, COSMOS_IBC_SECURITY). |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/*/SKILL.md` | ●  All 25 L1 skill files mirrored. |
| **[L]** | `sources/plamen/agents/depth-consensus-invariant.md` | ●  Depth agent for consensus safety / liveness. |
| **[L]** | `sources/plamen/agents/depth-network-surface.md` | ●  Depth agent for p2p / RPC / mempool surfaces. |
| **[L]** | `sources/plamen/agents/skills/injectable/l1/_opengrep-rules/README.md` | ●  Opengrep rule pack for L1 patterns. |

---

## Choosing across sources when multiple cover your language

For EVM (the only ecosystem all three cover), the choice depends on
audit phase and lens — see [by-phase.md](by-phase.md) and
[by-bug-class.md](by-bug-class.md).

For non-EVM targets, plamen is the only option in this library.
