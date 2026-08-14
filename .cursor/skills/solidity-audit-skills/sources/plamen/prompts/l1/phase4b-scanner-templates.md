# L1 Phase 4B Scanner Templates

These templates cover L1/client subsystems when a driver, prompt, or role
requests the base scanner-template path. They are scoped to consensus clients,
P2P/RPC surfaces, storage/indexing, mempool/txpool behavior, serialization, and
runtime configuration.

## Scanner: Boundary and Wire Format

Use for codecs, wire types, RPC request parsing, gossip payloads, proof formats,
and disk/network serialization.

Check:
- Ambiguous or non-canonical encodings accepted as valid.
- Missing length/count/cap checks before allocation or iteration.
- Field defaults that produce valid-looking but unsafe messages.
- Version or domain-separation fields omitted from signed/hashable payloads.

Output findings with concrete file:line locations and a direct malformed input
or state transition that exercises the issue.

## Scanner: State Transition and Consensus Invariant

Use for fork choice, block/header validation, difficulty/weight scoring, finality,
checkpointing, and state-transition admission.

Check:
- Validation steps skipped on alternate entry points.
- State changes committed before all validation predicates pass.
- Non-deterministic ordering in consensus-critical data structures.
- Arithmetic truncation, saturation, or overflow changing consensus decisions.

## Scanner: Network Amplification and Resource Exhaustion

Use for P2P handlers, RPC methods, task spawning, broadcast loops, caches,
mailboxes/channels, peer scoring, and rate limits.

Check:
- Attacker-controlled request causing asymmetric CPU, IO, memory, or fanout work.
- Unbounded maps, queues, channels, cache keys, or pending-request trackers.
- Retry/re-gossip loops that amplify invalid or duplicate data.
- Slow-path cryptography, decompression, proof verification, or database scans
  reachable before cheap reject checks.

## Scanner: Lifecycle, Cache, and Recovery

Use for expiry/eviction, restart/resume, bad-peer tracking, disk flush/fsync,
snapshotting, and crash recovery.

Check:
- Invalid data retained after rejection.
- Expiry timestamps not refreshed or never checked.
- Partial writes treated as committed on restart.
- Recovery paths skipping validation performed on the normal path.

## Sibling Propagation Agent

**FIRST ACTION**: Use the Write tool to create
`{SCRATCHPAD}/sibling_propagation_findings.md` with a one-line header
`# Sibling Propagation Findings`. This reserves your write budget so the file
exists on disk even if your analysis is interrupted.

After finding one bug class, scan sibling entry points with the same fix pattern.
Keep siblings separate only when the fix or exploit precondition differs.
Otherwise mark them as duplicates/consolidation candidates.

## Scanner: Design Stress

For each plausible finding, ask whether the issue is a local bug or a protocol
design gap. Record the minimum external preconditions and whether one honest node,
one malicious peer, one RPC caller, or a network partition can trigger it.

SCOPE: Write ONLY to the assigned scanner output file. Do NOT read or write other
agents' output files. Do NOT proceed to verification, report indexing, body
writing, or assembly. Return and stop.
