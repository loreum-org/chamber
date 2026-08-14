# Correlations — What Overlaps, What Doesn't

This is the conceptual cross-walk between the three upstream sources. For
every audit topic, the table shows which repo covers it, with which file,
and how the approaches differ.

**Sources shorthand:**
- **[P]** = pashov (`sources/pashov/`)
- **[L]** = plamen (`sources/plamen/`)
- **[Q]** = quillshield (`sources/quillshield/`)

**Coverage symbols:**
- ●  primary coverage (the source has a dedicated file for this)
- ◐  partial / incidental coverage (file primarily about something else but
       mentions this topic)
- ○  not covered

---

## 1. Topic correlation matrix

| Topic | [P] pashov | [L] plamen | [Q] quillshield | Notes |
|---|---|---|---|---|
| **Orchestrator / coordinator** | ● `solidity-auditor/SKILL.md` (12-agent parallel scan) | ● `CLAUDE.md` + `rules/orchestrator-rules.md` (recon→breadth→depth→verify→report) | ● `plugins/behavioral-state-analysis/SKILL.md` (BSA pipeline) | Three different orchestration styles: pashov fan-outs 12 attacker agents in parallel; plamen runs a phased pipeline (recon → breadth → depth → verify); quillshield runs BSA = intent extraction → threat engines → PoC. |
| **Pre-audit / readiness** | ● `x-ray/SKILL.md` (x-ray.md report) | ● `skills/audit-prep/SKILL.md` (8-phase readiness scoring) | ○ (no equivalent) | **Both pashov and plamen cover audit readiness**, with different output formats. Pashov produces a single `x-ray.md` + `invariants.md` + `entry-points.md` + `architecture.svg`; plamen produces an 8-phase scored table (coverage/quality/docs/hygiene/deps/practices/deploy/context). |
| **Fuzz / invariant harness generation** | ● `fizz/SKILL.md` (11-step pipeline, 5 discovery agents, Echidna + Medusa) | ◐ `agents/skills/*/verification-protocol/SKILL.md` (PoC test templates, Foundry/LiteSVM) | ○ (no equivalent) | Pashov's `fizz` is the only one of the three that generates a full Echidna/Medusa suite. Plamen's `verification-protocol` covers single-PoC test scaffolding only. |
| **Feynman / Socratic / Inversion mental tools** | ● `solidity-auditor/references/senior-auditor-sop.md` + `hacking-agents/shared-rules.md` (MANDATORY `[Tool: ...]` markers) | ◐ `rules/finding-output-format.md`, `phase4-confidence-scoring.md` (mandatory "Devil's Advocate" + "Enabler Search" checks) | ○ (no equivalent) | Pashov's mental-tool protocol is the strongest articulation; plamen has equivalent-but-differently-named "Devil's Advocate / Chain Check / Evidence Quality / Confidence Gate / Enabler Search" mandatory checks repeated across every depth agent. |
| **Access control** | ● `hacking-agents/access-control-agent.md` | ● `agents/skills/*/semi-trusted-roles/` (EVM/Solana/Sui/Aptos/Soroban/DAML) | ◐ `plugins/semantic-guard-analysis/SKILL.md` (detect inconsistent modifiers) | Pashov takes the attacker view; plamen codifies it as a cross-language skill pack; quillshield automates the *detection* of inconsistent guards via the "Consistency Principle". |
| **Math / arithmetic / precision** | ● `hacking-agents/math-precision-agent.md` + `numerical-gap-agent.md` | ● `agents/skills/soroban/overflow-safety/`, `sui/bit-shift-safety/`, `niche/dimensional-analysis/` | ● `plugins/input-arithmetic-safety/SKILL.md` | All three cover this. Pashov = attacker mindset + numerical seam-hunting; plamen = language-specific overflow/precision skill packs; quillshield = cataloged reference patterns with exploit PoCs. |
| **Boundary / edge cases** | ● `hacking-agents/boundary-agent.md` | ● `agents/depth-edge-case.md` (zero-state, dust, off-by-one, threshold) | ◐ `plugins/input-arithmetic-safety/` (ERC4626 inflation) | Pashov enumerates 8 corner cases per external call; plamen's `depth-edge-case` is the most systematic (mandatory "Always-on boundary checklist" — `{0, 1, max, boundary-1, boundary, boundary+1, empty-container}`); quillshield covers the ERC4626 subset. |
| **State invariants / conservation laws** | ● `hacking-agents/invariant-agent.md` | ● `agents/depth-state-trace.md` + `agents/depth-consensus-invariant.md` (L1) + `rules/skill-index.md` (always-on conservation scan) | ● `plugins/state-invariant-detection/SKILL.md` | Quillshield has the most explicit taxonomy (sum / conservation / ratio / monotonic / synchronization). Pashov covers it from the attacker view. Plamen covers it from both directions — breadth agent flags conservation candidates, depth-state-trace verifies them. |
| **Token flow / donation / first-depositor** | ● (under `economic-security-agent.md` + `math-precision-agent.md`) | ● `agents/depth-token-flow.md` + `agents/skills/*/zero-state-return/` + `share-allocation-fairness/` | ● `plugins/input-arithmetic-safety/SKILL.md` (ERC4626 inflation section) | Plamen is the most thorough — `depth-token-flow` is a dedicated depth agent, plus dedicated skills for zero-state and share-fairness. Pashov folds this into economic-security. Quillshield covers the ERC4626 inflation subset. |
| **Oracle / flash-loan** | ● (under `economic-security-agent.md`) | ● `agents/skills/sui/oracle-analysis/`, `agents/skills/*/flash-loan-interaction/` | ● `plugins/oracle-flashloan-analysis/SKILL.md` | Quillshield has the most explicit oracle-trust-model taxonomy (Chainlink / TWAP / spot / Band / custom). Plamen has dedicated per-language skills. Pashov folds it into economic-security. |
| **External calls / token integration** | ● `hacking-agents/boundary-agent.md` (8 corner cases per call) + `periphery-agent.md` | ● `agents/depth-external.md` (cross-chain, MEV, governance impact) + `agents/skills/*/external-precondition-audit/` | ● `plugins/external-call-safety/SKILL.md` (fee-on-transfer, rebasing, USDT, ERC-777) | Quillshield has the most cataloged "weird ERC20" reference. Pashov has the strongest *per-call-site* enumeration discipline. Plamen's depth-external adds cross-chain timing + MEV vectors that the others don't cover in depth. |
| **Reentrancy** | ◐ (under `boundary-agent.md` step 8 "ERC721 hook re-entry", `periphery-agent.md`) | ◐ `agents/skills/aptos/reentrancy-analysis/` (Aptos-specific) | ● `plugins/reentrancy-pattern-analysis/SKILL.md` (all 4 variants + read-only) | Quillshield has the deepest dedicated treatment. Pashov covers ERC721/ERC777 callback re-entry as one of many boundary cases. Plamen covers it for Aptos only (no dedicated EVM reentrancy skill). |
| **Proxy / upgrade safety** | ◐ (under `access-control-agent.md` "Abuse delegatecall/proxy") | ● `agents/skills/soroban/contract-upgradeability/`, `sui/package-version-safety/`, `agents/skills/injectable/l1/hardfork-activation-and-protocol-upgrade/` | ● `plugins/proxy-upgrade-safety/SKILL.md` (Transparent / UUPS / Beacon / Diamond / Minimal) | Quillshield has the most thorough EVM proxy treatment. Plamen covers non-EVM upgrade patterns (Soroban `update_current_contract_wasm`, Sui package upgrades, L1 hardforks). Pashov mentions it briefly under access-control. |
| **Signature / replay / EIP-712 / permit** | ◐ (under `boundary-agent.md`, `first-principles-agent.md`) | ● `agents/skills/niche/signature-verification-audit/` | ● `plugins/signature-replay-analysis/SKILL.md` (5 replay types) | Quillshield has the most cataloged reference (19.63% prevalence stat, 5 replay-type taxonomy). Plamen has a dedicated niche agent. Pashov mentions signatures only incidentally. |
| **DoS / griefing** | ◐ (under `periphery-agent.md` "Brick via gas complexity") | ● `agents/skills/injectable/l1/mempool-asymmetric-dos/`, `p2p-dos-and-eclipse/` (L1 node clients) | ● `plugins/dos-griefing-analysis/SKILL.md` (unbounded loop, 63/64 rule, storage bloat) | Quillshield covers smart-contract-layer DoS comprehensively. Plamen is the only one that covers L1 node-client DoS (mempool, p2p eclipse, gossip cache). Pashov mentions it incidentally under periphery. |
| **Economic / incentive / MEV** | ● `hacking-agents/economic-security-agent.md` + `trust-gap-agent.md` (access × economics seam) | ● `agents/skills/*/economic-design-audit/` + `agents/depth-external.md` §3 (MEV vector analysis) | ◐ (under `plugins/oracle-flashloan-analysis/SKILL.md`) | Pashov is the strongest on attacker-economics reasoning (unlimited capital + flash-loans, ERC compliance breaking). Plamen adds multi-block arbitrage + cross-chain MEV timing windows. Quillshield folds MEV into oracle-flashloan. |
| **Semantic / spec compliance / logic** | ● `hacking-agents/asymmetry-agent.md` + `first-principles-agent.md` | ● `agents/skills/niche/semantic-consistency-audit/`, `semantic-gap-investigator/`, `spec-compliance-audit/`, `event-completeness/` | ● `plugins/semantic-guard-analysis/SKILL.md` | Three different framings. Pashov hunts asymmetries between paired functions. Plamen has three niche agents: semantic-consistency (cross-contract config drift), semantic-gap (sync-gap / accumulation / conditional / cluster flags from semantic invariants), spec-compliance (doc-vs-code), event-completeness. Quillshield detects guard-pattern inconsistencies within a single contract. |
| **Cross-contract / composability** | ● `hacking-agents/flow-gap-agent.md` (execution × periphery × first-principles seam) + `shared-rules.md` (cross-contract pattern weaponization) | ● `rules/phase4c-chain-prompt.md` (chain analysis), `agents/skills/injectable/dex-integration-security/`, `lending-protocol-security/`, `vault-accounting/`, `nft-protocol-security/`, `governance-attack-vectors/`, `account-abstraction-security/` | ◐ (under BSA threat engines) | Plamen has the most composability coverage — dedicated injectable skills per protocol type (DEX, lending, vault, NFT, governance, account abstraction). Pashov's `flow-gap-agent` is a meta-lens that hunts bugs at the seams between control-flow lenses. Quillshield treats composability inside BSA but without per-protocol-type skill packs. |
| **Cross-chain timing / bridges** | ◐ (under `economic-security-agent.md`) | ● `agents/skills/*/cross-chain-timing/` + `agents/depth-external.md` §2 (message latency, stale state, multi-block arbitrage) + `cross-vm-serialization-conformance` | ○ (no equivalent) | **Only plamen covers this.** Pashov and quillshield do not have dedicated cross-chain skill content. |
| **PoC test writing / verification protocol** | ◐ (under `fizz/SKILL.md` step 11, but for fuzz repros only) | ● `agents/security-verifier.md` + `agents/skills/*/verification-protocol/` (STANDARD / TEMPORAL / BOUNDARY test templates) | ◐ (under BSA PoC generation) | Plamen has the most general-purpose PoC methodology. Pashov's is fuzz-campaign-specific. Quillshield's is folded into the BSA pipeline. |
| **Synthesis / dedup of findings** | ● `solidity-auditor/SKILL.md` Turn 4 (mandatory function-level second pass, fix-preservation gate, completeness gate) | ● `agents/security-analyzer.md` (correlation patterns, prioritized hypotheses) + `fizz/agents/invariant-discovery/synthesizer.md` | ◐ (BSA "Bayesian confidence scoring") | All three do this differently. Pashov uses hard-gate dedup with `[agents: N]` correlation boosting. Plamen uses explicit correlation tables (CS-* ↔ DS-*, AC-* ↔ TF-*). Quillshield uses Bayesian scoring. |
| **L1 / node-client code (Go / Rust)** | ○ | ● `agents/skills/injectable/l1/` (25 skills: consensus, fork-choice, p2p, mempool, BLS, IBC, state-sync, validator slashing, hardfork, opengrep rules) + `agents/depth-network-surface.md` + `depth-consensus-invariant.md` | ○ | **Only plamen covers this.** Pashov and quillshield are smart-contract-only. |
| **Non-EVM languages (Sui, Aptos, Soroban, Solana, DAML)** | ○ | ● `agents/skills/{sui, soroban}/` + EVM/Solana/Aptos/DAML trees (see `rules/skill-index.md`) | ○ | **Only plamen covers non-EVM targets** (the 18 EVM + 20 Solana + 22 Aptos + 22 Sui + 19 Soroban + 12 DAML skill packs). |
| **Defender / release-gate / deployment safety** | ○ | ◐ (under `skills/audit-prep/SKILL.md` "Phase 7: Deployment Readiness") | ● `plugins/defender/SKILL.md` (CI/CD trust boundaries, config drift, signer OPSEC) | **Quillshield has the only dedicated release-gate skill.** Plamen's audit-prep has a deployment-readiness phase but is lighter. Pashov doesn't cover this. |
| **Behavioral state / intent extraction** | ◐ (under `first-principles-agent.md` "extract every assumption") | ◐ (under recon phase, see `prompts/*/phase1-recon-prompt.md`) | ● `plugins/behavioral-state-analysis/SKILL.md` | Quillshield's BSA is the only explicit "extract behavioral intent → break it" pipeline. |
| **DAML / Canton** | ○ | ● `agents/skills/daml/` (12 skills) | ○ | Plamen only. |
| **StableSwap / Curve forks** | ○ | ● `agents/skills/niche/stableswap-compliance/` (Newton-Raphson convergence, A encoding, decimal normalization) | ○ | Plamen only. |
| **Account abstraction / ERC-4337** | ○ | ● `agents/skills/injectable/account-abstraction-security/` | ○ | Plamen only. |
| **Governance / Governor / Timelock attacks** | ◐ (under `access-control-agent.md`) | ● `agents/skills/injectable/governance-attack-vectors/` | ○ | Plamen's injectable skill is the only dedicated treatment. |
| **NFT marketplace logic** | ○ | ● `agents/skills/injectable/nft-protocol-security/` | ○ | Plamen only. |

