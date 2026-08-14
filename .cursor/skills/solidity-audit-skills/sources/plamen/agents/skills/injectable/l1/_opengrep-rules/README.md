# L1 Opengrep Rule Pack

> **Status**: v0.1 starter pack, 3 seed rules
> **Target**: [Opengrep](https://github.com/opengrep/opengrep) — LGPL-2.1 fork of Semgrep with cross-function intra-file taint
> **MCP wrapper**: `custom-mcp/opengrep-mcp/` exposes `opengrep_scan`, `opengrep_validate`, `opengrep_test`, `opengrep_version` as MCP tools

This directory contains the Opengrep rule pack for the L1 audit mode. Rules live as individual `.yaml` files. The Phase 0.5 Bake step invokes Opengrep via the MCP wrapper:

```python
# From a depth agent or orchestrator
opengrep_scan(
    rule_path="~/.claude/agents/skills/injectable/l1/_opengrep-rules/",
    target_path="{PROJECT_PATH}",
    output_format="sarif",  # default — feeds the T2 SARIF merge harness
)
```

Shell equivalent:

```bash
opengrep scan --config agents/skills/injectable/l1/_opengrep-rules/ \
  --sarif --quiet <target-path> > {scratchpad}/opengrep_hits.sarif
```

Agent L1-3 (from `prompts/l1/phase1-recon-prompt.md`) reads the SARIF output and ranks findings per rule.

## Validation and testing (rule-pack CI)

Before adding new rules, validate the pack:

```bash
# Syntactic validation (no scan)
opengrep validate --config agents/skills/injectable/l1/_opengrep-rules/

# Unit tests against annotated fixtures
opengrep test --config agents/skills/injectable/l1/_opengrep-rules/
```

**Fixture convention** (Semgrep OSS compatible, per Round 5 research):

For rule `go-integer-underflow-p2p.yaml`, create a sibling fixture file `go-integer-underflow-p2p.go`:

```go
package fixture

func GetHeadersFrom_vulnerable(count uint64) []uint64 {
    // ruleid: plamen-l1-go-integer-underflow-p2p-count
    for i := uint64(0); i < count - 1; i++ {
        _ = i
    }
    return nil
}

func GetHeadersFrom_fixed(count uint64) []uint64 {
    if count == 0 {
        return nil
    }
    // ok: plamen-l1-go-integer-underflow-p2p-count
    for i := uint64(0); i < count - 1; i++ {
        _ = i
    }
    return nil
}
```

`ruleid:` marks lines that MUST match; `ok:` marks benign variants that MUST NOT. `opengrep test` passes iff both invariants hold.

**MCP wrapper equivalents** (invoked from within a depth agent):

```python
opengrep_validate(rule_path="~/.claude/agents/skills/injectable/l1/_opengrep-rules/")
opengrep_test(rule_path="~/.claude/agents/skills/injectable/l1/_opengrep-rules/")
```

## Starter rules (v0.1)

| Rule ID | Language | Bug class | Pattern |
|---|---|---|---|
| `plamen-l1-go-integer-underflow-p2p-count` | Go | p2p-dos (integer underflow) | `count - 1` where `count uint64` is attacker-controlled. Geth CVE-2024-32972 pattern. |
| `plamen-l1-go-panic-in-endblocker` | Go | consensus-safety (panic chain halt) | `panic()`, unchecked division, unchecked index in BeginBlock/EndBlock/PreBlock. Cosmos ASA-2025-003 / ISA-2025-002 class. |
| `plamen-l1-rust-unwrap-in-preauth` | Rust | pre-auth panic (single-packet node kill) | `.unwrap()` / `.expect()` / `panic!()` in handshake / verify / signature-recovery paths. NEAR Ping of Death class. |

## Adding new rules

Each rule MUST include:

- `metadata.skill`: which L1 skill this rule supports
- `metadata.cve-reference` or `metadata.reference`: real public reference
- `metadata.bug-class`: matches one of the skill output classes
- `metadata.plamen-tag`: the `[TAG:...]` format used in finding output

Rules must be grounded in real bugs. Fabricated patterns ("wouldn't it be nice if...") do not belong here — per the post-audit-improvement-protocol rule on methodology over patterns.

## Known limitations (v0.1)

1. **Opengrep intra-file taint is a superset of Semgrep OSS** but not a replacement for Semgrep Pro inter-file taint. Some L1 bugs (notably the Frontier cross-env truncation class) need multi-file taint that neither tool provides for free. For those, depth agents stitch intraprocedural hits via the SCIP index.
2. **Rust patterns are less mature than Go** in both Opengrep and its Semgrep baseline. Rule authors should verify rules against fixtures in `_opengrep-rules/fixtures/` (not yet created).
3. **Fixtures**: the rule pack has no unit tests yet. Week 2 of Phase 1 should add a `fixtures/` directory with positive and negative cases drawn from the benchmark corpus.

## Expansion plan (Week 3 per design.md Section 10)

Target: 15-25 rules by end of Week 3.

New rules to add, grouped by skill:

- **`consensus-safety-invariants`**:
  - Go map iteration in state-mutating path
  - Rust HashMap iteration in VM path (Aptos-class)
  - Goroutine-order-dependent code in consensus
  - Float math in vote weighting
- **`fork-choice-audit`**:
  - State replay on stale attestation (Prysm Fusaka pattern)
- **`p2p-dos-and-eclipse`**:
  - Decoder with no max-size limit
  - Peer scoring with unsafe integer arithmetic
- **`mempool-asymmetric-dos`**:
  - Invalid-but-accepted transaction pattern
  - RBF with missing cumulative fee bump
- **`light-client-proof-verification`**:
  - SSZ offset read without contiguity check (Ghost in Block pattern)
  - Merkle proof verification without length bounds
- **`rpc-surface-audit`**:
  - Unauthenticated expensive RPC method
  - GraphQL without depth limit (CVE-2023-42319 pattern)
- **`bls-aggregation-audit`**:
  - BLS verify without subgroup check
  - Aggregation without PoP enforcement
- **`cross-environment-semantic-drift`**:
  - u256 → u128 narrowing without validation (Frontier pattern)
  - Precompile without CALL/DELEGATECALL check (Moonbeam pattern)
- **`validator-lifecycle-and-slashing`**:
  - Slashing without double-slash protection
  - Re-delegation within evidence window
- **`hardfork-activation-and-protocol-upgrade`**:
  - `if chain.IsXxx(block)` without spec-matching behavior

Each Week 3 rule should cite a specific exemplar from the skill's Known Exemplars section.
