# Multisig wallet (queued execution)

The **`Wallet`** mixin inside **`Chamber`** implements a **nonce-ordered transaction queue** keyed by integer **`transactionId`** (also called **`nonce`** in some views). Only **current directors**, verified via **`isDirector(tokenId)`**, may participate.

## Storage model

For each transaction the contract stores:

- `target`, `value`, `executed`, `confirmations`  
- **`dataHash = keccak256(original calldata)`** — raw calldata is **not** persisted (gas savings), only its hash.  
- Optional **`metadataURI`** if submitted with **`submitTransactionWithMetadata`**.  

**Execution requires the caller to pass the full calldata again**; the runtime checks **`keccak256(data) == dataHash`** (`DataHashMismatch` on failure).

**`SubmitTransaction`** events include the full **`bytes data`** so indexers and UIs can retain execution payloads.

## Lifecycle

1. **Submit** — **`submitTransaction(tokenId, target, value, data)`** validates `target`/`value`, stores the hash, and **auto-confirms** for `tokenId`.  
2. **Confirm** — Other directors call **`confirmTransaction`**.  
3. **Execute** — **`executeTransaction(tokenId, transactionId, data)`** requires **`confirmations >= getQuorum()`**, not cancelled, then performs **`target.call{value: value}(data)`** after marking executed (CEI / revert pattern on failure).  

**`revokeConfirmation`** lowers the count if governance needs to walk back support before execution.

## Self-calls and upgrades

If **`target == address(Chamber)`**, calldata is restricted: only **`upgradeImplementation(address,bytes)`** is permitted (validated by selector). Arbitrary recursive calls into the Chamber are blocked to reduce foot-gun risk.

## Cancellation

**`cancelTransaction`** records cancel votes keyed by **`tokenId`**. When **`cancelConfirmations >= getQuorum()`**, the nonce is **cancelled** and cannot proceed to execution; further confirmations revert.

## Batching

- **`submitBatchTransactions`** — multiple proposals in one call; total **ETH** budget must not exceed balance; each entry validated like single submit.  
- **`confirmBatchTransactions`** / **`executeBatchTransactions`** — loop over IDs; **`executeBatch`** requires a **`bytes[] data`** array aligned with **`transactionIds`**.  

If any step in a batch **reverts**, the **entire outer call** reverts (standard Solidity semantics)—there is no partial commit.

## Reentrancy

Submit/confirm/execute/batch/cancel paths on **`Chamber`** use **`nonReentrant`** on the external entrypoints in addition to internal CEI discipline in **`_executeTransaction`**.