---

## 2. What correlates strongly (3-of-3 coverage)

These are the topics where all three sources have *some* coverage — meaning
you can pick the lens that fits the situation:

1. **Math / arithmetic / precision** — P pashov's `math-precision` +
   `numerical-gap` agents, L plamen's `overflow-safety` / `bit-shift-safety`
   / `dimensional-analysis`, Q quillshield's `input-arithmetic-safety`.
2. **State invariants / conservation** — P `invariant-agent`, L
   `depth-state-trace` + `depth-consensus-invariant`, Q
   `state-invariant-detection`.
3. **Access control** — P `access-control-agent`, L `semi-trusted-roles`
   + `auth-validation`, Q `semantic-guard-analysis`.
4. **External calls / token integration** — P `boundary-agent` +
   `periphery-agent`, L `depth-external` + `external-precondition-audit`,
   Q `external-call-safety`.
5. **Oracle / flash-loan** — P (under `economic-security-agent`), L
   `oracle-analysis` + `flash-loan-interaction`, Q
   `oracle-flashloan-analysis`.

**Recommended combination pattern** for these topics: use **Q quillshield**
as the reference catalog (cleanest taxonomy), **P pashov** as the
attacker-mindset prompt, and **L plamen** as the per-language methodology
file.

---

## 3. What correlates partially (2-of-3 coverage)

