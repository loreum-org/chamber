# Defender Severity Model

## BLOCKER
A release-blocking issue that can directly cause:
- wrong-chain deployment
- wrong-address configuration
- leaked secrets
- lost admin control
- broken initialization
- broken upgrade execution
- unverifiable release artifacts

Typical examples:
- production RPC/chain mismatch
- stale or testnet admin/oracle addresses in mainnet config
- plaintext production private key handling wired into deploy flow
- implementation left initializable
- missing required initializer sequence

## HIGH
A material increase in compromise or release-failure risk.

Typical examples:
- admin remains a single EOA for production-critical system
- upgrade path not rehearsed
- CI can deploy from weak triggers or weak trust boundaries
- FFI in deploy path affects release decisions
- no fork rehearsal for mainnet release

## MEDIUM
Should be fixed before mainnet, but may be tolerable for testnet or staging with explicit acknowledgement.

Typical examples:
- weakly documented verification flow
- partial signer role mapping
- incomplete but not absent post-deploy checklist

## LOW
Hygiene, documentation, or observability gaps that reduce assurance.

Typical examples:
- no explicit deployment manifest template
- weakly documented smoke tests
- inconsistent naming or release notes

## Environment-aware guidance

When possible, note whether the issue blocks:
- all releases
- mainnet only
- upgrade releases only
- CI hardening only
