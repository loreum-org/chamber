# L1 Generic Security Rules

Use these rules for Layer-1/client audits across consensus, networking, storage,
RPC/API, mempool/txpool, and runtime configuration.

## Core Rules

- Validate cheap predicates before expensive work.
- Treat network, RPC, disk, CLI, and config inputs as attacker-controlled unless
  the audit scope explicitly proves otherwise.
- Consensus-critical behavior must be deterministic across platforms, restarts,
  map iteration orders, and equivalent encodings.
- Hashes and signatures require explicit domain separation, versioning, and
  canonical serialization.
- Cache entries need bounded capacity, expiry, invalidation, and restart-safe
  semantics.
- Recovery paths must re-apply the same validation invariants as normal paths.
- Any panic, unwrap, expect, assertion, or abort reachable from malformed external
  input is at least a DoS candidate.
- Severity must be Impact x Likelihood; do not inflate panic-only DoS above the
  matrix without a client-critical liveness argument.

## Evidence Rules

- Prefer mechanical evidence: PoC, differential, conformance, non-determinism, or
  fuzz result.
- `[CODE-TRACE]` alone is not enough to confirm Critical/High L1 findings.
- If a cited location is wrong or unverifiable, mark the finding
  `LOCATION_INVALID` rather than repairing it by inference.
