---
name: defender
description: Blue-team release-gate analysis for smart contract deployment and upgrade readiness. Classifies repositories, checks deploy/upgrade execution paths, CI/CD trust boundaries, config drift, secrets/signer operational security, and outputs evidence-backed release verdicts.
---

# Defender

A blue-team release-gate skill for smart contract systems.

Defender determines whether a repository is safe to deploy or upgrade. It focuses on **release execution risk**, not exploit discovery.

## Use when

- deploying smart contracts
- preparing upgrades
- reviewing deploy scripts
- hardening CI/CD
- rotating admin roles
- validating ownership handoff
- enforcing release hygiene

## Non-goals

Defender does NOT replace:
- full security audits
- economic analysis
- invariant discovery
- deep proxy vulnerability analysis (`proxy-upgrade-safety`)

It focuses only on **execution safety of release**.

---

## Core rule

**Evidence first.**

Only report findings from:
- contracts
- deploy scripts
- CI workflows
- dependency manifests
- configs / address books
- tests / fork scripts
- docs / runbooks

Separate:
- **Detection** → what repo proves
- **Policy** → what should be enforced

---

## Execution order (STRICT)

1. Project classification  
2. Defence pass  
3. Severity scoring  
4. Release verdict  

---

## Reference packs

Always load:
- `references/finding-catalog.md`
- `references/severity-model.md`
- `references/evidence-query-playbook.md`

Load contextually:
- classification → `project-classification.md`
- CI → `ci-supply-chain.md`
- deploy drift → `config-drift-checks.md`
- upgrade → `upgrade-readiness.md`
- signer → `signer-opsec.md`
- false confidence → `false-confidence.md`
- post-deploy → `post-deploy-validation.md`

Templates:
- `defender-report-template.md`
- checklist templates as needed

---

# Phase 1 — Project classification

### Framework
Detect:
- Foundry / Hardhat / hybrid / other

Evidence:
- `foundry.toml`, `hardhat.config.*`, scripts

### Language
- Solidity / Vyper / Cairo / mixed

### Upgradeability
- upgradeable / immutable / mixed

Evidence:
- OZ upgrade imports
- proxies
- initializer usage

### Protocol type
Infer:
- token / vault / AMM / lending / bridge / governance / NFT / staking / other

### Deployment surface
- manual / script / CI / multisig / upgrade-task

### CI surface
- GitHub Actions / GitLab / other / none

Output classification block.

---

# Phase 2 — Defence pass

## A. Build integrity

Check:
- compiler version pinned
- optimizer pinned
- evmVersion consistency
- lockfiles committed
- no conflicting configs (Foundry vs Hardhat)
- artifacts reproducible from repo
- verification metadata aligned

Escalate if:
- build settings differ from verification
- configs produce ambiguous outputs

---

## B. Dependencies, secrets, supply chain

Check:
- committed secrets
- `.env` usage for private keys
- floating versions
- unpinned git deps
- install scripts
- dependency confusion risk
- abandoned/suspicious packages
- OZ version mismatch
- unsafe sidecar tooling
- unverified binaries

### Secret policy

Plaintext `.env` private keys are discouraged.

Preferred:
- **Foundry keystore-backed accounts**

Classify:
- private key in repo → BLOCKER/HIGH
- deploy scripts using plaintext env keys → HIGH
- `.env` for non-sensitive config → acceptable

---

## C. CI/CD trust

Check:
- unpinned GitHub Actions
- secrets in untrusted workflows
- deploys from weak branches
- no approval gate
- excessive secret access
- curl/bash installs
- unsafe runners
- mixed trust zones

Escalate if CI can deploy unsafely.

---

## D. Deployment config drift

CRITICAL

Check:
- chain ID matches target
- RPC matches chain
- deployer is correct
- constructor/initializer args final
- addresses (oracle/token/admin) valid for chain
- no test/stale addresses
- decimals correct
- verifier settings pinned
- no silent fallback logic

### Foundry FFI

- default: HIGH  
- BLOCKER if affecting deploy logic/secrets

---

## E. Deploy-script safety

Check:
- chain assertions
- deployer assertions
- env validation
- correct initialization order
- idempotency assumptions clear
- no test config reuse
- address outputs reviewable
- no opaque branching
- verification steps present

Escalate if scripts can silently misdeploy.

---

## F. Upgrade readiness (if applicable)

Check:
- implementation initialized or locked
- initializer calldata reviewed
- storage diff reviewed
- proxy admin correct
- multisig/timelock path exists
- pause/rollback defined
- fork rehearsal exists

---

## G. Signer & admin opsec

Check:
- deployer is dedicated
- secure signer preferred
- admin is multisig
- roles separated:
  - deployer / upgrader / pauser / treasury
- emergency roles documented
- no hot wallet admin unless justified
- tx review process exists

---

## H. Address & role mapping

Extract:
- owner/admin
- proxy admin
- upgrader
- pauser
- treasury
- oracle
- keeper
- timelock

Flag:
- role concentration
- EOA-only control
- zero addresses
- missing transfer flow

---

## I. Fork rehearsal

Require evidence of:
- deploy scripts tested
- initializer tested
- role transfers tested
- upgrade tested
- verification tested
- smoke tests run

Absence → HIGH (mainnet)

---

## J. Post-deploy readiness

Check defined plan for:
- verification
- ownership assertions
- pause test
- oracle checks
- event expectations
- integration smoke tests
- monitoring
- deployment manifest

---

## K. Unsafe deploy ergonomics

Check:
- one-command broadcast risk
- missing confirmations
- hidden env defaults
- CREATE/CREATE2 assumptions undocumented
- nonce-sensitive flows undocumented

---

# Phase 3 — False confidence

MANDATORY

Passing does NOT imply safety:
- unit tests
- forge test
- static analysis
- lint
- typecheck

Require:
- fork rehearsal
- permission diff
- storage diff
- address diff
- event checks
- role snapshot
- post-deploy smoke tests

---

# Phase 4 — Severity

### BLOCKER
- wrong chain
- lost admin
- leaked secrets
- broken init
- broken upgrade
- unverifiable deployment

### HIGH
- unsafe CI
- missing rehearsal
- FFI misuse
- admin EOA risk
- stale config

### MEDIUM
- should fix before mainnet

### LOW
- hygiene gaps

Specify scope:
- mainnet-only / all releases / upgrades only

---

# Phase 5 — Verdict

Always output:

- `VERDICT: BLOCK DEPLOY`
- `VERDICT: PROCEED WITH RISK`
- `VERDICT: READY FOR STAGED RELEASE`

Include:
- top blockers
- required actions
- evidence reviewed

---

# Output format

```text
DEFENDER REPORT

1. Project Classification
- Framework:
- Language:
- Upgradeability:
- Protocol Type:
- Deployment Surface:
- CI Surface:

2. Release Findings

BLOCKER:
- ...

HIGH:
- ...

MEDIUM:
- ...

LOW:
- ...

3. False Confidence Warnings
- ...

4. Release Verdict

VERDICT: ...

Top blockers:
- ...

Required actions:
- ...

Evidence reviewed:
- ...
