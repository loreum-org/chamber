# Phase 1: L1 Recon Agent Prompt Template

> **Usage**: Orchestrator reads this file and spawns L1 recon agents with these prompts.
> Replace `{path}`, `{scratchpad}`, `{docs_path_or_url_if_provided}`, `{scope_file_if_provided}` with actual values.
>
> **L1 mode differences from smart-contract recon**: L1 recon is **threat-model-first, not surface-first**. Where smart-contract recon enumerates contracts and functions, L1 recon enumerates **actors, trust boundaries, subsystems, and layer decomposition**. Sigma Prime's core-node-security methodology budgets 1-3 weeks on threat modeling alone for a Reth audit — Plamen L1 recon runs a compressed version of that in parallel.
>
> **ORCHESTRATOR SPLIT DIRECTIVE**: L1 recon splits into **3 parallel agents** (Phase 0.5 Bake runs before spawning recon):
>
> | Agent | Tasks | Model |
> |-------|-------|-------|
> | **L1-1: Threat Model + Fork Ancestry** | TASK 0, TASK 1, TASK 2 | opus |
> | **L1-2: Subsystem Map + Attack Surface** | TASK 3, TASK 4, TASK 5 | opus |
> | **L1-3: Primitive Bake Validation + Opengrep Sweep + Test Infra** | TASK 6, TASK 7, TASK 8 | sonnet |
>
> **Note**: There is NO Agent 1A RAG in L1 mode. The RAG for L1 bug classes is thin; Round 4 research showed most L1 exemplars come from GitHub security advisories, not vuln-db MCP. The Phase 4b.5 RAG Validation Sweep still runs to compensate.
>
> Agent L1-1 writes: `threat_model.md`, `fork_ancestry.md`, `trust_boundaries.md`
> Agent L1-2 writes: `subsystem_map.md`, `attack_surface.md`, `integration_points.md`, `scope_leftover.md`
> Agent L1-3 writes: `bake_validation.md`, `opengrep_hits.json`, `test_infrastructure.md`
> Orchestrator writes: `primitive_status.md` (from Phase 0.5 output + Agent L1-3 validation), `recon_summary.md`

## Phase 0.5 Bake prerequisite

**Before ANY recon agent spawns**, the orchestrator MUST complete Phase 0.5 Bake:

```bash
# Detect language(s)
LANG=$(detect_language {path})

# Go: produce SCIP index
if [[ "$LANG" == *go* ]]; then
  cd {path} && scip-go --module-root=. --module-version=audit-session
  cp index.scip {scratchpad}/scip_go.index
fi

# Rust: produce SCIP index
if [[ "$LANG" == *rust* ]]; then
  cd {path} && rust-analyzer scip . --exclude-vendored-libraries
  cp index.scip {scratchpad}/scip_rust.index
fi

# Opengrep baseline scan
opengrep --config ~/.claude/agents/skills/injectable/l1/_opengrep-rules/ \
  --json {path} > {scratchpad}/opengrep_hits.json

# Record primitive status
cat > {scratchpad}/primitive_status.md <<EOF
# Primitive Status (Phase 0.5 Bake)
- Language: $LANG
- SCIP Go index: {scratchpad}/scip_go.index ($(du -h {scratchpad}/scip_go.index 2>/dev/null || echo "N/A"))
- SCIP Rust index: {scratchpad}/scip_rust.index ($(du -h {scratchpad}/scip_rust.index 2>/dev/null || echo "N/A"))
- Opengrep hits: $(jq '. | length' {scratchpad}/opengrep_hits.json 2>/dev/null || echo "0") findings
- ast-grep: available
EOF
```

If any step fails, record the failure in `primitive_status.md` and continue with fallback flags set. The recon agents will degrade gracefully.

## Agent prompt template