| Topic | Covered by | Missing |
|---|---|---|
| Pre-audit readiness | P, L | Q |
| Token flow / first-depositor | P, L (deeper), Q (ERC4626 only) | — (all 3 cover at least the ERC4626 case) |
| Reentrancy | Q (dedicated), L (Aptos only) | P covers only as one boundary case |
| Proxy / upgrade safety | L (non-EVM), Q (EVM) | P incidental only |
| Signature / replay | L (niche agent), Q (dedicated) | P incidental only |
| Semantic / logic consistency | P (asymmetry), L (niche agents), Q (semantic-guard) | all 3 cover this — but with very different framings |
| Composability / cross-contract | P (flow-gap), L (per-protocol-type injectables) | Q (inside BSA only) |
| Economic / MEV | P (economic-security + trust-gap), L (depth-external §3 + economic-design-audit) | Q (only via oracle-flashloan) |
| DoS / griefing | L (L1 + niche), Q (smart-contract layer) | P incidental only |

---

## 4. What does NOT correlate (unique to one source)

These are the topics where only one source has coverage — they MUST come
from that source:

### Unique to **plamen**

- **L1 / node-client code** (Go/Rust): consensus safety, fork-choice, p2p
  DoS, mempool asymmetric DoS, BLS aggregation, light-client proof
  verification, state-sync pruning, execution-client hardening, validator
  lifecycle & slashing, hardfork activation, opengrep rule pack — see
  `sources/plamen/agents/skills/injectable/l1/` (25 skills).
