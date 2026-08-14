# Compensating Controls Matrix

Use this matrix to avoid binary thinking when risk cannot be fully eliminated before release.

## Policy

- Never hide risk behind compensating controls.
- Keep original finding severity and note residual risk after controls.
- Do not downgrade a finding unless controls are evidenced in-repo.

## Matrix

### C-001 Production admin is an EOA

- Base severity: HIGH
- Acceptable temporary controls:
  - explicit, time-bounded risk acceptance document
  - signer is hardware-backed with strict device policy
  - emergency pause role is separate and multisig controlled
  - short migration plan to multisig with owners named
- Residual severity floor: MEDIUM
- Do not downgrade when:
  - no migration timeline
  - same EOA also controls treasury/upgrader/pauser

### C-002 Plaintext private key env flow still documented

- Base severity: HIGH
- Acceptable temporary controls:
  - plaintext flow clearly marked non-production only
  - production path defaults to keystore-backed accounts
  - CI checks fail if plaintext key variable used in production scripts
- Residual severity floor: MEDIUM
- Do not downgrade when:
  - production guide still instructs plaintext secrets
  - scripts consume `PRIVATE_KEY` for production execution

### C-003 Unpinned CI actions in non-deploy jobs

- Base severity: MEDIUM
- Acceptable temporary controls:
  - unpinned actions isolated to non-privileged jobs
  - deploy jobs fully pinned and isolated
  - branch protections and review requirements enforced
- Residual severity floor: LOW
- Do not downgrade when:
  - floating refs exist in jobs with deploy credentials or artifact signing

### C-004 Missing fork rehearsal due urgent patch window

- Base severity: HIGH
- Acceptable temporary controls:
  - two-person script walkthrough completed and signed
  - dry-run against staging with same config and signer model
  - post-deploy rollback path pre-approved and rehearsed
- Residual severity floor: MEDIUM
- Do not downgrade when:
  - upgrade modifies storage and no rehearsal evidence exists

### C-005 Role concentration in one signer

- Base severity: HIGH
- Acceptable temporary controls:
  - transaction review checklist with two human approvers
  - max daily operation limits enforced offchain
  - independent guardian role can pause
- Residual severity floor: MEDIUM
- Do not downgrade when:
  - concentrated signer can drain funds and upgrade logic unilaterally

## Reporting requirement

When compensating controls are accepted, include this field in the finding:

```text
Compensating controls accepted: Yes
Residual risk: <severity>
Expiry: <date or block height>
Owner: <team or role>
```
