# Pre-Mainnet Checklist

## Build and artifacts
- [ ] Compiler version pinned
- [ ] Optimizer runs pinned
- [ ] Lockfiles committed
- [ ] Verification metadata pinned
- [ ] Reproducible build path documented

## Deployment config
- [ ] Chain ID validated
- [ ] RPC validated
- [ ] Deployer address validated
- [ ] Constructor/initializer args reviewed
- [ ] No test/stale addresses remain
- [ ] Decimal assumptions checked

## Signers and roles
- [ ] Deployer is dedicated
- [ ] Admin is multisig or risk explicitly accepted
- [ ] Pauser/guardian defined
- [ ] Treasury role defined
- [ ] Upgrade role defined
- [ ] Role separation reviewed

## CI/CD
- [ ] Production deploy requires protected branch or tag
- [ ] Production deploy requires approval gate
- [ ] Actions refs pinned
- [ ] Secrets scope minimized

## Rehearsal
- [ ] Fork deployment completed
- [ ] Initializer rehearsal completed
- [ ] Ownership transfer rehearsal completed
- [ ] Verification rehearsal completed
- [ ] Smoke tests passed

## Post-deploy
- [ ] Verification plan ready
- [ ] Ownership assertions ready
- [ ] Monitoring handoff ready
- [ ] Manifest archival ready
