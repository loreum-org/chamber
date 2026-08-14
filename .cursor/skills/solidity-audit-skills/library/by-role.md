# By Agent Role

Skills organized by the agent role they're meant to drive. Use this when
building an agent pipeline (e.g. orchestrator spawns attackers →
attackers feed verifier → verifier feeds synthesizer).

---

## Orchestrator / coordinator

Drives the audit pipeline: discovers files, dispatches agents, compiles
the report.

| Source | File | Style |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/SKILL.md` | 4-turn orchestrator: Discover → Prepare bundles → Spawn 12 parallel attackers → Dedup & report. Banner-printing, hard-gate dedup with completeness/failure gates. |
| **[P]** | `sources/pashov/x-ray/SKILL.md` | 3-step pre-audit orchestrator: Enumerate → Read sources & synthesize invariants → Write report files. |
| **[P]** | `sources/pashov/fizz/SKILL.md` | 11-step fuzz-suite orchestrator with guided/automatic modes and per-cycle coverage gates. |
| **[L]** | `sources/plamen/CLAUDE.md` + `sources/plamen/rules/orchestrator-rules.md` | Phased pipeline: recon → breadth → rescan → depth → chain → verify → skeptic → report. Haltless by design — malformed phases auto-recover. |
| **[L]** | `sources/plamen/skills/audit-prep/SKILL.md` | 8-phase readiness orchestrator. |
| **[Q]** | `sources/quillshield/plugins/behavioral-state-analysis/skills/behavioral-state-analysis/SKILL.md` | BSA orchestrator: intent extraction → threat engines → adversarial simulation → Bayesian scoring. |
| **[O]** | `sources/omega/omega-audit-workflow/SKILL.md` | Engagement-level orchestration. Phase 3 fans out to two **independent generalist** review subagents (bottom-up from state, top-down from entry points), each applying all seven lenses to the full scope, plus a regression pass on repeat engagements — then reconciles. Contrast with **[P]** `solidity-auditor`, which fans out to 12 *specialists*: there, agreement is expected overlap; here, agreement between two generalists who both saw everything is real evidence. |

---

## Attacker (breadth)

Hunts for vulnerabilities. Pashov's 12-agent fan-out is the strongest
attacker-mindset collection; plamen's depth agents take a more systematic
verification angle.

| Source | File | Specialty |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/math-precision-agent.md` | Math / precision / scale mixing. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/access-control-agent.md` | Permission models. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/economic-security-agent.md` | External deps / value flows / MEV. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/execution-trace-agent.md` | Execution flow within/across transactions. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/invariant-agent.md` | Conservation laws / state couplings. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/periphery-agent.md` | Libraries / helpers / encoders. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/first-principles-agent.md` | Implicit assumptions. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/asymmetry-agent.md` | Paired-function asymmetries. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/boundary-agent.md` | Per-call-site corner cases. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/numerical-gap-agent.md` | Seam: precision × invariant × boundary. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/trust-gap-agent.md` | Seam: access × economics × asymmetry. |
| **[P]** | `sources/pashov/solidity-auditor/references/hacking-agents/flow-gap-agent.md` | Seam: execution × periphery × first-principles. |
| **[Q]** | `sources/quillshield/plugins/reentrancy-pattern-analysis/skills/reentrancy-pattern-analysis/SKILL.md` | Reentrancy hunter. |
| **[Q]** | `sources/quillshield/plugins/oracle-flashloan-analysis/skills/oracle-flashloan-analysis/SKILL.md` | Oracle / flash-loan hunter. |
| **[Q]** | `sources/quillshield/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md` | Input / arithmetic hunter. |
| **[Q]** | `sources/quillshield/plugins/external-call-safety/skills/external-call-safety/SKILL.md` | External-call / weird-ERC20 hunter. |
| **[Q]** | `sources/quillshield/plugins/state-invariant-detection/skills/state-invariant-detection/SKILL.md` | Invariant-violation hunter. |
| **[Q]** | `sources/quillshield/plugins/semantic-guard-analysis/skills/semantic-guard-analysis/SKILL.md` | Inconsistent-guard hunter. |
| **[Q]** | `sources/quillshield/plugins/proxy-upgrade-safety/skills/proxy-upgrade-safety/SKILL.md` | Proxy / upgrade hunter. |
| **[Q]** | `sources/quillshield/plugins/signature-replay-analysis/skills/signature-replay-analysis/SKILL.md` | Signature / replay hunter. |
| **[Q]** | `sources/quillshield/plugins/dos-griefing-analysis/skills/dos-griefing-analysis/SKILL.md` | DoS / griefing hunter. |

