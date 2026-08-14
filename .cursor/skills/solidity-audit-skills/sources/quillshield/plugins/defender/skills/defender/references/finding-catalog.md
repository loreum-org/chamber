# Defender Finding Catalog

Use this catalog to keep findings consistent across repositories.

## Output contract for each finding

For each finding, include:

- Finding ID
- Severity
- Scope (`all releases`, `mainnet only`, `upgrade releases only`, or `ci hardening only`)
- Evidence
- Why this matters
- Required action before release

## D-001 Wrong-chain deployment path

- Default severity: BLOCKER
- Scope: all releases
- Signals:
  - no chain assertion before broadcast
  - RPC URL selected by implicit fallback
  - chain id in script differs from env docs
- Evidence to collect:
  - deploy script assertions
  - `foundry.toml` / `hardhat.config.*`
  - CI deploy workflow inputs
- Escalate when:
  - deploy can silently run on an unintended chain
- False-positive guard:
  - explicit chain assertion and failing guard are present in all deploy scripts
- Required action:
  - add hard chain/deployer assertions and fail closed defaults

## D-002 Stale or cross-network address wiring

- Default severity: HIGH
- Scope: mainnet only
- Signals:
  - testnet addresses in production config
  - placeholder or zero addresses for critical roles
- Evidence to collect:
  - network config files
  - deployment manifests
  - script constants and env mapping
- Escalate when:
  - owner/admin/oracle/router/treasury addresses are wrong for target chain
- False-positive guard:
  - address book includes chain-qualified, reviewed values and verification script checks
- Required action:
  - reconcile config against chain-specific address inventory and assert at runtime

## D-003 Plaintext private key handling in release path

- Default severity: HIGH
- Scope: all releases
- Signals:
  - docs require `PRIVATE_KEY=` in `.env`
  - production deploy scripts consume raw private keys directly
- Evidence to collect:
  - docs, scripts, workflow env declarations
- Escalate when:
  - plaintext secret handling is required for production deploy
- False-positive guard:
  - keystore-backed signer path is default and documented; plaintext path disabled for production
- Required action:
  - migrate to keystore-backed accounts and remove plaintext key instructions

## D-004 Unpinned CI action references

- Default severity: MEDIUM
- Scope: ci hardening only
- Signals:
  - `uses: action@main` or broad tags without SHA pinning
- Evidence to collect:
  - `.github/workflows/*.yml`
- Escalate when:
  - release/deploy jobs depend on floating refs
- False-positive guard:
  - actions are pinned to immutable SHAs in release path
- Required action:
  - pin actions and define update cadence

## D-005 Secrets exposed to untrusted workflow triggers

- Default severity: HIGH
- Scope: all releases
- Signals:
  - deploy job secrets reachable from PR events/forks
  - broad `workflow_dispatch` with weak environment protection
- Evidence to collect:
  - workflow trigger and permission blocks
  - environment protection settings references
- Escalate when:
  - production deploy secrets can be consumed by untrusted contexts
- False-positive guard:
  - production secrets only available on protected branches/environments with approvals
- Required action:
  - split trust zones and narrow secret scope

## D-006 Reproducibility mismatch between build and verification

- Default severity: BLOCKER
- Scope: all releases
- Signals:
  - compiler settings differ across deploy and verify steps
  - lockfile absent or inconsistent
- Evidence to collect:
  - build and verify scripts
  - toolchain config files
- Escalate when:
  - deployed artifacts cannot be reproduced from repository state
- False-positive guard:
  - deterministic build recipe and matching verifier settings are documented and tested
- Required action:
  - pin toolchain and unify deploy/verify config

## D-007 Unsafe deploy script ergonomics

- Default severity: MEDIUM
- Scope: all releases
- Signals:
  - one-command broadcast without preflight checks
  - hidden defaults that choose network/signer
- Evidence to collect:
  - script entry points and argument parsing
- Escalate when:
  - scripts can execute destructive operations with minimal confirmation
- False-positive guard:
  - explicit preflight checks and dry-run mode are mandatory
- Required action:
  - add fail-fast preflight and explicit runtime prompts/assertions

## D-008 Foundry FFI in deploy-critical flow

