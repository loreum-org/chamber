# Chamber `src/` Security Review

**Date**: 2026-08-26  
**Reviewer**: Cursor Cloud Agent (code review; no remediations in this PR)  
**Commit reviewed**: `36e4bb9` (`main` at review start)  
**Version constant**: `Chamber.VERSION = "1.1.4"`

## Scope

Production Solidity under **`contracts/src/`** (not a repo-root `src/`). That is the Foundry source root (`contracts/foundry.toml` `src = 'src'`).

| In scope | Out of scope |
| --- | --- |
| `Chamber.sol`, `Board.sol`, `Wallet.sol`, `Registry.sol` | `contracts/test/**`, `contracts/script/**`, `contracts/broadcast/**` |
| `interfaces/IChamber.sol`, `IBoard.sol`, `IWallet.sol`, `IRegistry.sol` | App, landing, product docs |
| `types/BoardTypes.sol`, `types/WalletTypes.sol` (documentation-only libraries) | OpenZeppelin / forge-std vendored sources |
| Integration against installed OpenZeppelin **5.1.0** (`lib/openzeppelin-contracts`, `lib/openzeppelin-contracts-upgradeable`) | Writing remediations or changing bytecode |

This review does **not** include exploit proofs of concept, attack scripts, payloads, or reproduction procedures.

### Methodology and tools used

- **Teamshared MCP**: not usable for skill/memory retrieval. Namespace `TeamShared` reported `needsAuth`. Namespace `teamshared` was reachable but exposed **zero tools** (`memory_skill_get`, `memory_recall`, and `memory_assemble_context` were absent). Review continued with the inlined OpenZeppelin and audit-codebase instructions plus repo docs.
- **Repo-local Cursor skills**: no `.cursor/skills/` tree on `main`. Chamber PR #114 (vendored `daoism-systems/solidity-audit-skills`) is **not** present. Local methodology used: `docs/security/security-review.md` (function-by-function skill) and prior reports under `docs/security/`.
- **Skill 1 (develop-secure-contracts)**: read every in-scope `.sol` file; checked the **installed** OZ 5.1.0 APIs (not assumed); flagged custom auth / reentrancy / upgrade primitives where the library already provides one.
- **Skill 2 (audit-codebase, single-agent adaptation)**: profiled the source root; ran / will record the Foundry build+tests; reviewed through adversarial, structural, catalog, and language/protocol lenses; cross-checked contradictions in source.

---

## Profile

Chamber is a **single proxy** combining three surfaces: an ERC-4626 share vault, a delegation-weighted NFT board, and a director multisig wallet. Registry deploys new chambers.

```
Registry (TUP + AccessControl)
    createChamber → TransparentUpgradeableProxy(Chamber impl)
        ProxyAdmin.owner transferred to the chamber itself
Chamber (ERC4626Upgradeable + ReentrancyGuardUpgradeable + Board + Wallet)
    shares  → delegate/undelegate → Board linked list (max 50 nodes)
    top `seats` (1..20) NFT owners are directors
    directors submit/confirm/execute/cancel wallet calls
    upgradeImplementation only via msg.sender == address(this)
```

### Files and size

| File | LOC | Role |
| --- | ---: | --- |
| `Chamber.sol` | 835 | Vault + director auth + wallet facade + upgrade entry |
| `Board.sol` | 514 | Sorted doubly-linked list, seats, quorum, seat-update proposals |
| `Wallet.sol` | 355 | Multisig storage, hash-only calldata, confirm/cancel/execute |
| `Registry.sol` | 272 | Permissionless chamber factory, asset/parent index, impl pointer |
| `interfaces/*` | 650 | ABI, events, errors |
| `types/*` | 65 | Legacy off-chain structs (not the on-chain layout) |
| **Total** | **2691** | |

### Actor / surface map

| Surface | Who | What |
| --- | --- | --- |
| Vault | Any holder of the configured ERC-20 | `deposit` / `mint` / `withdraw` / `redeem` (inherited ERC-4626); share `transfer` / `transferFrom` locked by active delegation |
| Delegation | Share holders | `delegate` / `undelegate` to membership `tokenId`s |
| Board | Top-`seats` NFT owners (or ERC-1271 stand-in) | `updateSeats`, `executeSeatsUpdate` |
| Wallet | Same directors | submit / confirm / revoke / cancel / execute (single + batch) |
| Upgrade | Chamber calling itself after wallet quorum | `upgradeImplementation` → chamber-owned `ProxyAdmin.upgradeAndCall` |
| Registry admin | `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` (same address at init) | `setChamberImplementation` for **future** deploys only; Registry TUP admin is the EOA passed to `TransparentUpgradeableProxy` |
| Keepers | None on-chain in `src/` | `Agent.sol` from older reviews is **gone**; no off-chain keeper surface in production contracts |
| Tokens | Configurable | Vault asset = arbitrary ERC-20; membership = arbitrary ERC-721. Sub-chambers: if `erc20Token` is already a registered chamber, Registry records parent/child |

