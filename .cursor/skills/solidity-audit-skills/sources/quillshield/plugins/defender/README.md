# Defender

A blue-team release-gate skill for smart contract systems.

Defender classifies a project, reviews deployment and upgrade execution paths, inspects CI/CD and dependency trust boundaries, evaluates signer and admin operational security, and produces evidence-based release blockers, warnings, checklists, and post-deploy validation steps.

Unlike exploit-hunting skills, Defender focuses on **safe release execution**:
- Is this repository ready to deploy?
- Is this upgrade path operationally safe?
- Are secrets, signers, CI workflows, addresses, and network settings trustworthy?
- Has the team rehearsed deployment and defined immediate post-deploy validation?

## Use when

Use Defender when:
- deploying smart contracts
- preparing upgrades
- reviewing deploy scripts
- hardening CI/CD
- validating role and admin handoffs
- checking network config before broadcast
- enforcing blue-team release hygiene across blockchain repositories

## What Defender does

Defender runs in four ordered phases:

1. **Classify the project**
   - framework: Foundry / Hardhat / hybrid / other
   - language: Solidity / Vyper / Cairo / mixed
   - upgradeability: upgradeable / immutable / mixed
   - protocol type: token / vault / AMM / lending / bridge / governance / NFT / other
   - deployment and CI surfaces

2. **Run the defence pass**
   - build integrity
   - dependency, secrets, and supply chain
   - CI/CD trust and workflow security
   - deployment config drift
   - deploy-script safety
   - upgrade readiness
   - signer and admin opsec
   - fork rehearsal evidence
   - post-deploy readiness

3. **Score findings**
   - BLOCKER
   - HIGH
   - MEDIUM
   - LOW

4. **Output a release verdict**
   - `BLOCK DEPLOY`
   - `PROCEED WITH RISK`
   - `READY FOR STAGED RELEASE`

## What makes this blue-team

Defender is evidence-first and release-oriented.

It does not treat passing tests, lint, or typecheck as proof of deploy safety. It looks for operational and configuration failures that cause real incidents, including:
- wrong-chain deployment
- leaked or mishandled secrets
- stale addresses
- broken initialization
- unsafe upgrade execution
- single-signer admin concentration
- unsafe CI deploy workflows
- unrehearsed ownership or role transfers

## Key policy adjustments

### No plaintext `.env` recommendation for secrets

Defender should **not recommend storing sensitive values such as private keys in plaintext `.env` files**.

Preferred guidance:
- use **Foundry keystore-backed accounts** for deployment and signing workflows
- keep signing material out of repository-controlled plaintext files
- flag private-key-in-env patterns as risky unless there is explicit, documented, compensating control
- treat repo references that encourage plaintext private key handling as at least **MEDIUM**, and **HIGH** where they are wired into production deployment paths

Non-secret configuration values may still appear in environment configuration where appropriate, but secrets should be handled through safer signer flows.

## Required output shape

Defender should emit a structured report like:

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
VERDICT: BLOCK DEPLOY / PROCEED WITH RISK / READY FOR STAGED RELEASE

Top blockers:
- ...

Required actions before release:
- ...

Evidence reviewed:
- ...
```

## Repository layout

```text
plugins/defender/
  .claude-plugin/
    plugin.json
  README.md
  skills/
    defender/
      SKILL.md
      references/
      templates/
```

## Added context packs

Defender includes reusable context packs to improve consistency and reduce generic outputs:

- `references/finding-catalog.md`: canonical release findings with evidence, escalation rules, and required actions
- `references/good-vs-bad-snippets.md`: deployment, CI, secret-handling, and upgrade pattern examples
- `references/compensating-controls.md`: documented downgrade boundaries and residual risk rules
- `references/evidence-query-playbook.md`: deterministic `rg` queries for evidence gathering
- `references/case-study-mapping.md`: incident analogies that explain impact without over-claiming root cause
- `templates/defender-report-*-example.md`: complete example reports for each verdict type

## Design principles

- evidence over assumption
- detection over generic advice
- release safety over exploit novelty
- explicit verdicts over vague checklists
- production readiness over test-passing confidence