- **Non-EVM languages**: Sui (22), Aptos (22), Soroban (19), DAML (12) — see
  `sources/plamen/rules/skill-index.md`.
- **Cross-chain timing / bridge latency / multi-block MEV windows** —
  `sources/plamen/agents/depth-external.md` §2 + `cross-chain-timing/`
  per-language skill + `cross-vm-serialization-conformance/`.
- **StableSwap / Curve fork compliance** (Newton-Raphson, A encoding) —
  `niche/stableswap-compliance/`.
- **Account abstraction / ERC-4337 security** —
  `injectable/account-abstraction-security/`.
- **NFT marketplace / collateral logic** —
  `injectable/nft-protocol-security/`.
- **Governance attack vectors** (Governor, Timelock, quorum, delegate) —
  `injectable/governance-attack-vectors/`.
- **DEX / lending / vault integration security** (when the protocol is NOT
  itself a DEX/lending/vault but integrates one) — `injectable/dex-`,
  `lending-`, `vault-accounting/`.
- **Outcome determinism** (finite-pool selection, RNG) —
  `injectable/outcome-determinism/`.
- **Cache lifecycle set-cover for bounded node-client caches** —
  `agents/depth-state-trace.md` §8.

### Unique to **pashov**

- **Full fuzz / invariant harness generation** (Echidna + Medusa + 5
  parallel discovery agents + Synthesizer + 2 implementers + Foundry repro
  generation) — `sources/pashov/fizz/`.
