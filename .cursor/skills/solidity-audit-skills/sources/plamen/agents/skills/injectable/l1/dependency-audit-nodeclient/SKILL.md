---
name: "dependency-audit-nodeclient"
description: "L1 supplement - audits Go modules and Rust crates for known vulnerabilities, outdated versions, supply chain risks, and replace/patch directives."
---

# Injectable Skill: Node Client Dependency Audit

> **L1 trigger**: `L1_PATTERN=true` — always runs
> **Inject Into**: Recon + any breadth agent
> **Finding prefix**: `[DEP-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## When This Skill Activates

Always active in L1 mode. Extends Plamen's existing `dependency-audit` skill with Go/Rust-specific checks relevant to node clients.

## 1. Go Module Audit

### 1a. Version check
- Read `go.mod` — identify every `require` line
- Check against Go vulnerability database: `govulncheck ./...` (ships with Go 1.18+)
- Check against OSV: https://osv.dev/
- Check against GitHub advisories for each dep

### 1b. Replace directive audit
- `replace` directives in `go.mod` can redirect a dep to a fork or local path
- **Every `replace` is a trust statement**: the audit must identify what's being replaced with what, and whether the replacement is authentic
- Fork audits: the target likely has `replace` pointing to the parent client (e.g., `replace github.com/ethereum/go-ethereum => github.com/ethereum-optimism/op-geth v1.x.y`)
- Flag every `replace` with an explicit note in the finding

Tag: `[GO-REPLACE:{original}:{replacement}:{trust-note}]`

### 1c. vendor/ directory
- If the target uses `vendor/`, check if vendored code matches upstream. Modified vendored deps are a red flag.
- Run `go mod verify` if possible to check checksums

Tag: `[GO-VENDOR-DIFF:{module}]`

### 1d. Indirect dependency bloat
- Excessive transitive deps increase the attack surface
- For each `// indirect` line, ask: is the intermediate dep actually used?

## 2. Rust Cargo Audit