```
Task(subagent_type="general-purpose", prompt="
You are L1 Recon Agent #{N}.

PROJECT_PATH: {path}
SCRATCHPAD: {scratchpad}
DOCUMENTATION: {docs_path_or_url_if_provided}
SCOPE: {scope_file_if_provided}
LANGUAGE: {language from Phase 0.5 detection}

## RESILIENCE RULES (apply to ALL tasks)
1. MCP/tool failure → record in output file, CONTINUE to next task. No retries >1.
2. Web search failure → note UNAVAILABLE, CONTINUE.
3. Write-first: write partial results before slow calls. Partial recon > no recon.
4. No task is blocking.

Execute your assigned tasks IN ORDER.

## TASK 0: Protocol / client identification [Agent L1-1]

Classify the target:

| Target type | Indicators |
|---|---|
| **Go execution client** | `core/`, `eth/`, `p2p/`, `miner/`, `ethclient`, `go-ethereum` fork markers |
| **Rust execution client** | `crates/`, `revm`, `reth-*`, `alloy-*` |
| **Go consensus client (CometBFT/Cosmos)** | `cometbft`, `tendermint`, `cosmos-sdk`, `x/` modules |
| **Rust consensus client (Lighthouse/Teku)** | `beacon-chain/`, `lighthouse`, `ethereum-consensus`, `ssz-rs` |
| **Solana validator** | `solana-labs/solana`, `agave`, `svm`, `runtime/` |
| **Polkadot / Substrate** | `paritytech/substrate`, `frontier`, `polkadot-sdk` |
| **Storage / data-availability chain** | `chunk_provider`, `data_root`, `publish_ledger`, `submit_ledger`, `partition_assignment`, `recall_range`, `ingress_proof`, `proof_of_access`, Arweave/Celestia-class fork markers |
| **Custom / research client** | anything else |

Record the classification in `threat_model.md` with reasoning.

If the target is classified as a storage / data-availability chain, set the `DATA_AVAILABILITY` flag in `recon_summary.md` so Phase 2 instantiation loads the `data-availability-enforcement` injectable skill into the consensus depth agent.

If the project manifest (`go.mod` / `Cargo.toml`) requires the Cosmos-SDK / CometBFT framework — `cosmossdk.io/...`, `github.com/cosmos/cosmos-sdk`, `github.com/cometbft/cometbft`, `github.com/tendermint/tendermint` — or the tree has the canonical `x/<module>/{keeper,types}` + `module.go` / `abci.go` layout, set `COSMOS_SDK=true` in the `recon_summary.md` subsystem-flags line (and `IBC=true` if `github.com/cosmos/ibc-go` is present), mirroring the `DATA_AVAILABILITY` pattern above. This loads the `cosmos-sdk-module-safety` injectable skill into the consensus and state-trace depth agents. The mechanical pre-pass already seeds these flags from the manifest; recon MUST confirm/keep them rather than dropping them.

### TASK 0 Step 1: Threat model layout

Fill in the threat model using the Sigma Prime 8-layer framework:

| Layer | Present? | Scope | Key files/modules |
|---|---|---|---|
| Networking (P2P / discovery) | | | |
| Consensus (fork choice / finality) | | | |
| Execution (VM / state transition) | | | |
| Storage (state / trie / DB) | | | |
| Cryptography (signatures / hashes) | | | |
| RPC / API surface | | | |
| Mempool / tx pool | | | |
| Light client / cross-chain | | | |

For each layer marked Present, identify 3-5 key files/modules. Use SCIP `workspace/symbol` queries via `plamen_l1.scip_reader` if a SCIP index is available; otherwise grep the project tree.

### TASK 0 Step 2: Actor enumeration

List every actor that can send bytes to the target:

| Actor | Authority | Attack surface | Trust assumption |
|---|---|---|---|
| Anonymous peer | none | p2p handshake, discovery | fully untrusted |
| Post-auth peer | peer-id only | all p2p messages | byzantine possible |
| Validator | stake | consensus messages, votes | up to 1/3 byzantine |
| RPC client (public) | none | JSON-RPC methods, WebSocket | untrusted |
| RPC client (JWT) | shared secret | Engine API | semi-trusted (EL/CL pair) |
| Sequencer (rollups) | designated | rollup inputs | typically trusted in Phase 1 |

### TASK 0 Step 3: Trust boundaries

For each pair of adjacent actors / layers, state the trust boundary explicitly:

- 'Anonymous peer → pre-auth handshake code': untrusted bytes, any panic = node kill
- 'Post-auth peer → message decoder': authenticated but byzantine-possible
- 'Validator stake → fork-choice head selection': stake-weighted trust
- 'JWT-holder → Engine API': shared-secret, trusted within EL/CL pair
- ...

Write to `trust_boundaries.md`.

## TASK 1: Fork ancestry detection [Agent L1-1]

Determine whether the target is a fork of a known base client.

### Go detection
- Read `go.mod` `replace` directives for redirections to known upstreams (e.g., `github.com/ethereum/go-ethereum => github.com/optimism-labs/op-geth`)
- Check `.git/config` for upstream remotes beyond origin
- Scan `README.md` / `CHANGELOG.md` for 'fork of', 'based on', 'upstream'

### Rust detection
- Read `Cargo.toml` `[patch.crates-io]` and `[patch.\"https://...\"]` blocks
- Check git history (`git log --oneline | head -100`) for merge commits from external remotes
- Scan manifests for path dependencies pointing outside the workspace

### Output

Write `fork_ancestry.md`:

```markdown
## Fork Ancestry

- Detected: [yes/no/uncertain]
- Parent client: [name or 'none']
- Parent repo: [URL if known]
- Diff baseline: [commit SHA or tag]
- Diff size: [LOC or file count]

## If fork: diff targeting
Commands to produce the relevant diff for depth agents:
  git diff <parent-ref>...<current-ref> -- <key-subsystem-path>
```

Set `IS_FORK=true|false` in recon_summary.md.

### TASK 1 note: Differential audit for forks

When `IS_FORK=true` and an upstream baseline is identifiable (OP-Geth, op-reth, cosmos-sdk, CometBFT, reth, go-ethereum, or any named parent), frame the depth pass as a DIFFERENTIAL audit, not a from-scratch audit. The unchanged base client is presumed reviewed upstream; the bug surface is the DELTA plus the integration seams where the fork's changes meet the base.

- Record the diff baseline (commit/tag) and the `git diff <parent-ref>...<current-ref>` command per key subsystem in `fork_ancestry.md` (the "If fork: diff targeting" block above).
- In the subsystem map / attack-surface output, mark which files/functions are DELTA (modified or added vs upstream) and which are INTEGRATION POINTS (call across the fork↔base boundary). Steer depth-agent attention to those, not to unchanged base code.
- Constant changes (epoch length, slots/epoch, max validators, slashing penalties, gas/fee params) introduced by the fork are first-class DELTA targets — each requires justification.
- This is a steering note only; do NOT disturb the COSMOS_SDK / IBC subsystem-flag handling above.

## TASK 2: Documentation ingestion [Agent L1-1]

If DOCUMENTATION path/URL is provided, extract:
- Stated consensus algorithm
- Stated trust assumptions (permissioned? permissionless? validator set size?)
- Stated threat model
- Stated out-of-scope items

Cross-check against the code: does the threat model in `threat_model.md` match the docs? Divergences are findings for `spec-compliance-audit` niche agent.

## TASK 3: Subsystem map [Agent L1-2]

For each layer identified in TASK 0 Step 1, build a subsystem map using SCIP `workspace/symbol` queries.

### Example queries (Go)
- `workspace_symbol('Handler')` → message handlers
- `workspace_symbol('Service')` → service implementations
- `workspace_symbol('BeginBlock')` → BeginBlocker entry points
- `workspace_symbol('EndBlock')` → EndBlocker entry points
- `workspace_symbol('handlePayload')` → execution hooks

### Example queries (Rust)
- `workspace_symbol('Engine')` → engine API impls
- `workspace_symbol('NetworkHandle')` → network manager
- `workspace_symbol('Payload')` → payload builders

For each match, record: file:line, symbol kind, containing layer. Write to `subsystem_map.md`:

```markdown
## Subsystem Map

### Consensus Layer
| Symbol | File:Line | Kind | Description |
|---|---|---|---|

### Network Layer
...
```

## TASK 4: Attack surface by layer [Agent L1-2]

Apply the OpenZeppelin 10-point checklist to the discovered subsystems:

1. Non-deterministic behaviors (map iter, time, float)
2. DoS vectors (unbounded loops, spam)
3. Execution client hardening (memory, RPC, P2P, MEV)
4. Data availability resilience
5. Dependency freshness
6. Block production efficiency
7. Access controls
8. Language-specific traps (Go concurrency, Rust unsafe)
9. Economic security / tokenomics
10. Integration points with other components

For each point, identify the specific code path to review and which L1 skill applies. Write to `attack_surface.md`:

```markdown
## Attack Surface by Layer

### Layer: consensus
- Concern: non-determinism in fee calculation
  - Code path: `types/fee_statement.go:ComputeGasUsed`
  - Skill to apply: `consensus-safety-invariants` (Section 1a)
  - Evidence from recon: [found map iteration at line 45]
  - Bug class: non-determinism

- Concern: panic in BeginBlocker
  - Code path: `x/group/keeper/abci.go:BeginBlocker`
  - Skill to apply: `consensus-safety-invariants` (Section 2 nuance)
  - ...
```

## TASK 5: Integration points [Agent L1-2]

Before TASK 5, write `scope_leftover.md` enumerating in-scope files not
clearly covered by any declared subsystem or planned layer scope.

Output format:

```markdown
| File | LOC | Reason | Acknowledged |
|------|-----|--------|--------------|
| crates/c/foo.c | 406 | language-mismatch | ACKNOWLEDGED: LANGUAGE_LANE_NOT_DETECTED |
```

Use `Acknowledged` only when the omission is intentional and explainable.

Also write `file_coverage_ledger.md` — a per-file coverage record the driver's
recon coverage gate consumes. List every in-scope source file (by the language's
primary extensions — `.go`, `.rs`, `.sol`, `.move`) and state whether it is
cited in ANY recon artifact (`recon_summary.md`, `subsystem_map.md`,
`attack_surface.md`, `integration_points.md`, `opengrep_hits_ranked.md`,
`function_list.md`, `state_variables.md`, `threat_model.md`, `trust_boundaries.md`,
`detected_patterns.md`, `contract_inventory.md`) OR explicitly acknowledged in
`scope_leftover.md` as `ACKNOWLEDGED: ...`.

Output format:

```markdown
## File Coverage Ledger

Total in-scope files: 412
Cited by recon: 287 (69.6%)
Acknowledged leftovers: 94 (22.8%)
Uncovered: 31 (7.5%)

### Uncovered Files (MUST resolve before depth)
| File | LOC | Top-Level Module | Proposed Action |
|------|-----|------------------|-----------------|
| eth/downloader/skeleton.go | 420 | eth | ADD citation under attack_surface.md: consensus |
| crates/txpool/src/pool.rs | 680 | txpool | ALREADY cited via opengrep_hits_ranked — verify path match |

### Module Coverage Summary
| Top-Level Module | Files | Cited | Acknowledged | Uncovered |
|------------------|-------|-------|--------------|-----------|
| eth              | 145   | 112   | 28           | 5         |
| txpool           | 48    | 48    | 0            | 0         |
| crypto           | 22    | 5     | 0            | 17        |
```

**Coverage invariant**: For any top-level module with ≥10 source files, at
least ONE file in that module must be cited OR the whole module must be
ACKNOWLEDGED in `scope_leftover.md`. Whole-module invisibility is the
class of recon miss Heimdallr (arxiv 2601.17833) identifies as the dominant
LLM-audit failure mode. The driver's `_validate_recon_coverage` gate will
fail the recon phase if this invariant breaks, so write the ledger before
returning.

Enumerate external dependencies with security implications:

- Cryptography libraries (crypto, blst, secp256k1, arkworks)
- Storage engines (leveldb, rocksdb, mdbx)
- Network libraries (libp2p, devp2p, quinn)
- Serialization (rlp, ssz, protobuf, borsh)
- Language runtime (tokio, goroutine)

For each, record: version, last-updated, known CVEs, cross-reference with `dependency-audit-nodeclient` skill. Write to `integration_points.md`.

**Generic widening (EXTERNAL_DEPENDENCY, non-brand mechanical trigger)**: the
5 categories above are a fixed, closed list and miss any OTHER external
crate/package/module the client depends on. Also flag `EXTERNAL_DEPENDENCY`
(alias: also sets `NAMED_EXTERNAL_PROTOCOL`, kept for parity with the SC
pipelines' ledger format) for ANY imported dependency where: (a) its
implementation is NOT vendored in-repo, (b) it is NOT part of the language's
own standard library, AND (c) its return value/output is consumed on a
security-relevant path (validation, signature/hash verification, state
transition, message/block parsing). This is structural, never a specific
crate name — the point is to catch dependencies outside the 5 named
categories, not to re-list more brands.

### External Dependency Research Ledger (MANDATORY)

You are the ONLY phase with live WebSearch AND full attack-surface knowledge
of every external dependency. depth-phase workers (`depth-consensus-invariant`,
`depth-network-surface`, `depth-external`, etc.) run with
`--disallowedTools mcp__*` and no live web tools — they can only READ the
ledger you bake here. Do the research now, not later.

For EVERY dependency flagged above (named category or generic
`EXTERNAL_DEPENDENCY`), write one row to
`{SCRATCHPAD}/external_dependency_research.md`:

| Dependency | Integration Surface | Assumed Behavior | Real Behavior | Source | Conformance | Fetch Status |
|------------|----------------------|-------------------|-----------------|--------|-------------|---------------|

- **Dependency**: crate/package/module name.
- **Integration Surface**: ALL call sites, `file:line`, comma-separated.
- **Assumed Behavior**: what the calling code assumes, as coded.
- **Real Behavior**: researched real semantics (WebSearch — release notes,
  changelogs, known-CVE advisories, upstream docs).
- **Source**: URL + fetch date (`fetched {DATE}`).
- **Conformance**: `MATCH` / `MISMATCH` (flag for depth) / `CHECK`.
- **Fetch Status**: `OK`, or `FETCH_FAILED:{reason}`.

**Never drop a row.** A failed lookup still gets a row with `Fetch Status:
FETCH_FAILED:{reason}` and `Conformance: CHECK` — carried forward, never
silently omitted.

Write to `{SCRATCHPAD}/external_dependency_research.md`. If NO dependencies
are in scope, still write the file with only the header row.

## TASK 6: Bake validation [Agent L1-3]

Read `{scratchpad}/primitive_status.md` from Phase 0.5. Verify:

- SCIP index file(s) exist and are >0 bytes
- `scip_reader.stats()` returns sensible counts (non-zero documents, non-zero symbols)
- ast-grep runs successfully on one sample file
- Opengrep hit list file exists

If any primitive failed, document the fallback state in `bake_validation.md`:

```markdown
## Bake Validation

- SCIP Go index: [OK | FAILED - reason]
- SCIP Rust index: [OK | FAILED - reason]
- ast-grep: [OK | FAILED - reason]
- Opengrep: [OK | FAILED - reason]

## Fallback flags
- PRIMITIVE_FALLBACK_GO: [false | true]
- PRIMITIVE_FALLBACK_RUST: [false | true]
```

## TASK 7: Opengrep sweep analysis [Agent L1-3]

Read `{scratchpad}/opengrep_hits.json`. Group findings by rule, rank by confidence, deduplicate near-duplicates. Write a ranked hit list to `opengrep_hits_ranked.md` that the depth agents can consume directly:

```markdown
## Opengrep Ranked Hits

### Rule: go-integer-underflow-p2p (3 hits, high confidence)
1. `eth/protocols/eth/handler.go:245` — `GetHeadersFrom(number, count-1)` with count from peer input
   - Applies skill: `mempool-asymmetric-dos` + `p2p-dos-and-eclipse`
   - CVE class: CVE-2024-32972 pattern
   ...
```

Set `L1_PATTERN=true` in recon_summary.md if any hits fired on L1-specific rules.

## TASK 8: Test infrastructure discovery [Agent L1-3]

Discover the project's test infrastructure so Phase 5 verifiers can write executable PoCs.

### Step 1: Locate test modules and directories

```bash
# Rust
find {path} -name "*.rs" -path "*/tests/*" -o -name "*.rs" | xargs grep -l "#\[cfg(test)\]" 2>/dev/null | head -50
find {path} -name "*.rs" | xargs grep -l "#\[test\]" 2>/dev/null | head -50

# Go
find {path} -name "*_test.go" | head -50
```

### Step 2: Extract test constructors (mock builders)

Search for common test utility patterns:

**Rust patterns**:
- `fn testing()` / `fn default()` on config/state types
- `fn new_mock*()` / `fn mock_*()` / `fn test_*()` in public APIs
- `impl Default for` on domain types used in tests
- `#[cfg(test)]` modules with pub helper functions
- Dev-dependencies in Cargo.toml (`proptest`, `tokio-test`, `test-*`, `mock-*`)

**Go patterns**:
- `func New*ForTest(` / `func Mock*(` / `func Test*(t *testing.T,`
- `_test.go` files with exported helper functions
- `testutil/` or `testhelper/` packages
- Test dependencies in go.mod (testify, gomock, etc.)

For each constructor found, record: function signature, crate/package, what it builds.

### Step 3: Identify working build/test commands

Attempt (in order, stop at first success):
```bash
# Rust workspace
cargo test --no-run 2>&1 | tail -5  # confirms compilation
# If that fails, try per-crate:
cargo test -p {largest_domain_crate} --no-run 2>&1 | tail -5

# Go
go test ./... -count=0 2>&1 | tail -5  # dry-run compile check
```

Record which command succeeds and which crates/packages have compilable tests.

**Rust fuzzer availability probe** (Rust lanes only): run `cargo +nightly fuzz --version`.
If it succeeds, record `cargo_fuzz_available: true`; if it fails (cargo-fuzz not
installed, or no nightly toolchain), record `cargo_fuzz_available: false`. This gates
Thorough-mode libFuzzer fuzz campaigns; the verifier falls back to proptest, then
boundary-value parameterized tests, when false. Mirrors the EVM/Solana medusa/trident
availability probe pattern.

### Step 4: Extract representative test patterns (3 examples)

From the discovered test files, extract 3 representative test functions that demonstrate:
- How setup is done (which constructors are called)
- How assertions are structured
- The import pattern

These serve as templates for the verifier to crib from.

### Output

Write `{SCRATCHPAD}/test_infrastructure.md`:

```markdown
# Test Infrastructure

## Build Commands
- Workspace test: `{command that works}`
- Per-crate test: `cargo test -p {crate} -- --nocapture`
- **cargo_fuzz_available**: true/false (`cargo +nightly fuzz --version` probe, Rust lanes; gates Thorough-mode libFuzzer fuzzing — proptest fallback if false)

## Test Constructors (public mock builders)
| Constructor | Crate/Package | Signature | What It Builds |
|-------------|---------------|-----------|----------------|
| `ConsensusConfig::testing()` | consensus-domain | `fn testing() -> Self` | Default consensus config |
| ... | ... | ... | ... |

## Test Utility Crates/Packages
| Crate/Package | Purpose | Key Exports |
|---------------|---------|-------------|
| test-utils | Shared test helpers | `mock_block()`, `test_env()` |

## Dev Dependencies (fuzzing/property-testing)
- proptest = "1.x" (in {crate} dev-deps)
- tokio-test (in {crate} dev-deps)

## Existing Test Patterns (3 representative examples)
### Example 1: {crate}/tests/{file}:{line}
```rust
// paste the test function (trimmed to key setup + assert)
```
**Setup pattern**: Uses `Config::testing()` + `Env::default()`
**Assert pattern**: `assert_eq!` on return value

### Example 2: ...
### Example 3: ...

## Coverage Summary
- Total test files found: {N}
- Crates with tests: {list}
- Crates WITHOUT tests: {list}
- Fuzz targets found: {N} (in fuzz/ directory)
```


## Return protocol

### Pre-DONE coverage gate (MANDATORY — run before returning DONE)

Before returning DONE, enumerate EVERY top-level module/crate that contains
≥10 source files (by the language's primary extensions — `.go`, `.rs`, `.sol`,
`.move`). For EACH such module, confirm exactly ONE of:

1. **CITED** — at least one file from that module is cited in some recon
   artifact (`recon_summary.md`, `subsystem_map.md`, `attack_surface.md`,
   `integration_points.md`, `opengrep_hits_ranked.md`, `function_list.md`,
   `state_variables.md`, `threat_model.md`, `trust_boundaries.md`,
   `detected_patterns.md`, `contract_inventory.md`), OR
2. **ACKNOWLEDGED** — the whole module is recorded in `scope_leftover.md` as
   `ACKNOWLEDGED: <reason>`.

A module with ≥10 files that is neither cited nor acknowledged (e.g.
"crates/database 17 files not cited") will FAIL the driver's
`_validate_recon_coverage` gate and force a recon retry. Resolve every such
module — add a citation or an `ACKNOWLEDGED:` row to `scope_leftover.md` — and
confirm the `### Module Coverage Summary` table in `file_coverage_ledger.md`
shows `Uncovered = 0` for every module with ≥10 files BEFORE returning DONE.

Return ONLY: `DONE: L1 Recon Agent {N}` (max 1 line).
")
```

## Orchestrator post-recon merge

After Agents L1-1, L1-2, L1-3 complete, the orchestrator writes `recon_summary.md`:

```markdown
# L1 Recon Summary

- Target: [client name + version]
- Language(s): [go/rust/mixed]
- Is fork: [true/false, parent if true]
- Layers present: [list from TASK 0 Step 1]
- L1_PATTERN: true
- Subsystem flags: CONSENSUS=true, P2P=true, MEMPOOL=true, LIGHT_CLIENT=false, RPC=true, BLS=true, STATE_SYNC=true, EXECUTION=true, XENV=false, VALIDATOR_LIFECYCLE=true, HARDFORK=true, COSMOS_SDK=false
- Primitives: [status from bake_validation.md]
- Opengrep baseline hits: [count]
- Test infrastructure: [status from test_infrastructure.md — OK/PARTIAL/MISSING]
- Skills to load in Phase 3: [list of L1 skill names matching enabled subsystem flags]
- Depth agents to spawn in Phase 4b: [depth-consensus-invariant, depth-network-surface, depth-state-trace, depth-external, depth-edge-case]
```

Phase 2 instantiation reads this file and spawns breadth agents ONE PER LAYER (not one per file cluster, as in smart-contract mode). See `docs/l1-mode/design.md` Section 4.2 Phase 3 row.