---

## Depth analyst

Takes a single candidate finding and verifies / refines / refutes it via
systematic analysis. Plamen's depth agents have the strongest
"mandatory-analysis-checks" discipline.

| Source | File | Specialty |
|---|---|---|
| **[L]** | `sources/plamen/agents/depth-edge-case.md` | Edge cases / boundaries / zero-state / dust. Mandatory always-on boundary checklist. |
| **[L]** | `sources/plamen/agents/depth-state-trace.md` | Cross-function state mutation / constraint enforcement / cache lifecycle set-cover. |
| **[L]** | `sources/plamen/agents/depth-token-flow.md` | Token entry/exit / donation attacks / approval collisions / type separation. |
| **[L]** | `sources/plamen/agents/depth-external.md` | External call side effects / cross-chain timing / MEV / governance parameter changes. |
| **[L]** | `sources/plamen/agents/depth-consensus-invariant.md` | L1 consensus safety / liveness / Byzantine-scenario reasoning. |
| **[L]** | `sources/plamen/agents/depth-network-surface.md` | L1 p2p / RPC / mempool / pre-auth panic paths / asymmetric cost. |
| **[L]** | `sources/plamen/agents/skills/niche/signature-verification-audit/SKILL.md` | Standalone depth agent for signatures. |
| **[L]** | `sources/plamen/agents/skills/niche/semantic-gap-investigator/SKILL.md` | Standalone depth agent for SYNC_GAP / ACCUMULATION_EXPOSURE / CONDITIONAL / CLUSTER_GAP flags. |
| **[L]** | `sources/plamen/agents/skills/niche/semantic-consistency-audit/SKILL.md` | Standalone depth agent for cross-contract config/formula drift. |
| **[L]** | `sources/plamen/agents/skills/niche/spec-compliance-audit/SKILL.md` | Standalone depth agent for doc-vs-code compliance. |
| **[L]** | `sources/plamen/agents/skills/niche/event-completeness/SKILL.md` | Standalone depth agent for event coverage. |
| **[L]** | `sources/plamen/agents/skills/niche/multi-step-operation-safety/SKILL.md` | Standalone depth agent for approve/delegate/on-behalf-of sequences. |
| **[L]** | `sources/plamen/agents/skills/niche/callback-receiver-safety/SKILL.md` | Standalone depth agent for ERC721/ERC1155/ERC777 callbacks. |
| **[L]** | `sources/plamen/agents/skills/niche/dimensional-analysis/SKILL.md` | Standalone depth agent for unit/scale mismatches. |
| **[L]** | `sources/plamen/agents/skills/niche/stableswap-compliance/SKILL.md` | Standalone depth agent for Curve fork compliance. |

---

## Verifier (PoC writer)

Receives a hypothesis with location + bug mechanism + expected behavior.
Writes a test that PROVES the bug. Returns CONFIRMED / FALSE_POSITIVE.

| Source | File | When |
|---|---|---|
| **[L]** | `sources/plamen/agents/security-verifier.md` | General-purpose verifier agent. Includes RAG-validation step (assess_hypothesis_strength, get_similar_findings, search_solodit_live). |
| **[L]** | `sources/plamen/agents/skills/evm/verification-protocol/SKILL.md` | EVM (Foundry) PoC templates — STANDARD / TEMPORAL / BOUNDARY test structures. |
| **[L]** | `sources/plamen/agents/skills/solana/verification-protocol/SKILL.md` | Solana (LiteSVM/Bankrun) PoC templates. |
| **[L]** | `sources/plamen/agents/skills/sui/verification-protocol/SKILL.md` | Sui (Move test framework) PoC templates + `references/templates.md` + `references/advanced.md`. |
| **[L]** | `sources/plamen/agents/skills/soroban/verification-protocol/SKILL.md` | Soroban PoC templates. |
| **[P]** | `sources/pashov/fizz/SKILL.md` (Step 11 "Generate Violation Repros") | Foundry repro generation from fuzz-campaign violations. |