### Auth model

- **Chamber** has no `Ownable` / `AccessControl`. Privileged actions use `isDirector(tokenId)`: `nft.ownerOf(tokenId) == msg.sender`, **or** a custom ERC-1271 check if the owner is a contract, **and** `tokenId` is among the first `seats` nodes from `head`.
- **Quorum** is `1 + (seats * 51) / 100` (integer). Examples: 1 seat → 1; 3 → 2; 5 → 3; 20 → 11.
- **Seat changes** after init require a proposal, supporter list, 7-day timelock, and re-check that supporters are still in the top-seat set at execution.
- **Wallet confirmations** are per-`tokenId` counters. Execution checks the **count** against **live** quorum and that the **executor** is a current director. It does **not** re-check that confirmers are still directors.
- **Registry** uses OpenZeppelin `AccessControl` (non-upgradeable variant) plus `Initializable`. `createChamber` is permissionless.

### Upgradeability and storage

- Chamber and Registry implementations call `_disableInitializers()` in their constructors.
- Chamber / Board / Wallet / Registry **own** state uses ERC-7201 namespaces. The four published slot constants **match** the EIP-7201 formula (`cast` verified this review).
- Chamber is a transparent proxy. After deploy, `ProxyAdmin` ownership is transferred to the chamber. `upgradeImplementation` requires `msg.sender == address(this)` and `ProxyAdmin.owner() == address(this)`.
- Registry is also a transparent proxy. Its proxy admin is the **EOA `admin`**, not the registry itself. Registry `AccessControl` stores `_roles` in the default sequential slot (not ERC-7201).

### External calls

- ERC-721 `ownerOf` (director checks, `getDirectors`, `delegate` existence).
- ERC-1271 `isValidSignature` (non-static call from `_isDirector`).
- ERC-20 / ERC-4626 asset transfers via OpenZeppelin `SafeERC20` inside the inherited vault.
- Wallet `target.call{value}(data)` after setting `executed = true` (reset to false if the call fails).
- Registry: `new TransparentUpgradeableProxy`, `getProxyAdmin`, `ProxyAdmin.transferOwnership`.

### Library versions (installed, not assumed)

- `solc` 0.8.30, `evm_version = cancun`, `via_ir = true` (`contracts/foundry.toml`).
- OpenZeppelin Contracts **5.1.0** and Upgradeable **5.1.0**.
- Present in that install and **not** used by Chamber/`Board`/`Registry` where they would fit: `AccessControlUpgradeable`, `AccessControlDefaultAdminRules`, `PausableUpgradeable`, `ReentrancyGuardTransient` / `ReentrancyGuardTransientUpgradeable`, `Ownable2StepUpgradeable`.

---

## Coverage

Every production file under `contracts/src/` was read in full. Review lenses:

1. **Adversarial** — board capture, quorum bypass, delegation games, confirm/revoke/cancel races, upgrade path, factory admin.
2. **Structural** — can assets leave without board quorum; do guards bind the functions that matter; can directors be reordered under an in-flight wallet call; seat vs. node-count liveness.
3. **Catalog** — reentrancy, authz, signatures/ERC-1271, initialization, arithmetic, griefing, first-depositor / donation, token weirdness.
4. **Language / protocol** — 0.8.30, custom errors, ERC-7201 vs sequential slots, `delegatecall` (none in `src/`; proxy admin uses the OZ path), multisig/governance patterns, Cancun transient storage.

Prior findings documented in `docs/security/` and `contracts/test/findings/` were treated as **historical**. This review re-validates whether the current source still has the issue.

`OffensiveReviewFindings.t.sol` already characterizes three **still-open** behaviors (stale confirmations, permissive ERC-1271, factory spam). Those are included here as findings, not as new exploit write-ups.

---

## Findings by severity

### Critical

