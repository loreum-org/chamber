# By Audit Phase

Which skill to load at which point in the audit lifecycle. Each phase has a
primary lens and optional cross-references.

---

## Phase 0 — Pre-audit / readiness

> For a **full autonomous audit**, skip phase-by-phase selection entirely and
> load `sources/orchestrator/SKILL.md` — it runs every phase below, routes to
> the relevant skills across all four collections, and cross-verifies.

Before touching the contracts, generate a structured understanding of the
protocol and flag readiness gaps.

| Source | File | When |
|---|---|---|
| **[P]** | `sources/pashov/x-ray/SKILL.md` | Generate the `x-ray.md` report — architecture, threat model, invariants, entry-points map, architecture.svg. Single most useful pre-audit artifact. |
| **[L]** | `sources/plamen/skills/audit-prep/SKILL.md` | 8-phase scored readiness report (coverage / quality / docs / hygiene / deps / practices / deploy / context). Complementary to x-ray. |
| **[L]** | `sources/plamen/prompts/<lang>/phase1-recon-prompt.md` | Recon phase prompt for plamen's pipeline (auto-detects language: evm/solana/aptos/sui/soroban/daml). |
| **[Q]** | `sources/quillshield/plugins/defender/skills/defender/SKILL.md` | If the audit includes deployment / CI/CD review. |
| **[O]** | `sources/omega/omega-repo-hygiene-sweep/SKILL.md` | Run in parallel with the build. Produces the G-series findings — deps, licensing, coverage, CI, warnings, dead code — and tells you how much to trust the code you are about to read. |
| **[O]** | `sources/omega/omega-audit-workflow/SKILL.md` | Scoping the engagement: exact repo, commit hash(es), file list, normalized LOC, prior reports for repeat clients. |

**Combine [P] + [L]:** x-ray gives you architecture + invariants; audit-prep
gives you the scored readiness gaps.

---

## Phase 1 — Threat modeling

Build a model of who can do what to whom, then identify attack surfaces.

| Source | File | When |
|---|---|---|
| **[Q]** | `sources/quillshield/plugins/behavioral-state-analysis/skills/behavioral-state-analysis/SKILL.md` | Cleanest intent-extraction pipeline: behavioral intent → threat engines → adversarial simulation → Bayesian confidence. |
| **[P]** | `sources/pashov/solidity-auditor/SKILL.md` | 12-parallel-attacker orchestration. Strongest for multi-contract breadth scans. |
| **[L]** | `sources/plamen/rules/orchestrator-rules.md` | Plamen's orchestrator rules for the recon → breadth → depth → verify → report pipeline. |

**Combine [Q] + [P]:** BSA gives you the threat model; pashov's
orchestrator executes the parallel breadth scan against it.

---

## Phase 2 — Breadth scan

Find candidate bugs across the full in-scope codebase. Two strategies:

### Strategy A — Parallel attacker fan-out (pashov)

| Source | File | Specialty |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/math-precision-agent.md` | Arithmetic / precision / scale mixing. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/access-control-agent.md` | Permission models. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/economic-security-agent.md` | External dependencies / value flows / MEV. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/execution-trace-agent.md` | Encoding / storage / branching / state transitions. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/invariant-agent.md` | Conservation laws / state couplings. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/periphery-agent.md` | Libraries / helpers / encoders. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/first-principles-agent.md` | Implicit assumptions. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/asymmetry-agent.md` | Paired-function asymmetries. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/boundary-agent.md` | Per-call-site corner cases. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/numerical-gap-agent.md` | Gap-hunter: precision × invariant × boundary seam. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/trust-gap-agent.md` | Gap-hunter: access × economics × asymmetry seam. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/flow-gap-agent.md` | Gap-hunter: execution × periphery × first-principles seam. |
| **[O]** | `sources/omega/omega-asset-exit-paths/SKILL.md` | First-pass sweep: inventory every asset the contract can hold and build the ways-in/ways-out table before reading logic closely. |
| **[O]** | `sources/omega/omega-audit-workflow/SKILL.md` | Phase 3 orchestration — spawns five independent review passes as parallel subagents on different decomposition axes (state, entry points, assets, actors, invariants), then reconciles with corroboration-tiered adjudication. Prompts, merge protocol and shared finding format live in its `references/`. |