### 2a. Version check
- `cargo audit` (requires the cargo-audit tool; install with `cargo install cargo-audit`)
- Reads `Cargo.lock` against the RustSec advisory database (https://rustsec.org/)
- `cargo deny` for richer policy (denylist, license, trust)

### 2b. Patch directive audit
- `[patch.crates-io]` and `[patch."https://..."]` blocks in `Cargo.toml` and workspace root
- Same trust concern as Go `replace`: patches redirect deps
- Fork audits: likely patches pointing to parent client

Tag: `[RS-PATCH:{original}:{replacement}:{trust-note}]`

### 2c. Git dependencies
- `{ git = "https://..." }` in Cargo.toml bypasses crates.io review
- Pin to specific commit (`rev = "..."`) not branch; branches move
- For each git dep: is the commit SHA pinned? Is the repo authentic?

Tag: `[RS-GIT-DEP:{crate}:{rev-pinned}]`

### 2d. Workspace structure
- Multi-crate workspace: `workspace.members` lists crates
- Each workspace crate can have its own dependency set
- Run `cargo audit` at the workspace root, not per-crate

## 3. Supply Chain Red Flags

Patterns that warrant deeper review across both ecosystems:

1. **Typosquatting**: check for dep names that are one character off common names (e.g., `tokio-util` vs `tokio-utils`)
2. **Recently created deps with large version numbers**: `1.0.0` published 2 weeks ago is suspicious
3. **Deps maintained by a single individual with no org backing**: not a bug per se, but worth flagging for critical-path deps
4. **Deps with obvious abandonment signals**: last commit >2 years ago on a security-critical dep
5. **Deps with known compromises**: cross-reference against the `event-stream` / `ua-parser-js` / `xz-utils` class of events

Tag: `[SUPPLY-CHAIN:{dep}:{concern}]`

## 4. L1-Specific Critical Path Deps

These deps are security-critical for L1 clients and deserve extra scrutiny:

### Go L1 critical deps
- `github.com/ethereum/go-ethereum` (if fork)
- `github.com/cosmos/cosmos-sdk`
- `github.com/cometbft/cometbft`
- `github.com/libp2p/*`
- `github.com/holiman/uint256`
- `github.com/syndtr/goleveldb`
- Any crypto lib: `golang.org/x/crypto`, `github.com/consensys/gnark-crypto`

### Rust L1 critical deps
- `reth-*` crates (if fork)
- `alloy-*` (Ethereum types)
- `revm` (EVM impl)
- `libp2p`
- `blst` / `bls12_381`
- `secp256k1`
- `tokio` (async runtime)
- `rocksdb` (storage)
- `arkworks-*` (crypto)

For each of these in the target, report: version, whether it's current, any recent advisories.

## 5. Version Pinning Hygiene

- Exact pins (`1.2.3`) vs ranges (`^1.2`, `~1.2`): ranges allow drift on rebuild
- `Cargo.lock` in version control: required for reproducibility (applications always commit; libraries traditionally don't)
- `go.sum` in version control: required for reproducibility

Tag: `[VERSION-DRIFT:{dep}:{pin-status}]`

## 6. Output schema

- **Layer**: dependency
- **Bug class**: known-vuln / replace-trust / patch-trust / supply-chain / version-drift
- **Preferred evidence tags**: `[TOOL-PASS]` (govulncheck / cargo-audit output) > `[CODE-TRACE]`
- **Severity**: depends on the specific advisory; typically Low to Medium for outdated deps, High for active-vuln deps in critical path

## 6b. Known bug exemplars (v0.2 — Round 4 verified)

1. **BNB Chain bridge $100M+ loss (October 2022)** — root cause: unmaintained IAVL Merkle proof library consumed by the BNB bridge. Dragonberry-class verification flaw in the shared library. Single unmaintained dependency, catastrophic impact. [Halborn writeup](https://www.halborn.com/blog/post/explained-the-bnb-chain-hack-october-2022). **Skill catch point**: Section 3 — unmaintained cryptographic library flag. Last commit >2 years ago on a security-critical dep = automatic finding.

2. **Moonbeam / Astar / Acala shared `paritytech/frontier` bug (~$200M at risk, 2022-2023)** — single shared dependency blew up across 3 projects. The Immunefi $1M bugfix review covers the initial Moonbeam discovery; Zellic re-discovered the same class in Astar 18 months later after the library was patched. [Immunefi Moonbeam/Astar/Acala review](https://medium.com/immunefi/moonbeam-astar-and-acala-library-truncation-bugfix-review-1m-payout-41a862877a5b); [Zellic Astar](https://www.zellic.io/blog/finding-a-critical-vulnerability-in-astar/). **Skill catch point**: Section 4 — produce a reverse-dependency graph of the core crypto/VM libraries. Any library that, if compromised, would affect ≥2 L1/L2 networks is a critical-review target.

3. **Avalanche RFC6979 Decred library reuse (disputed, 2022)** — ava-labs/avalanchego used a Decred library for deterministic signing; cross-project library reuse where an upstream bug can leak into downstream consensus. [coingeek report](https://coingeek.com/researcher-publishes-ava-labs-avalanche-zero-day-vulnerability-says-entire-protocol-compromised/). **Skill catch point**: Section 4 — every upstream Go module with network/crypto/consensus relevance needs CVE-history and maintainer-response-time check.

## 7. Fallback if primitives unavailable

- Read `go.mod` and `go.sum` manually
- Read `Cargo.toml` and `Cargo.lock` manually
- Check https://osv.dev for each top-level dep
- Use `gh api` to check GitHub security advisories for each repo

## Cross-references

- Extends Plamen's existing `dependency-audit` skill
- Related: All L1 skills — deps are foundational
- Consumed by: recon agent, every breadth agent
