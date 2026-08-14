# Evidence Query Playbook

Use deterministic search queries before drafting findings.

## Project classification

```bash
rg -n "foundry.toml|forge script|forge test|hardhat\.config|npx hardhat|Scarb.toml" .
rg --files | rg "\.(sol|vy)$|Scarb.toml|hardhat\.config|foundry\.toml"
```

## Upgradeability signals

```bash
rg -n "Initializable|initializer|reinitializer|UUPS|Transparent|Beacon|ProxyAdmin|upgradeTo" src contracts script test
```

## Build reproducibility

```bash
rg -n "solc|optimizer|evmVersion|viaIR|remappings|ffi" foundry.toml hardhat.config.* package.json
rg --files | rg "(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$"
```

## Secret and signer handling

```bash
rg -n "PRIVATE_KEY|MNEMONIC|DEPLOYER_PK|AWS_SECRET|GCP_" .
rg -n "--private-key|env\(" script scripts README.md docs .github/workflows
```

## CI trust boundary

```bash
rg -n "uses: .*@(main|master|v[0-9]+)$|workflow_dispatch|pull_request|secrets: inherit|environment:" .github/workflows
rg -n "permissions:" .github/workflows
```

## Config drift and address wiring

```bash
rg -n "chainid|chainId|rpc|RPC_URL|owner|admin|treasury|oracle|router|pauser|guardian|fee" script scripts config deploy
rg -n "0x0000000000000000000000000000000000000000|TODO|REPLACE_ME" .
```

## Deploy ergonomics and fail-closed checks

```bash
rg -n "startBroadcast|broadcast|upgradeProxy|deployProxy|vm\.ffi|envOr\(" script scripts
```

## Rehearsal and post-deploy evidence

```bash
rg -n "fork|anvil|smoke|post-deploy|verify|manifest|tx hash|ownership transfer" README.md docs script test
```

## Minimum evidence list per report

Always include at least one file path from each applicable area:

- deploy or upgrade script
- chain/network config
- CI workflow
- signer/role mapping source
- rehearsal or post-deploy runbook/checklist