- Default severity: HIGH
- Scope: all releases
- Signals:
  - `ffi = true` combined with deploy/upgrade scripts
  - external command output feeds addresses or calldata
- Evidence to collect:
  - `foundry.toml`
  - scripts using `vm.ffi`
- Escalate when:
  - FFI controls target addresses, secret material, or upgrade calldata
- False-positive guard:
  - FFI isolated to non-critical metadata generation and reviewed outputs
- Required action:
  - remove FFI from critical path or harden and pin execution assumptions

## D-009 Missing upgrade rehearsal evidence

- Default severity: HIGH
- Scope: upgrade releases only
- Signals:
  - no fork/staging upgrade runbook proof
  - no post-upgrade smoke plan
- Evidence to collect:
  - rehearsal scripts and logs
  - upgrade checklist completion evidence
- Escalate when:
  - storage-changing upgrade has not been rehearsed
- False-positive guard:
  - reproducible fork rehearsal exists with recorded tx sequence
- Required action:
  - run fork rehearsal and document results before release

## D-010 Initializer execution ambiguity in upgrade path

- Default severity: BLOCKER
- Scope: upgrade releases only
- Signals:
  - missing or unclear initializer/reinitializer calldata
  - initializer order not documented
- Evidence to collect:
  - upgrade scripts
  - initializer docs/tests
- Escalate when:
  - upgrade can leave contracts partially configured
- False-positive guard:
  - initialization sequence is explicit and verified on fork
- Required action:
  - define and test exact initializer sequence

## D-011 Proxy admin ownership unclear

- Default severity: HIGH
- Scope: upgrade releases only
- Signals:
  - proxy admin owner not documented
  - admin transfer path missing from runbook
- Evidence to collect:
  - ownership scripts
  - role mapping docs
- Escalate when:
  - no verified authority can execute safe upgrade/rollback
- False-positive guard:
  - multisig/timelock ownership and execution flow are explicitly verified
- Required action:
  - map and validate proxy admin ownership pre-release

## D-012 Signer concentration across critical roles

- Default severity: HIGH
- Scope: mainnet only
- Signals:
  - deployer/admin/pauser/treasury collapsed into one EOA
- Evidence to collect:
  - role mapping output
  - config and script role assignment
- Escalate when:
  - single signer compromise can seize full control
- False-positive guard:
  - documented risk acceptance with compensating controls and limits
- Required action:
  - separate duties and move critical roles to multisig/timelock

## D-013 No post-deploy validation plan

- Default severity: MEDIUM
- Scope: mainnet only
- Signals:
  - no checklist for verification, role assertions, smoke tests, monitoring handoff
- Evidence to collect:
  - runbooks and release templates
- Escalate when:
  - team has no immediate validation sequence after deployment
- False-positive guard:
  - concrete post-deploy checklist with owners and expected outputs
- Required action:
  - define and rehearse immediate post-deploy validation

## D-014 Ambiguous network/deployer fallback behavior

- Default severity: HIGH
- Scope: all releases
- Signals:
  - default network selected when env var absent
  - signer selected from first account implicitly
- Evidence to collect:
  - script env resolution logic
  - hardhat/foundry default network config
- Escalate when:
  - missing env values alter deployment target silently
- False-positive guard:
  - missing required inputs hard-fail execution
- Required action:
  - enforce explicit network and signer parameters

## D-015 Deploy CI without approval gates

- Default severity: HIGH
- Scope: all releases
- Signals:
  - deploy jobs run from push to broad branches
  - no environment reviewers or approval step
- Evidence to collect:
  - workflow trigger definitions
  - environment config references in docs
- Escalate when:
  - production deploy can execute without human gate
- False-positive guard:
  - protected environment with explicit approval policy
- Required action:
  - require controlled promotion and approvals for production

## D-016 Missing release evidence archive

- Default severity: LOW
- Scope: all releases
- Signals:
  - no deployment manifest, tx hash list, or final role snapshot stored
- Evidence to collect:
  - docs and release artifacts directory
- Escalate when:
  - team cannot reconstruct what was deployed and by whom
- False-positive guard:
  - complete archive exists and is linked in release notes
- Required action:
  - archive release evidence as part of completion criteria