None open. Previously reported criticals (permissionless `upgradeImplementation`, double-delegation inflation, ERC-4626 withdraw bypass of delegation locks) are **not** present in the current source. See [Cleared](#cleared-items).

---

### High

#### H-01 — Wallet execute accepts stale director confirmations

**Contracts**: `Chamber.executeTransaction` / `executeBatchTransactions`; `Wallet._confirmTransaction` / `_revokeConfirmation`  
**Lenses**: adversarial, structural

**Mechanism**: Confirmations are a `uint8` counter plus `isConfirmed[nonce][tokenId]`. `isDirector` is enforced at confirm/revoke time and for the executor only. Execute requires `confirmations >= getQuorum()` and does not walk confirmers to verify they are still in the top-`seats` set. Seat-update execution **does** re-validate supporters; the wallet path does not. After a `tokenId` leaves the board, that token cannot revoke (revoke is `isDirector`-gated), so outgoing approvals are sticky.

**Consequence**: A transaction that collected quorum under an old board remains executable by any **current** director after full board turnover. Treasury ETH/tokens and `upgradeImplementation` (self-call) can move on approvals the sitting board never gave.

**Recommendation**: At execute (and cancel, if desired), count only confirmations whose `tokenId` is still in the top-`seats` list, or snapshot the director set at submit and require that set. Allow revoke without current directorship, or auto-drop confirmations when a node leaves the top set. Align wallet semantics with `_executeSeatsUpdate`.

**Severity**: **High** — quorum bypass on the spend/upgrade path after ordinary delegation churn; one-clause: *historical approvals still move funds after the approving directors are gone*.

---

#### H-02 — Live delegation ranking with no snapshot or seating delay

**Contracts**: `Board._delegate` / `_reposition` / `_insert`; `Chamber.delegate`; wallet execute; `upgradeImplementation`  
**Lenses**: adversarial, language/protocol (governance)

**Mechanism**: Delegation immediately reorders the linked list. Director rights are the live top-`seats` owners. There is no checkpoint, voting delay, or “must have held the seat for N time” gate on submit/confirm/execute. The vault asset is an arbitrary ERC-20 (often flash-loanable). Membership is an arbitrary ERC-721. Wallet execution and self-upgrade can occur in the same transaction that changed the board.

**Consequence**: Control of a quorum of membership NFTs plus enough transient share weight to occupy those seats is enough to pass a wallet call (including upgrade) before the borrowed weight is released. Capital lock-up is not required. Severity scales with how cheap the NFTs are and how small current delegated stake is; one-seat chambers are a single NFT plus weight.

**Recommendation**: Introduce delegation checkpoints (OpenZeppelin `Votes` / `ERC20Votes` style) or a seating delay: a `tokenId` newly entering the top set cannot confirm or execute until a delay elapses. Optionally reject wallet execution in the same transaction as a board mutation. Document that 1-seat chambers are single-key treasuries.

**Severity**: **High** — same-transaction governance capture of a live treasury/upgrade path; one-clause: *director set is spot-priced, not time-weighted*.

---

#### H-03 — Seat-update slot cannot expire and only a sitting proposer can cancel

**Contracts**: `Board._setSeats`, `Board._executeSeatsUpdate`; `Chamber.updateSeats`  
**Lenses**: adversarial, structural

**Mechanism**: The first `updateSeats` after init writes a single `SeatUpdate`. A different `numOfSeats` cancels only if `supporters[0] == tokenId`. `updateSeats` is `isDirector`-gated, so cancellation requires the **original proposer to still be a director**. There is no proposal TTL. Finding 14 correctly stopped minority cancellation griefing; the inverse is an un-cancellable lock. Execution still works after 7 days **if** remaining top-seat supporters meet the snapshotted `requiredQuorum`.

**Consequence**: One director can occupy the only seat-change slot indefinitely. If that proposer later leaves the board and the proposal never reached quorum, **nobody** can cancel or replace it. Chambers that raised `seats` above populated `size` (wallet quorum then unattainable) can lose the only recovery path.

**Recommendation**: Add an expiry (e.g. timestamp + 7 days + grace) after which any current director may delete the proposal. Allow a supermajority of **current** top seats to cancel. Optionally require `numOfSeats <= max(size, 1)` or `numOfSeats <= MAX_NODES` with a warning when `numOfSeats > size`.

**Severity**: **High** — governance-parameter and quorum-recovery liveness failure; one-clause: *a single leftover proposal can permanently freeze seat changes*.

---

### Medium

#### M-01 — Custom ERC-1271 director auth is not a standard wallet signature

**Contracts**: `Chamber._isDirector`  
**Lenses**: catalog (signatures / authz), adversarial

**Mechanism**: If `ownerOf(tokenId)` is a contract and `owner != msg.sender`, Chamber hashes `abi.encodePacked("DirectorAuth", address(this), tokenId, msg.sender)` and calls `IERC1271.isValidSignature(hash, abi.encode(msg.sender))`. The “signature” is only the encoded caller. This is a custom primitive; installed OZ 5.1.0 already ships `SignatureChecker` and EIP-712 helpers. The call is a normal `CALL` (not `staticcall`) from a `view` helper used inside state-changing modifiers.

**Consequence**: (1) Any membership NFT sitting in a contract that returns the ERC-1271 magic for arbitrary data lets **every** caller act as that director. (2) Standard Safes do not understand this digest; they must call Chamber as `msg.sender == Safe`. (3) The ERC-1271 target can reenter Chamber functions that are **not** `nonReentrant` (vault, delegation, seats) during the director check.

**Recommendation**: Treat contract owners as directors only when `msg.sender == owner` (the contract wallet submits itself), or require a real EIP-712 signature via `SignatureChecker`. If delegated operators are required, use a narrow, documented allowlist. Use `staticcall` for the 1271 check.

**Severity**: **Medium** — impersonation and callback surface when the NFT is in a loose ERC-1271 contract; one-clause: *director auth invented a non-standard 1271 scheme instead of “owner contract calls”*.

---

#### M-02 — Reentrancy guards do not cover vault, delegation, or seat paths

**Contracts**: `Chamber` wallet wrappers vs inherited ERC-4626 and `Board` / `updateSeats`  
**Lenses**: catalog (reentrancy), structural

**Mechanism**: Wallet mutators use OZ `ReentrancyGuardUpgradeable` (`nonReentrant`). Board `_delegate` / `_undelegate` use a **custom** EIP-1153 `circuitBreaker` (`tstore`/`tload`). `deposit` / `mint` / `withdraw` / `redeem`, `delegate` / `undelegate`, `updateSeats` / `executeSeatsUpdate`, and `upgradeImplementation` do **not** take the OZ guard. During `target.call` in `_executeTransaction`, those ungated functions remain callable. OZ 5.1.0 already provides `ReentrancyGuardTransientUpgradeable` that could unify this.

**Consequence**: A wallet target (or ERC-1271 owner, or ERC-777-style vault asset) can change board ranking, seat proposals, or vault balances in the same transaction as an execution. Batch execute evaluates quorum per item but checks `isDirector` only once at the start. Cross-function inconsistency is the defect; the existing Finding 9 tests only cover reentering **gated** wallet functions.

**Recommendation**: Put one guard (prefer OZ transient or the existing upgradeable guard) on every state-mutating public function, including ERC-4626 entry points. If Board keeps a transient lock, share the same slot/namespace as the wallet guard or document why they must differ.

**Severity**: **Medium** — guards exist but do not bind the board/vault; one-clause: *execution callbacks can still mutate governance and the vault*.

---

#### M-03 — `getDelegations` hides evicted-node locks that still block withdrawals

**Contracts**: `Chamber.getDelegations`, `undelegate`, `_update`  
**Lenses**: structural, catalog (griefing)

**Mechanism**: Finding 11 correctly lets `undelegate` clear `holderDelegation` when the board node is gone. `getDelegations` only walks the **current** linked list. `totalHolderDelegations` still includes evicted `tokenId`s. `_update` forbids transfers/burns that would drop balance below that total. There is no on-chain enumeration of a holder’s evicted keys.

**Consequence**: After tail eviction (`MAX_NODES = 50`), a holder who does not remember the evicted `tokenId` cannot discover it from `getDelegations` and cannot withdraw or transfer shares until they recover the id from events or an indexer.

**Recommendation**: Maintain a per-holder enumerable set of delegated `tokenId`s (or return evicted ids from a dedicated getter). At eviction, optionally auto-undelegate tail supporters or emit an explicit “delegation stranded” index event the UI already indexes.

**Severity**: **Medium** — share lock with a broken read API; one-clause: *evicted delegations still constrain `_update` but disappear from `getDelegations`*.

---

#### M-04 — Wallet quorum is computed live, so seat decreases revive old transactions

**Contracts**: `Chamber.executeTransaction` (`getQuorum()`); `Board._getQuorum` / `_executeSeatsUpdate`  
**Lenses**: structural, adversarial

**Mechanism**: Seat-update `requiredQuorum` is snapshotted at proposal time. Wallet execution uses **current** `seats`. Confirmations are never decayed. After a completed seat decrease, an older transaction whose confirmation count was below the old quorum can meet the new, lower quorum.

**Consequence**: Combined with H-01, a 7-day seat decrease (which is intended and timelocked) can activate previously non-executable spends. The timelock is a mitigation, not a check that old txs still represent the new board.

**Recommendation**: Snapshot `requiredQuorum` (and the confirmer set) on submit. Or require confirmations from current directors **and** `confirmations >= max(submitQuorum, liveQuorum)`.

**Severity**: **Medium** — threshold changes rewrite history; one-clause: *lowering seats can make stale txs executable without new approvals*.

---

#### M-05 — Registry mixes a non-upgradeable `AccessControl` with a transparent proxy

**Contracts**: `Registry` inheritance and `script` / `test/utils/DeployRegistry.sol`  
**Lenses**: catalog (initialization / upgrade), language/protocol

**Mechanism**: Registry is deployed as `TransparentUpgradeableProxy` with `Initializable` + `_disableInitializers()`, but inherits **non-upgradeable** `AccessControl` (OZ 5.1.0 stores `_roles` at sequential slot 0). The installed tree includes `AccessControlUpgradeable` (ERC-7201) and `AccessControlDefaultAdminRules`. `initialize` grants both `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE` to a single address. The TUP **admin** is that same EOA, who can replace the Registry implementation independently of `onlyRole`.

**Consequence**: A future Registry upgrade that adds a non-namespaced parent or sequential field can collide with `_roles`. A compromised admin key can change Registry bytecode and `setChamberImplementation` (new chambers only). There is no two-step admin transfer or default-admin delay.

**Recommendation**: Use `AccessControlUpgradeable` (and consider `AccessControlDefaultAdminRules` or `Ownable2Step` for the proxy admin). Keep factory-admin powers on a timelock. Existing chambers remain isolated because they own their `ProxyAdmin`.

**Severity**: **Medium** — upgrade-storage and single-key factory risk; one-clause: *upgradeable Registry is wired with the non-upgradeable AccessControl layout*.

---

#### M-06 — Wallet transactions never expire

**Contracts**: `Wallet` transaction array; `Chamber` execute  
**Lenses**: adversarial, catalog (griefing)

**Mechanism**: A submitted nonce stays executable until it is executed or a **live** cancel quorum is reached. There is no deadline field.

**Consequence**: Forgotten or socially-retracted calls remain live and pick up H-01 / M-04. Cancel requires a full current quorum, which may be harder than execute if confirmations are already sticky.

**Recommendation**: Store a deadline at submit (or a global max age) and treat expiry like cancel. Default conservative (e.g. 30 days).

**Severity**: **Medium** — unbounded execution window on a treasury; one-clause: *approvals do not time out*.

---

#### M-07 — Vault asset is unconstrained; ERC-4626 hooks are unguarded

**Contracts**: `Chamber.initialize` / inherited `ERC4626Upgradeable` (`_deposit` / `_withdraw` in OZ 5.1.0)  
**Lenses**: catalog (token weirdness, first-depositor)

**Mechanism**: `createChamber` accepts any ERC-20. OZ 5.1.0 ERC-4626 uses `SafeERC20` (return-value safe) and virtual shares via `_decimalsOffset()`. Chamber sets offset `3`. Deposit mints shares from the **requested** asset amount, not the observed balance delta. Entry points are not `nonReentrant`. OZ’s own ERC-4626 comments still warn that offset mitigates but does not eliminate donation/slippage.

**Consequence**: Fee-on-transfer assets mint shares for value the vault never received (dilution). Rebasing assets move `totalAssets()` without share mint/burn. Callback tokens can reenter (see M-02). Offset `3` makes empty-vault donation expensive but not impossible at tiny sizes.

**Recommendation**: Document supported assets (standard ERC-20 only). Optionally measure `balanceOf` before/after transfer. Consider a higher offset or an initial dead-share deposit at factory time. Add `nonReentrant` on vault entry points.

**Severity**: **Medium** — integrators can pick an asset that breaks share accounting; one-clause: *the vault inherits OZ’s generic ERC-20 assumptions without extra filters*.

---

### Low

#### L-01 — Permissionless `createChamber` grows unbounded index arrays

**Contracts**: `Registry.createChamber`, `getAllChambers`, `getChambersByAsset`, `getChildChambers`  
**Lenses**: catalog (griefing)

**Mechanism**: Anyone can deploy chambers. Each call appends `chambers`, possibly `assets` / `chambersByAsset`, and parent/child links when the asset is itself a chamber. `getChambers(limit, skip)` is paginated; `getAllChambers` and the by-asset/child getters are not.

**Consequence**: Indexing grief and view-call OOG for consumers that use the unbounded getters. Does not take existing chamber funds. Anyone can also register a “child” of an honest chamber by using its share token as the new vault asset (index pollution only).

**Recommendation**: Keep pagination as the supported API; cap or deprecate unbounded getters. Consider a creation fee or `ADMIN_ROLE` gate if spam becomes operationally expensive.

**Severity**: **Low** — factory spam and indexer DoS; one-clause: *creation is free and several getters still return full arrays*.

---

#### L-02 — No pause / guardian on Chamber

**Contracts**: `Chamber` (missing `PausableUpgradeable`)  
**Lenses**: structural, catalog

**Mechanism**: Installed OZ 5.1.0 includes `PausableUpgradeable`. Nothing can halt deposit, delegation, or wallet execute if a live issue is found short of a quorum upgrade.

**Consequence**: Incident response is “win a board vote and upgrade” under H-01/H-02 conditions, which may be the failing path.

**Recommendation**: Add a pause controlled by the same wallet quorum (or a short-lived guardian with a hard expiry) covering vault + wallet execute.

**Severity**: **Low** — missing library incident control; one-clause: *no pause primitive on a treasury that can upgrade itself*.

---

#### L-03 — Custom Board `circuitBreaker` duplicates OZ transient reentrancy

**Contracts**: `Board` transient lock vs `ReentrancyGuardTransient` in OZ 5.1.0  
**Lenses**: language/protocol (Skill 1)

**Mechanism**: Board implements `tload`/`tstore` on `keccak256("loreum.Board.circuitBreaker")`. The library already provides a transient reentrancy guard with a documented ERC-7201 slot.

**Consequence**: Two lock designs, two error types, easy to leave a function on the wrong lock (M-02). Cancun-only (`foundry.toml` is Cancun; pre-Cancun deploys would break `_delegate`).

**Recommendation**: Inherit `ReentrancyGuardTransientUpgradeable` (or one Chamber-level guard) and delete the custom assembly.

**Severity**: **Low** — custom security primitive beside a library equivalent; one-clause: *Board reimplemented transient reentrancy*.

---

#### L-04 — Hash-only calldata makes execution depend on off-chain retention

**Contracts**: `Wallet._submitTransactionWithMetadata`, `_executeTransaction`  
**Lenses**: structural

**Mechanism**: Only `keccak256(data)` is stored. Execute requires the original bytes. The full payload is in the `SubmitTransaction` event and optional `metadataURI`.

**Consequence**: If logs and metadata are unavailable, a fully confirmed transaction cannot be executed (liveness), not stolen. This matches Gnosis Safe’s hash pattern and is acceptable if the app always persists calldata.

**Recommendation**: Treat event/metadata persistence as a product invariant; consider storing calldata on-chain for upgrade/self-calls only.

**Severity**: **Low** — execution liveness / ops; one-clause: *calldata is not in storage*.

---

#### L-05 — `BoardTypes` / `WalletTypes` do not match on-chain layouts

**Contracts**: `types/BoardTypes.sol`, `types/WalletTypes.sol`  
**Lenses**: language/protocol

**Mechanism**: Files comment that they are legacy. `BoardTypes.Node` still uses `uint256 next/prev`; on-chain `Board.Node` packs `uint128`. `WalletTypes.Transaction` still has `bytes data`; on-chain uses `bytes32 dataHash`.

**Consequence**: Off-chain tooling that imports these libraries will decode storage or calldata wrong.

**Recommendation**: Update the libraries to the packed / hash-only shapes, or rename them so they cannot be mistaken for ABI types.

**Severity**: **Low** — documentation/ABI drift; one-clause: *helper structs disagree with `Board`/`Wallet` storage*.

---

### Informational

#### I-01 — Dead or misnamed ABI surface

`acceptAdmin` is an intentional no-op. `DirectorshipChanged` and `QuorumUpdated` are never emitted. Several `IChamber` / `IBoard` errors are unused (`TransferFailed`, `CannotTransfer`, `InvalidDelegation`, `InvalidNFTOwner`, `InvalidQuorum`, `InvalidSignature`, `ArrayIndexOutOfBounds`, `NotOnLeaderboard`, `SupporterNotOnLeaderboard`). `upgradeImplementation` reverts `NotDirector` when `ProxyAdmin.owner() != address(this)` (comment admits the name is historical). `Registry.proxyAdmin()` is the initialize `admin` EOA, not `Chamber.getProxyAdmin()`.

**Recommendation**: Emit the reserved events on real transitions, or drop dead errors/events at the next breaking ABI. Use `NotAuthorized` / `NotProxyAdminOwner` for the upgrade owner check.

**Severity**: **Informational** — ABI clarity; one-clause: *reserved events/errors and historical names can mislead integrators*.

---

#### I-02 — Quorum comment vs formula

`Board._getQuorum` is documented as “51% of seats + 1” and implemented as `1 + (seats * 51) / 100`. For many seat counts that is closer to ~55–67% than “simple majority + 1”. One- and two-seat chambers require 100% of seats.

**Recommendation**: Document the exact integer formula and the 1–2 seat special case in user-facing docs.

**Severity**: **Informational** — spec mismatch; one-clause: *the comment overstates how tight quorum is*.

---

#### I-03 — One address with many director NFTs holds many votes

`isDirector` and confirmations are per `tokenId`. A single owner of `quorum` membership NFTs that sit in the top seats can submit, self-confirm, and execute.

**Recommendation**: Document as intended (NFT-weighted, not 1-address-1-vote). If that is not the product intent, cap confirmations per `ownerOf`.

**Severity**: **Informational** — design assumption; one-clause: *quorum is token-weighted, not account-weighted*.

---

#### I-04 — No ERC-1155 receiver; ERC-721 receiver is open

`onERC721Received` accepts any collection. There is no `onERC1155Received`. Directors can still move received ERC-721s out via wallet calls.

**Recommendation**: Document that ERC-1155 `safeTransferFrom` to Chamber will revert; whitelist if the product should only custody the membership collection.

**Severity**: **Informational** — token custody surface; one-clause: *NFT intake is unfiltered; ERC-1155 intake is absent*.

---

## Cleared items

These were explicitly checked on the current source. “Cleared” means the previously described bug is not present, or the behavior is an accepted, enforced invariant — not that residual risk is zero.

| Item | Result |
| --- | --- |
| Permissionless `upgradeImplementation` (2026-02-06 critical) | **Cleared.** `msg.sender == address(this)` plus `ProxyAdmin.owner() == address(this)`. |
| Double delegation vs `balanceOf` (2026-02-06 critical) | **Cleared.** `totalHolderDelegations` is updated and checked against cached `balanceOf`. |
| ERC-4626 `withdraw`/`redeem` bypass of transfer locks (Finding 4) | **Cleared.** `_update` blocks outgoing moves that would drop below `totalHolderDelegations`. |
| Board `MAX_NODES` hard revert / 1-wei fill (2026-02-06 high) | **Cleared.** Full list evicts `tail` when the new amount is strictly greater. |
| First-depositor donation with offset 0 (Finding 6) | **Mitigated.** `_decimalsOffset() == 3` as in OZ 4.9+ guidance. Residual tiny-size risk in M-07. |
| Seat-update counts evicted supporters (Finding 7) | **Cleared** for seats. Wallet confirmations are **not** analogous (H-01). |
| Evicted-node `undelegate` revert (Finding 11) | **Cleared** for the write path. Read path still incomplete (M-03). |
| Minority seat-proposal cancel (Finding 14) | **Cleared** as specified; inverse liveness issue is H-03. |
| Implementation `initialize` on logic contracts | **Cleared.** Chamber and Registry constructors call `_disableInitializers()`. |
| Chamber ERC-7201 slot constants | **Cleared.** Formula matches `loreum.Chamber` / `Board` / `Wallet` / `ChamberRegistry`. |
| Wallet CEI + failed-call rollback | **Cleared.** `executed` is set before `call` and cleared only if the call fails; `DataHashMismatch` before the call. |
| Confirm after cancel | **Cleared.** `_confirmTransaction` uses `notCancelled`. |
| Self-call surface | **Cleared** as a selector filter. `_validateTransaction` and batch submit allow `address(this)` only for `upgradeImplementation` (`0xc89311b6`). |
| Registry cannot upgrade existing chambers | **Cleared.** `ProxyAdmin` ownership is transferred to each chamber in the same `createChamber` transaction. |
| `setChamberImplementation` scope | **Cleared.** Future deploys only; emits `ChamberImplementationUpdated`. |
| Integer overflow on confirmation counts | **Cleared.** `uint8` vs `MAX_SEATS = 20`. |
| `tokenId > type(uint128).max` packing | **Cleared.** `_insert` reverts `TokenIdTooLarge`. |
| Solidity 0.8 checked arithmetic | **Cleared** for production math; `unchecked` uses only loop increments and size ±1 under caps. |
| No `delegatecall` in `src/` | **Cleared.** Upgrade uses OZ `ProxyAdmin.upgradeAndCall`. |
| `receive` / `fallback` | **Cleared** as ETH intake; unknown selectors do not dispatch privileged logic. |
| Wallet execute without director | **Cleared.** `isDirector` on all wallet mutators. Empty board / `tokenId == 0` reverts `NotDirector`. |
| Duplicate confirm | **Cleared.** `notConfirmed` / `TransactionAlreadyConfirmed`. |
| Batch length mismatch | **Cleared.** `ArrayLengthsMustMatch` on submit/execute batch. |
| Zero-address / zero-amount / zero-tokenId on core paths | **Cleared** for `initialize`, `delegate`, `undelegate`, share transfer, and submit validation. |
| Historical `Agent` / ERC-8004 registries | **Cleared (absent).** Not in current `src/`. |

---

## Build and tests

Foundry is configured as `make ci-test` → `forge test` in `contracts/` (CI: `.github/workflows/forge.yaml`). This review environment did not ship `forge` in `PATH`; Foundry v1.7.1 was installed to run the suite. Symbolic Halmos tests (`test/symbolic`, `--match-test symbolic`) were not executed here.

**Result (2026-08-26, `forge test --no-match-test symbolic` in `contracts/`)**:

- **277 passed, 0 failed, 0 skipped** (21 suites), including unit, fuzz, e2e, upgrade, and `test/findings/*`.
- **Production `src/` compiled with no Solc warnings.**
- One Solc warning **2072** (unused local `initialHead`) in `test/fuzz/BoardFuzz.t.sol:157` — test hygiene only, not a `src/` defect. Not promoted to a production finding.
- Offensive characterization tests **passed by observing still-open behavior** (not remediations):
  - `OffensiveReviewFindings.t.sol` — stale confirmations (H-01), permissive ERC-1271 (M-01), factory spam (L-01)
- Defensive tests that assert **fixed** behavior remain in `contracts/test/findings/` (Findings 1–4, 6–7, 9, 11, 14, etc.).

No failing tests. No production compiler warnings. No new severity items from the build.

GitHub Actions `Forge Tests` on `567e48c` (`cursor/chamber-src-security-review-7960`): **success** (1 check, no failures).

---

## Recommended next hardening steps

Priority is remediation design, not a rewrite. Suggested order:

1. **H-01 + M-04 + M-06** — Re-validate confirmers at execute; snapshot quorum and/or expiry on submit. This is the treasury integrity cluster.
2. **H-02** — Seating delay or checkpoints so board membership is not spot-priced in the same transaction as execute/upgrade.
3. **H-03** — Proposal expiry and cancel-by-current-board so seat liveness cannot wedge.
4. **M-01 + M-02 + L-03** — Replace custom 1271 and dual reentrancy locks with OZ `SignatureChecker` / a single `ReentrancyGuard` (transient or upgradeable) on all mutators, including ERC-4626.
5. **M-03** — Enumerable per-holder delegations (including evicted ids).
6. **M-05 + L-02** — `AccessControlUpgradeable` + two-step/default-admin rules on Registry; `PausableUpgradeable` on Chamber gated by wallet quorum.
7. **M-07 + L-01** — Asset allowlist or documented ERC-20 profile; factory spam controls if the registry is a public index.
8. **Docs / ABI** — L-05, I-01, I-02 so integrators stop reading legacy structs and unused events as live behavior.

Do not copy or embed OpenZeppelin sources. Depend on the already-vendored 5.1.0 contracts.

---

## Review limitations

- No bytecode-changing remediations were made.
- No exploit payloads or reproduction procedures are included.
- Teamshared memory/skills were unavailable (see Methodology).
- Formal verification (`halmos`) and Slither were not run for this deliverable; Halmos coverage exists separately under `contracts/test/symbolic/`. `forge test` excluding symbolic tests: 277 passed / 0 failed.
- Economic NFT-market assumptions (how easy quorum NFTs are to obtain) are qualitative.
)