- **The `x-ray` pre-audit report** (architecture.json, invariants.md,
  entry-points.md, git-security-analysis.json, architecture.svg) —
  `sources/pashov/x-ray/`.
- **Gap-hunter agents** (cross-lens seam bugs: `numerical-gap-agent.md`,
  `flow-gap-agent.md`, `trust-gap-agent.md`) — the bug exists only at the
  seam between two specialties.
- **The senior-auditor SOP** (Feynman + Socratic + Inversion with
  MANDATORY `[Tool: ...]` markers) —
  `sources/pashov/solidity-auditor/references/senior-auditor-sop.md` +
  `hacking-agents/shared-rules.md`.

### Unique to **quillshield**

- **Defender / release-gate analysis** (deployment + upgrade safety, CI/CD
  trust boundaries, config drift, signer OPSEC) —
  `plugins/defender/`.
- **Behavioral State Analysis (BSA) pipeline** (intent extraction →
  threat engines → adversarial simulation → Bayesian confidence scoring) —
  `plugins/behavioral-state-analysis/`.
- **Quantified prevalence stats** in skill descriptions (e.g. "34.6% of
  contract exploits are input validation", "19.63% of signature-using
  contracts have replay bugs", "54.2% of contracts use proxy patterns") —
  useful for severity triage.
- **The most cataloged "weird ERC20" reference** (fee-on-transfer,
  rebasing, USDT void return, ERC-777 hooks, false-returning tokens,
  missing-return-value tokens, ERC-165 dispatch fallback) —
  `plugins/external-call-safety/SKILL.md`.

---

## 5. Recommended "default lens" per audit phase

| Audit phase | Primary lens | Why |
|---|---|---|
| **Recon / readiness** | P `x-ray` + L `audit-prep` together | x-ray gives architecture + invariants + entry-point map; audit-prep gives the 8-phase scored report. They produce complementary outputs. |
| **Threat modeling** | Q `behavioral-state-analysis` + P `solidity-auditor` orchestrator | BSA = cleanest intent-extraction; pashov = strongest attacker-mindset orchestration. |
| **Breadth scan (single contract)** | Q topic plugins (reentrancy, oracle, math, …) | Cleanest catalog, easiest to pick the right one. |
| **Breadth scan (multi-contract / cross-contract)** | P 12 hacking agents | Specifically designed for parallel fan-out with dedup at the end. |
| **Depth analysis (single bug)** | L depth agents + L niche skills | Most systematic: `depth-edge-case`, `depth-state-trace`, `depth-token-flow`, `depth-external` each have an "always-on boundary checklist" + "mandatory analysis checks". |
| **Multi-language (non-EVM)** | L only | P and Q are EVM-only. |
| **L1 / node-client (Go/Rust)** | L only | Only plamen covers this. |
| **Fuzz / invariant campaign** | P `fizz` only | Only pashov generates a full Echidna/Medusa suite. |
| **PoC test writing** | L `security-verifier` + L `verification-protocol` per language | Most general-purpose; pashov's is fuzz-repro-specific. |
| **Synthesis / dedup** | P Turn-4 dedup + L `security-analyzer` together | Pashov's hard-gate dedup (function-level second pass, fix preservation, completeness gate) is the most rigorous. Plamen adds the explicit correlation table. |
| **Report writing** | L `rules/report-template.md` + Q confidence scoring | Plamen has the cleanest template; quillshield's Bayesian scoring helps triage. |
| **Pre-deploy release gate** | Q `defender` only | Only quillshield covers this. |

---

## 6. Cross-source terminology map

Same concept, different names — useful when reading each source:

| Concept | Pashov term | Plamen term | Quillshield term |
|---|---|---|---|
| Lead (not yet proven) | LEAD | CONTESTED | Low-confidence finding |
| Proven bug | FINDING | CONFIRMED | High-confidence finding |
| Wrong but not exploitable | (rejected) | REFUTED | Refuted / false positive |
| Cross-function seam bug | gap-hunter finding | chain finding | compositional finding |
| Mandatory critical-thinking check | `[Tool: Inversion]` | Devil's Advocate | (BSA "adversarial simulation") |
| Proven with concrete numbers | "proof:" field | `[CODE-TRACE]` / `[FUZZ-PASS]` | evidence-backed |
| Multi-agent correlation | `[agents: N]` | correlation patterns table | Bayesian prior |
| Per-call precondition | guard predicate | enforced guard | require-check |
| Global invariant from guard lift | guard lift | inferred invariant | conservation law |
| Function access tier | permissionless / role-gated / admin | access-control map | (inside BSA actor model) |
| Fuzz property guarantee tag | SHOULD-HOLD / EXPLORATORY (in fizz) | MUST-HOLD / MAY-HOLD | (BSA confidence score) |