---

## Synthesizer (dedup / correlate / prioritize)

Takes outputs from many attackers/depth agents. Extracts all issues into a
master list, finds correlations, forms prioritized hypotheses.

| Source | File | Style |
|---|---|---|
| **[P]** | `sources/pashov/solidity-auditor/SKILL.md` (Turn 4) | Hard-gate dedup: function-level second pass, fix-preservation gate, completeness gate, `[agents: N]` correlation boosting. |
| **[L]** | `sources/plamen/agents/security-analyzer.md` | Explicit correlation-pattern table (CS-* ↔ DS-*, AC-* ↔ TF-*, BLIND-* ↔ DEPTH-*). |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/synthesizer.md` | Fuzz-property synthesis — merges 5 discovery-agent outputs into a property plan with SHOULD-HOLD / EXPLORATORY guarantee tags. |
| **[Q]** | (inside `behavioral-state-analysis/SKILL.md`) | Bayesian confidence scoring. |

---

## Discovery (invariant hunting)

For fuzz campaigns: agents that find candidate invariants from source.

| Source | File | Approach |
|---|---|---|
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/conservation-auditor.md` | Sum-of-parts = tracked-whole for every aggregate variable. |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/roundtrip-rounding-analyst.md` | Forward + inverse operations, directional rounding. |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/state-transition-mapper.md` | Postconditions, monotonicity, entity counts, state machine. |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/adversarial-profit-maximizer.md` | Attacker thinking — DoS, value extraction, edge states. |
| **[P]** | `sources/pashov/fizz/agents/invariant-discovery/protocol-type-specialist.md` | Auto-detect type, apply domain templates (vault/lending/AMM/etc.). |

---

## Implementer (test/PoC writer for fuzz pipelines)

Takes invariant candidates and implements them as test code.

| Source | File | Scope |
|---|---|---|
| **[P]** | `sources/pashov/fizz/agents/implementers/global-property-implementer.md` | Ghosts in `Base.sol`, state in `Snapshots.sol`, global properties in `Properties.sol`. |
| **[P]** | `sources/pashov/fizz/agents/implementers/specific-property-implementer.md` | Specific properties in `Properties.sol`, handler wiring. |

---

## Reporter

Writes the final human-readable report.

| Source | File | Use |
|---|---|---|
| **[L]** | `sources/plamen/rules/report-template.md` | Cleanest report template with severity matrix. |
| **[L]** | `sources/plamen/rules/phase6-report-prompts.md` | Report-writing phase prompt. |
| **[L]** | `sources/plamen/rules/finding-output-format.md` | Finding output format contract. |
| **[L]** | `sources/plamen/rules/post-audit-improvement-protocol.md` | Post-audit improvement recommendations. |
| **[P]** | `sources/pashov/solidity-auditor/references/report-formatting.md` | Pashov's report format. |
| **[P]** | `sources/pashov/solidity-auditor/references/judging.md` | 4-gate severity judging rubric. |
| **[P]** | `sources/pashov/fizz/agents/report-writer.md` | Fuzz-campaign report writer. |
| **[O]** | `sources/omega/omega-audit-workflow/SKILL.md` | Report skeleton, filename-derived finding IDs, the four-level severity ladder with inline justification, and the six resolution statuses including `[resolved*]` for contingent mitigations. |

---

## Recon (pre-analysis)

Initial codebase sweep to build context for downstream agents.

| Source | File | Output |
|---|---|---|
| **[P]** | `sources/pashov/x-ray/SKILL.md` | `x-ray.md` + `architecture.json` + `architecture.svg` + `entry-points.md` + `invariants.md` + `git-security-analysis.json`. |
| **[L]** | `sources/plamen/prompts/<lang>/phase1-recon-prompt.md` | Per-language recon output (constraint variables, primitive status, fork ancestry, external dependency research). |
| **[L]** | `sources/plamen/rules/skill-index.md` | Skill loading map per language. |
| **[P]** | `sources/pashov/fizz/agents/protocol-analyzer.md` | Fallback when x-ray isn't available — produces `protocol-understanding.md` from raw source. |
