# Deployment guide

Contracts live under **`contracts/`** (Foundry). This guide aligns with **`contracts/script/Registry.s.sol`**, **`contracts/script/Chamber.s.sol`**, and the shared libraries **`contracts/test/utils/DeployRegistry.sol`** / **`DeployChamber.sol`**.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- RPC URL and funded deployer account for your target chain
- For verification: explorer API key (e.g. Etherscan-compatible)

Install libs once:

```bash
cd contracts
forge install
```

## What gets deployed

### Production-shaped Registry (+ Chamber implementation pin)

`DeployRegistry` (`script/Registry.s.sol`) calls **`DeployRegistry.deploy(admin)`**, which (per **`test/utils/DeployRegistry.sol`**) does:

1. Deploy **Registry** implementation (concrete `Registry` contract).  
2. Deploy **Chamber** implementation (concrete `Chamber` contract).  
3. Deploy **`TransparentUpgradeableProxy`** pointing at Registry implementation, **`admin` as proxy admin owner**, with **`Registry.initialize(chamberImplementation, admin)`** calldata.  
4. Return **`Registry` interface at the proxy address**.

That yields a Registry you can **`createChamber`** from; each Chamber is its own **`TransparentUpgradeableProxy`** with **ProxyAdmin ownership transferred to `address(chamber)`** inside **`Registry.createChamber`**.

Environment:

- **`ADMIN`** — optional; defaults to **`msg.sender`** if unset (`Registry.s.sol`).

Example:

```bash
cd contracts
forge script script/Registry.s.sol:DeployRegistry \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

### Standalone Chamber script (non-Registry lab)

**`script/Chamber.s.sol`** builds **only** a Chamber proxy via **`DeployChamber.deploy`**:

- Registers implementation + proxy with **`admin` passed as Transparent proxy admin**.  
- **Does not** hand **`ProxyAdmin` ownership** to the Chamber contract—in production prefer **`Registry.createChamber`** semantics.

Chains with pinned addresses appear in **`Chamber.s.sol`** (`mainnet`, `sepolia`, `base`). Local **`31337`** can reuse **`deployments.json`** mocks emitted by **`DeployAllAnvil`**.

Example:

```bash
forge script script/Chamber.s.sol:DeployChamber \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

## Creating a chamber on an existing Registry

Anyone can call **`createChamber`** on the Registry proxy (no admin role required):

```solidity
address payable chamber = registry.createChamber(
    erc20Token,
    erc721Token,
    seats,   // 1 .. 20
    "My Chamber Share",
    "mCHAM"
);
```

**No second `initialize` on the Chamber** — the Registry already encoded **`Chamber.initialize(...)`** in the proxy creation path.

### Admin-only maintenance

**`ADMIN_ROLE`** on Registry can **`setChamberImplementation`** so **new** proxies pick up upgraded Chamber bytecode. Existing Chamber proxies upgrade through their **own ProxyAdmin** (normally owned by **`address(chamber)`**) via governance-driven **`upgradeImplementation`** calls.

## Local all-in-one

For app + mocks parity, **`script/DeployAllAnvil.s.sol`** (invoked via your **`Makefile`** flow if present) centralizes mocks + Registry + optional chamber wiring and **`deployments.json`**.

## Verification

Use **`forge verify-contract`** against the **proxy** addresses you care about externally, remembering:

- **`Registry`** user-facing address is the **proxy** from `DeployRegistry`.  
- **`Chamber`** instances are **proxies**; verify **implementation** separately if your explorer supports implementation links.

## Post-deploy checks

1. **`registry.implementation()`** non-zero.  
2. **`createChamber`** emits **`ChamberCreated`**.  
3. On a new Chamber: **`chamber.getProxyAdmin()`** non-zero; **`ProxyAdmin.owner(chamber)`** via cast should show **`chamber`**.  
4. **`chamber.asset()`**, **`chamber.nft()`**, **`chamber.getSeats()`** match expectations.  

## Upgrades (Chamber)

Typical path:

1. Deploy new **`Chamber` implementation** contract.  
2. Directors **`submitTransaction`** / **`confirm`** a call that **executes** against **`chamber`** with calldata **`upgradeImplementation(newImpl, initData)`** (selector validated for self-targets).  
3. **`executeTransaction`** with matching calldata after quorum.

Do **not** rely on historical examples using bare **`ProxyAdmin.upgrade`** unless your governance queue explicitly permits that ABI.

## References

- OpenZeppelin [transparent proxies](https://docs.openzeppelin.com/contracts/api/proxy#transparent-vs-uups)  
- Foundry [`forge script`](https://book.getfoundry.sh/reference/forge/forge-script)  
