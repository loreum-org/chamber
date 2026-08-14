# DEFENDER REPORT (Example: PROCEED WITH RISK)

## 1. Project Classification

- Framework: Hardhat
- Language: Solidity
- Upgradeability: immutable
- Protocol Type: token
- Deployment Surface: script-driven manual deploy
- CI Surface: GitHub Actions

## 2. Release Findings

### BLOCKER

- None identified.

### HIGH

- D-012 Signer concentration across critical roles
  - Evidence: deployer, owner, and treasury are same EOA in `config/mainnet.json`.
  - Scope: mainnet only
  - Required action: migrate owner/treasury to multisig before broad TVL onboarding.

### MEDIUM

- D-004 Unpinned CI action references
  - Evidence: `.github/workflows/ci.yml` uses floating action refs for non-deploy jobs.
  - Scope: ci hardening only
  - Required action: pin all workflow actions to immutable SHAs.

- D-013 No complete post-deploy validation owner map
  - Evidence: smoke test list exists, but no owner-by-owner execution responsibility.
  - Scope: mainnet only
  - Required action: assign accountable owners per post-deploy check.

### LOW

- D-016 Missing standardized release archive naming
  - Evidence: manifests exist but naming is inconsistent.
  - Scope: all releases
  - Required action: enforce manifest naming convention.

## 3. False Confidence Warnings

- Unit tests passing does not validate operational signer safety.
- Static analysis does not prove deployment process control.

## 4. Release Verdict

**VERDICT:** PROCEED WITH RISK

### Top blockers

- None.

### Required actions before release

- Capture formal risk acceptance for EOA role concentration.
- Complete multisig migration timeline with owners and dates.
- Pin remaining action references.

### Evidence reviewed

- `config/mainnet.json`
- `.github/workflows/ci.yml`
- `docs/release-checklist.md`
- `scripts/deploy.ts`
