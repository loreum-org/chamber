---
name: "write-error-divergence"
description: "L1 trigger - audits file/database write paths for metadata commits, cache updates, and success returns that diverge when writes fail."
---

# Injectable Skill: Write Error Divergence

> **L1 trigger**: `STORAGE` or `DATABASE_TX` flag OR file/DB write APIs detected (`write_all`, `fs::write`, `rename`, `flush`, `commit`, `put`, `insert`, `batch`, `transaction`)
> **Inject Into**: `depth-state-trace`, `depth-edge-case`
> **Language**: Go and Rust
> **Finding prefix**: `[WED-N]`

## Purpose

Node clients often pair durable writes with in-memory metadata, indexes, caches, or database transactions. If metadata advances before the durable write succeeds, restart or reorg behavior can diverge from the actual persisted state.

## 1. Write Unit Enumeration

For each storage path, enumerate the logical write unit:

| Write Unit | Data Write | Metadata/Index Update | Error Check | Rollback/Cleanup | Verdict |
|------------|------------|-----------------------|-------------|------------------|---------|

Include:
- block/header/transaction persistence;
- cache metadata, expiry timestamps, indices, checkpoints, migration markers;
- database transactions and batches;
- file writes that use temp files, rename, flush, fsync, or parent-directory fsync.

## 2. Required Checks

For each write unit:
- **Metadata-before-data**: metadata, cache state, or checkpoint markers must not advance before the durable write succeeds.
- **Success-after-side-effect**: `Ok(())`, HTTP success, or actor success messages must be returned only after the write and required flush/commit complete.
- **Commit-before-check**: database transactions must not commit when the closure or inner operation returned an error.
- **Partial write**: short writes, interrupted writes, rename failures, flush/fsync failures, and parent-directory fsync failures must be handled consistently.
- **Rollback/cleanup**: failed writes must either roll back metadata or leave an explicit repair/retry marker.
- **Restart trace**: trace what a node observes after restart if the write fails at each boundary.

Tag evidence as `[WED-METADATA-BEFORE-DATA:{file}:{line}]`, `[WED-COMMIT-BEFORE-CHECK:{file}:{line}]`, `[WED-SUCCESS-BEFORE-WRITE:{file}:{line}]`, or `[WED-RESTART-DIVERGE:{file}:{line}]`.

## 3. Non-Finding Rules

Do not report internal best-practice issues unless a failed write can produce stale reads, corrupted state, replay, permanent data loss, fork-choice divergence, or a liveness failure after restart.

## 4. Output

Use normal finding format. If no finding exists, still emit the write-unit table with file:line evidence for each safe rollback or commit path.
