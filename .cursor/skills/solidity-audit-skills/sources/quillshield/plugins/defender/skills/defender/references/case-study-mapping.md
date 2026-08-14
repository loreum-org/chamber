# Case Study Mapping for Release-Gate Reviews

Use incident analogies to explain why a release finding matters.

## Usage rule

- Map the repository evidence to an incident class.
- Do not claim "same root cause" unless evidence proves it.
- Keep case-study references short and educational.

## 1) Uninitialized or unsafe upgrade execution

- Defender checks:
  - upgrade rehearsal evidence
  - initializer/reinitializer sequencing
  - proxy admin ownership clarity
- Incident class:
  - upgrade initialization mistakes and unsafe admin paths can brick or seize control.
- Public references:
  - Parity multisig postmortem discussion: https://blog.openzeppelin.com/parity-wallet-hack-reloaded

## 2) Wrong address / config drift in deployment

- Defender checks:
  - chain and deployer assertions
  - address inventory validation
  - no placeholder/testnet values in production configs
- Incident class:
  - misconfigured addresses can route control or funds incorrectly.
- Public references:
  - Wintermute OP address mismatch context: https://www.paradigm.xyz/2022/08/optimism-and-wintermute

## 3) Build/toolchain integrity gaps

- Defender checks:
  - compiler/version pinning
  - lockfile consistency
  - deployment and verification settings parity
- Incident class:
  - toolchain drift can invalidate assumptions about deployed bytecode.
- Public references:
  - Vyper compiler vulnerability context: https://github.com/vyperlang/vyper/security/advisories/GHSA-5824-cm3x-3c38

## 4) CI/CD trust boundary failure

- Defender checks:
  - pinned actions
  - secret exposure boundaries
  - protected environments and approvals
- Incident class:
  - compromised automation can lead to unauthorized production actions.
- Public references:
  - GitHub Actions hardening guidance: https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions

## 5) Signer concentration and weak admin opsec

- Defender checks:
  - separation of deployer/upgrader/pauser/treasury
  - multisig/timelock usage for critical roles
- Incident class:
  - concentrated privilege amplifies impact of one compromised signer.
- Public references:
  - Audius governance incident write-up: https://blog.audius.co/article/audius-governance-takeover-post-mortem-7-23-22

## Reporting pattern

Use one line in findings when relevant:

```text
Incident analogy: This pattern aligns with documented "<incident class>" failures where release-time control/config assumptions failed.
```
