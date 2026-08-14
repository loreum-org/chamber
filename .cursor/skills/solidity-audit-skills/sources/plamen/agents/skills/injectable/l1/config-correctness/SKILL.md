---
name: "config-correctness"
description: "L1 trigger - audits configuration constants, documented bounds, feature-gated values, and unused protocol limits for semantic drift."
---

# Injectable Skill: Config Correctness

> **L1 trigger**: `L1_PATTERN=true` AND (`config/` OR `settings` OR `constants` OR `DEFAULT_` OR `MAX_` OR `MIN_` OR protocol docs/comments detected)
> **Inject Into**: `depth-edge-case`, `depth-state-trace`
> **Language**: Go and Rust
> **Finding prefix**: `[CFG-N]`

## Purpose

Configuration bugs are often single-line semantic drift: a limit exists but is not used, a default is testnet-only but ships in production, a doc comment says one bound while code enforces another, or a feature flag changes protocol-visible enum values. This skill is a bounded enumeration pass, not a new agent.

## 1. Configuration Inventory

Build a table of security-relevant constants and runtime config fields:

| Config/Constant | Declared Value | Documented Value / Comment | Runtime Use Sites | Verdict |
|-----------------|----------------|-----------------------------|-------------------|---------|

Include:
- `DEFAULT_*`, `MAX_*`, `MIN_*`, `*_LIMIT`, `*_TIMEOUT`, `*_INTERVAL`, `*_FACTOR`;
- chain parameters, genesis/testnet/mainnet defaults, peer/network limits, RPC limits, difficulty/EMA/oracle knobs;
- feature-flag or platform-conditional values that affect serialization, consensus, object layout, or API output.

## 2. Required Checks

For each row:
- **Doc/code drift**: compare the declared value with nearby comments, docs, config examples, and protocol constants.
- **Unused limit**: if a max/min/factor exists, find the enforcement site. If no enforcement path exists, flag it.
- **Network-mode drift**: verify testnet/devnet defaults cannot silently apply to production mode.
- **Unit drift**: verify seconds vs milliseconds, bytes vs chunks, slots vs blocks, and percentage vs basis-point units.
- **Feature/platform drift**: verify feature flags or OS-specific types do not change externally visible enum values, byte layout, consensus fields, or API semantics.
- **Boundary effect**: substitute the configured min/max/equality point into the function that consumes it.

Tag evidence as `[CFG-DOC-DRIFT:{file}:{line}]`, `[CFG-UNUSED-LIMIT:{file}:{line}]`, `[CFG-UNIT:{file}:{line}]`, or `[CFG-FEATURE-DRIFT:{file}:{line}]`.

## 3. Non-Finding Rules

Do not report harmless style differences. A config finding needs at least one concrete consequence: consensus divergence, DoS, stale security bound, unexpected production exposure, cross-platform incompatibility, or user/API misbehavior.

## 3a. Secrets / Key-Management Hygiene

Node clients hold validator keys, JWT secrets, and operator credentials. A secret committed to the repo, weakly encrypted at rest, or surfaced through a deployment manifest is a direct compromise of every operator that follows the config.

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to locate keystore-load and credential-read call-sites; on-demand single-symbol source reads for keystore/credential-handling functions only; never bulk-read large files (and never read the full content of a flagged key file — record its path, not its bytes).

**Heuristics**:
1. `git grep -niE 'private_key|priv_key|secret_key|keystore|password|passphrase|mnemonic|seed_phrase|jwt(_|\.)?secret|api[_-]?key|BEGIN .*PRIVATE KEY'` across the repo (config dirs, fixtures, docker/, k8s/, scripts/, CI files). Distinguish real material from test fixtures and placeholder env-var names; a plaintext key or real credential in tracked source is a finding regardless of directory.
2. **Keystore encryption strength**: locate keystore load/save. Verify keys at rest are encrypted with a vetted KDF (scrypt/argon2/pbkdf2 with sane params), not stored plaintext or under a weak/empty default password.
3. **Deployment manifests**: review `Dockerfile`, `docker-compose*.yml`, `*.k8s.yaml`/Helm values, `systemd` units, and CI workflow files for credentials in `ENV`/`environment`/`args` or baked into image layers. Secrets belong in a secret store / mounted file, not in image env or committed manifests.
4. **Rotation/automation leakage**: review any key-rotation or provisioning script for writing creds to world-readable paths, logging the secret, or transmitting it over an unauthenticated channel.

A secrets finding needs a concrete exposure path (tracked file, image layer, manifest, log, or transmission). Placeholder names and clearly-marked test keys are not findings.

Tag evidence as `[CFG-SECRET-PLAINTEXT:{file}:{line}]`, `[CFG-KEYSTORE-WEAK:{file}:{line}]`, or `[CFG-MANIFEST-CRED:{file}:{line}]`.

## 4. Output

Use normal finding format. If no finding exists, still emit the inventory table with `SAFE` rows and concrete file:line evidence for the checked constants.