### Strategy B — Topic-by-topic plugin scan (quillshield)

| Source | File | Topic |
|---|---|---|
| **[Q]** | `sources/quillshield/plugins/reentrancy-pattern-analysis/skills/reentrancy-pattern-analysis/SKILL.md` | Reentrancy (all 4 variants). |
| **[Q]** | `sources/quillshield/plugins/oracle-flashloan-analysis/skills/oracle-flashloan-analysis/SKILL.md` | Oracle manipulation / flash loans. |
| **[Q]** | `sources/quillshield/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md` | Input validation / arithmetic. |
| **[Q]** | `sources/quillshield/plugins/external-call-safety/skills/external-call-safety/SKILL.md` | External calls / weird ERC20. |
| **[Q]** | `sources/quillshield/plugins/state-invariant-detection/skills/state-invariant-detection/SKILL.md` | Broken invariants. |
| **[Q]** | `sources/quillshield/plugins/semantic-guard-analysis/skills/semantic-guard-analysis/SKILL.md` | Inconsistent guards. |
| **[Q]** | `sources/quillshield/plugins/proxy-upgrade-safety/skills/proxy-upgrade-safety/SKILL.md` | Proxy / upgrade safety. |
| **[Q]** | `sources/quillshield/plugins/signature-replay-analysis/skills/signature-replay-analysis/SKILL.md` | Signature / replay. |
| **[Q]** | `sources/quillshield/plugins/dos-griefing-analysis/skills/dos-griefing-analysis/SKILL.md` | DoS / griefing. |

### Strategy C — Multi-language per-language breadth (plamen)

| Source | File | When |
|---|---|---|
| **[L]** | `sources/plamen/prompts/<lang>/phase4a-inventory-prompt.md` | Per-language inventory prompt. |
| **[L]** | `sources/plamen/rules/skill-index.md` | Skill-per-language table (EVM/Solana/Aptos/Sui/Soroban/DAML/L1). |

---

## Phase 3 — Depth analysis

For each candidate finding from Phase 2, run a focused depth agent. Plamen's
depth agents have the strongest "mandatory analysis checks" discipline.

| Source | File | Specialty |
|---|---|---|
| **[L]** | `sources/plamen/agents/depth-edge-case.md` | Boundary / zero-state / dust / off-by-one. Mandatory always-on boundary checklist. |
| **[L]** | `sources/plamen/agents/depth-state-trace.md` | Cross-function state mutation, constraint enforcement, cache lifecycle set-cover. |
| **[L]** | `sources/plamen/agents/depth-token-flow.md` | Token entry/exit paths, donation attacks, approval collisions, type separation. |
| **[L]** | `sources/plamen/agents/depth-external.md` | External call side effects, cross-chain timing, MEV vectors. |
| **[L]** | `sources/plamen/agents/depth-consensus-invariant.md` | L1 consensus safety / liveness invariants (Byzantine-scenario reasoning). |
| **[L]** | `sources/plamen/agents/depth-network-surface.md` | L1 p2p/RPC/mempool attack surface. |
| **[L]** | `sources/plamen/agents/skills/niche/*.md` | Flag-triggered standalone depth agents (signature-verification, semantic-gap, semantic-consistency, spec-compliance, event-completeness, multi-step-operation, callback-receiver, dimensional-analysis, stableswap-compliance). |
| **[O]** | `sources/omega/omega-enforceability-check/SKILL.md` | Per-guard: who is it meant to constrain, and what is the cheapest way for them to act anyway? |
| **[O]** | `sources/omega/omega-accounting-consistency/SKILL.md` | Per-counter: every path that changes the underlying thing updates the summary. |
| **[O]** | `sources/omega/omega-external-data-trust/SKILL.md` | Per-external-input: what is it trusted for, what if it is wrong or stale, who benefits. |
| **[O]** | `sources/omega/omega-ordering-and-approval-races/SKILL.md` | Six recurring ordering shapes applied to every approve-then-act flow. |
| **[O]** | `sources/omega/omega-share-and-index-accounting/SKILL.md` | Per derived balance: is the scalar settled before every conversion, and does every mutator update the index basis? |
| **[O]** | `sources/omega/omega-time-indexed-state/SKILL.md` | Per historical getter and per epoch boundary: which record does a write land in, which does a read resolve to, and who profits from arriving just before the snapshot? |
| **[O]** | `sources/omega/omega-transfer-restriction-hooks/SKILL.md` | Per-restriction: which parties does the hook actually see, and what unrestricted path reaches the same outcome? |
| **[O]** | `sources/omega/omega-standard-conformance/SKILL.md` | Per-standard: what does the spec promise that this does not deliver, and does the harm land on an integrator? |

