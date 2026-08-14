# Good vs Bad Snippets
Use these snippets as pattern anchors while reviewing deploy safety.

## 1) Chain assertion in Foundry deploy scripts

Bad:
```solidity
function run() external {
    vm.startBroadcast();
    new Core();
    vm.stopBroadcast();
}
```

Good:
```solidity
function run() external {
    uint256 expectedChainId = 1;
    require(block.chainid == expectedChainId, "wrong chain");

    address deployer = vm.addr(vm.envUint("DEPLOYER_PK"));
    require(deployer == 0x1234...ABCD, "wrong deployer");

    vm.startBroadcast();
    new Core();
    vm.stopBroadcast();
}
```

## 2) Explicit required environment values

Bad:
```solidity
string memory rpc = vm.envOr("RPC_URL", string("https://mainnet.example"));
```

Good:
```solidity
string memory rpc = vm.envString("RPC_URL");
require(bytes(rpc).length > 0, "missing RPC_URL");
```

## 3) Private key handling guidance

Bad docs pattern:
```bash
# env
PRIVATE_KEY=0xabc...
```

Better docs pattern:
```bash
# Use keystore-backed signing
cast wallet import deployer --interactive
forge script script/Deploy.s.sol:Deploy --account deployer --sender <deployer_address> --broadcast
```

## 4) GitHub Actions pinning

Bad:
```yaml
- uses: actions/checkout@v4
- uses: foundry-rs/foundry-toolchain@v1
```

Better:
```yaml
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608
- uses: foundry-rs/foundry-toolchain@<pinned-commit-sha>
```

## 5) Workflow trust boundary split

Bad:
```yaml
on: [pull_request]
jobs:
  deploy:
    secrets: inherit
```

Better:
```yaml
on:
  push:
    branches: ["main"]
workflow_dispatch:

jobs:
  test:
    if: github.event_name == 'pull_request'
  deploy:
    if: github.ref == 'refs/heads/main'
    environment: production
    permissions:
      contents: read
      id-token: write
```

## 6) Hardhat network safety checks

Bad:
```ts
const [deployer] = await ethers.getSigners();
await hre.run("deploy");
```

Good:
```ts
const [deployer] = await ethers.getSigners();
const network = await ethers.provider.getNetwork();
if (network.chainId !== 1n) throw new Error("wrong chain");
if (deployer.address.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
  throw new Error("wrong deployer");
}
await hre.run("deploy");
```

## 7) Upgrade script address assertions

Bad:
```ts
await upgrades.upgradeProxy(process.env.PROXY!, ImplFactory);
```

Good:
```ts
const proxy = process.env.PROXY;
if (!proxy || proxy.toLowerCase() !== EXPECTED_PROXY.toLowerCase()) {
  throw new Error("proxy mismatch");
}
await upgrades.upgradeProxy(proxy, ImplFactory);
```

## 8) Role transfer runbook evidence

Bad:
```text
Transfer ownership later.
```

Good:
```text
1. Deploy implementation and verify bytecode.
2. Transfer proxy admin to multisig 0x....
3. Confirm onchain owner(), admin(), upgrader().
4. Record tx hashes in release manifest.
```

## 9) CI deploy gates

Bad:
```yaml
on:
  push:
    branches: ['*']
```

Good:
```yaml
on:
  push:
    branches: ['main']
concurrency: production-deploy
jobs:
  deploy:
    environment: production
    # Require environment reviewers in repository settings
```

## 10) Dangerous FFI in deploy path

Bad:
```solidity
bytes memory out = vm.ffi(["bash", "-lc", "python scripts/resolve.py"]);
address treasury = abi.decode(out, (address));
```

Better:
```solidity
address treasury = vm.envAddress("TREASURY");
require(treasury != address(0), "invalid treasury");
```
