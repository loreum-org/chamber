# Project Classification Guide

Defender begins by classifying the repository.

## Framework
Indicators:
- Foundry: `foundry.toml`, `forge script`, `forge test`, `forge-std`
- Hardhat: `hardhat.config.*`, `npx hardhat`, task files
- Hybrid: both Foundry and Hardhat signals present

## Language
Indicators:
- Solidity: `.sol`
- Vyper: `.vy`
- Cairo: `Scarb.toml`, Starknet layout, Cairo sources
- Mixed: more than one production language present

## Upgradeability
Indicators:
- OZ upgradeable imports
- initializer modifiers/functions
- proxy admin scripts
- deployment tasks mentioning UUPS, Transparent, Beacon, Diamond

## Protocol type
Best-effort classification from contract semantics and naming:
- token
- vault
- AMM
- lending
- bridge
- governance
- NFT
- staking
- other

## Deployment surface
Look for:
- manual scripts
- CI-triggered deploys
- multisig execution plans
- upgrade-only execution tasks

## CI surface
Look for:
- `.github/workflows/*.yml`
- `.gitlab-ci.yml`
- alternative pipeline directories