**Combine:** every depth agent runs the same mandatory analysis protocol —
Devil's Advocate + Cross-Domain Dependencies + Chain Check + Evidence
Quality + Confidence Gate + Enabler Search. Load any single depth agent
and that protocol is wired in.

---

## Phase 4 — Verification / PoC

Prove or refute each candidate finding with a runnable PoC test.

| Source | File | When |
|---|---|---|
| **[L]** | `sources/plamen/agents/security-verifier.md` | Orchestrates the verification phase. Receives a hypothesis, writes a PoC test, runs it, returns CONFIRMED / FALSE_POSITIVE. |
| **[L]** | `sources/plamen/agents/skills/<lang>/verification-protocol/SKILL.md` | Per-language PoC templates (Foundry for EVM, LiteSVM/Bankrun for Solana, Move test framework for Sui/Aptos, Soroban test). Defines STANDARD / TEMPORAL / BOUNDARY test structures. |
| **[P]** | `sources/pashov/fizz/SKILL.md` | If the verification path is a fuzz campaign rather than a single PoC. |
| **[P]** | `sources/pashov/fizz/agents/implementers/*.md` | Foundry test repro generation from fuzzer violations. |

**Recommended:** [L] `security-verifier` + `verification-protocol` is the
most general-purpose path. Switch to [P] `fizz` only when you need
stateful fuzzing rather than a single PoC.

---

## Phase 5 — Synthesis / dedup / correlation

Aggregate findings from multiple agents, dedup, identify correlated
findings, and produce a prioritized hypothesis list.

| Source | File | When |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/SKILL.md` (Turn 4) | Hard-gate dedup: function-level second pass, fix-preservation gate, completeness gate. `[agents: N]` correlation boosting. |
| **[L]** | `sources/plamen/agents/security-analyzer.md` | Synthesizer agent with explicit correlation pattern table (CS-* ↔ DS-*, AC-* ↔ TF-*, BLIND-* ↔ DEPTH-*). |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/synthesizer.md` | For fuzz-property synthesis. |
| **[Q]** | (inside `behavioral-state-analysis/SKILL.md`) | Bayesian confidence scoring. |

**Recommended:** [P] Turn-4 dedup is the most rigorous for findings
deduplication. [L] `security-analyzer` is the most rigorous for hypothesis
prioritization. Use both.

---

## Phase 6 — Report writing

Produce the final audit report with severity, evidence, and fix suggestions.

| Source | File | When |
|---|---|---|
| **[L]** | `sources/plamen/rules/report-template.md` | Cleanest report template with severity matrix. |
| **[L]** | `sources/plamen/rules/phase6-report-prompts.md` | Report-writing phase prompt. |
| **[L]** | `sources/plamen/rules/finding-output-format.md` | Finding output format contract. |
| **[P]** | `sources/pashov/solidity-auditor/references/report-formatting.md` | Pashov's report formatting. |
| **[P]** | `sources/pashov/solidity-auditor/references/judging.md` | Four-gate severity judging rubric (BLOCKS / ALLOWS / IRRELEVANT / UNCERTAIN). |
| **[O]** | `sources/omega/omega-audit-workflow/SKILL.md` | Report structure: per-file sections with filename-derived ID prefixes, a General section, mechanism→consequence→Recommendation→Severity-with-justification, and the preliminary → fix-commit → verified Resolution loop. |

**Recommended:** [L] `report-template.md` for the structure → [P]
`judging.md` for the severity rubric.

---

## Phase 7 — Release gate (optional)

If the audit includes deployment / upgrade safety, run this after Phase 6.

| Source | File | When |
|---|---|---|
| **[Q]** | `sources/quillshield/plugins/defender/skills/defender/SKILL.md` | Blue-team release-gate analysis: deploy/upgrade execution paths, CI/CD trust boundaries, config drift, secrets/signer OPSEC. |

**Only quillshield has a dedicated release-gate skill.**
