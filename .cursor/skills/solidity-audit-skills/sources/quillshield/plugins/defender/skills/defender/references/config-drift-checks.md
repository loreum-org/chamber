# Deployment Config Drift Checks

Deployment config drift is one of the highest-severity release risks.

## Check for
- chain ID and RPC mismatch
- deployer mismatch
- constructor or initializer args differing by environment
- stale, testnet, placeholder, or cross-chain addresses
- decimal assumptions inconsistent with live integrations
- verification metadata mismatch
- unsafe default network fallback behavior

## Address classes to review
- owner/admin
- proxy admin
- pauser/guardian
- treasury
- fee recipient
- routers
- oracles
- tokens
- keepers

## Escalate when
- scripts can run against the wrong chain silently
- wrong addresses are likely to be accepted as valid
- env resolution can change release behavior unexpectedly
- deployer identity is not asserted before broadcast
