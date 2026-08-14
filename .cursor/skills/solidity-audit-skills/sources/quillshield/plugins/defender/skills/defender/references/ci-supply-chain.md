# CI and Supply-Chain Hardening

## CI trust checks
- pinned actions refs
- branch and environment protections
- manual approvals for production deploys
- minimal secret exposure by job
- no unsafe remote-script execution
- self-hosted runner assumptions documented

## Supply-chain checks
- floating package versions
- unpinned git dependencies
- arbitrary install scripts
- conflicting dependency versions
- suspicious binaries or downloads
- transitive tooling risk in sidecars

## Escalate when
- CI can deploy to production with weak review gates
- secrets are reachable from broad workflow contexts
- release path depends on unverified remote code or binaries
