# Architecture

Chamber couples **vault accounting** (OpenZeppelin **`ERC4626Upgradeable`**), **leaderboard governance** (`Board`), and a **queued multisig executor** (`Wallet`) in one upgradeable **`Chamber`** deployment. A **`Registry`** deploys Chamber proxies and indexes instances (and optional parent/child relationships).

## onchain components

### `Chamber.sol`

- ERC‑4626 vault over a fixed **underlying ERC‑20**; Chamber’s own **share token** is the ERC‑20 issued by ERC‑4626.  
- Holds **delegation** state: per‑holder allocations to membership **token IDs**, with **`totalHolderDelegations`** enforcing that moves cannot strand delegated weight.  
- Exposes **Board** read APIs (`getTop`, `getSeats`, `getQuorum`, `getDirectors`, seat proposals) and **Wallet** APIs (submit / confirm / execute / batch / cancel).  
- **`VERSION`** is a compile-time **`bytes32`** constant (see contract source for the current semantic version string).  
- **`upgradeImplementation`** is the sanctioned self‑target path for **`ProxyAdmin.upgradeAndCall`**, normally reached via **`executeTransaction`**.  

### `Board.sol` (abstract, inherited)

- Maintains delegation totals per **membership NFT token ID** in a sorted doubly linked list (see **[Design notes](./design-notes.md)** for `MAX_NODES`, `uint128` link constraints, transient **circuitBreaker** lock).  

### `Wallet.sol` (abstract, inherited)

- Stores **`keccak256(calldata)`** per nonce, optional **`metadataURI`**, confirmation bitmaps **per director token ID**, cancel voting, and emits **`SubmitTransaction` with raw calldata** for offchain archival.  

### `Registry.sol`

- **`TransparentUpgradeableProxy`** for implementations; **`initialize`** records **admin** (**`DEFAULT_ADMIN_ROLE`** + **`ADMIN_ROLE`**) and the **pinned Chamber implementation** used by **`createChamber`**.  
- **`createChamber`** initializes a new Chamber proxy via **`TransparentUpgradeableProxy`**, transfers **`ProxyAdmin` ownership** to **`address(chamber)`**, and optionally links **parent/child chambers** when the asset token is itself a registered Chamber.  

## offchain stack

### Web app (`app/`)

- **Reads** Registry and Chamber via viem/ethers-style clients (configured per environment).  
- **Writes** deposit, delegation, multisig lifecycle, deployment, consistent with **`IChamber` / `Registry`**.

## Proxies

| Contract | Deployment pattern |
|----------|---------------------|
| **Registry** | Production setup uses **`TransparentUpgradeableProxy`** + **`Registry.initialize(implementation, admin)`** (see `contracts/test/utils/DeployRegistry.sol` used by `script/Registry.s.sol`). |
| **Chamber** | **`TransparentUpgradeableProxy`** with **`initialize(erc20, erc721, seats, name, symbol)`**; **`ProxyAdmin` owner** transferred to **`chamber`**. |

## Registry vs standalone Chamber scripts

Using **`registry.createChamber`** matches custody of upgrades with the Chamber instance. The **`contracts/script/Chamber.s.sol`** path deploys proxies with **`ProxyAdmin`** owned by a separate **`admin` EOA**, which differs from **`Registry`** behavior—prefer Registry for product documentation assumptions.

## Further reading

- **[Governance](./governance.md)** — director selection, quorum, seat timelocks.  
- **[Design notes](./design-notes.md)** — storage layout and invariants.  
- **[Sequence diagrams](../reference/sequence-diagrams.md)** — lifecycle diagrams.  
