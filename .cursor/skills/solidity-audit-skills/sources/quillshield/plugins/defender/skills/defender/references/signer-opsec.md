# Signer and Admin Operational Security

Defender is blue-team useful when it maps the human and signer control plane.

## Preferred posture
- dedicated deployer
- secure signer path
- production admin via multisig
- role separation across deployer, upgrader, pauser, treasury
- emergency authorities documented

## Risk indicators
- personal wallet used as deployer and long-term admin
- production admin remains EOA
- hot wallet required for emergency response
- role concentration in one signer
- no documented transaction review before signing

## Secret handling
Do not recommend plaintext `.env` storage for private keys.
Prefer Foundry keystore-backed signer flows.
