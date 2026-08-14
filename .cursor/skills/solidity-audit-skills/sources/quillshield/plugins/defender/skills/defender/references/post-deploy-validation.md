# Post-Deploy Validation

Pre-deploy readiness should include a defined immediate post-deploy plan.

## Minimum checks
- source and bytecode verification
- ownership and admin assertions
- pause path validation where safe and appropriate
- oracle heartbeat or dependency sanity checks
- expected event emissions
- smoke-test integrations
- monitoring and alerting handoff
- deployment manifest archival

## Why this belongs in Defender
A team that has not defined its immediate post-deploy validation steps is not fully ready to release.
