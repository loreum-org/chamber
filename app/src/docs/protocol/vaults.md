# Vault (ERC‑4626)

Each Chamber is an **ERC‑4626 tokenized vault** wrapping one **underlying ERC‑20** configured at `initialize`. Chamber **share tokens** follow OpenZeppelin’s **`ERC4626Upgradeable`** semantics: `deposit`, `mint`, `withdraw`, and `redeem`, plus `preview*` helpers and standard ERC‑20 transfer behavior.

## Shares and underlying

- **Underlying asset** — immutable per proxy (set in `__ERC4626_init`).  
- **Shares** — fungible ERC‑20 minted to receivers on deposit/mint; burned on withdraw/redeem.  
- **Decimals offset** — `_decimalsOffset()` returns **`3`**, enabling virtual shares mitigation for classic ERC‑4626 inflation / donation attack classes (see OpenZeppelin ERC‑4626 docs).  

## Delegation constraint

Governance weight is **Chamber share balance delegated to membership token IDs**. To prevent **double use** of the same wei of shares as both “free balance” and delegated weight, **`Chamber._update`** enforces:

> After any outbound transfer of shares, **`balance(from) - totalHolderDelegations[from]`** must remain non‑negative (effectively: you cannot transfer or burn below what you’ve delegated).

Operationally:

- **Withdraw/redeem** respects the same rule as **transfer**.  
- Users **undelegate first** if they need to unlock balance for transfers or exits.  

Read helpers: **`getDelegations`**, **`getHolderDelegation`**, **`getTotalHolderDelegations`**.

## ETH and ERC‑721

Native ETH can land via **`receive` / `fallback`** (emits **`Received`**).

Membership NFTs can be **safely transferred** into the Chamber (`onERC721Received`); these are **not** ERC‑4626 deposits—they emit **`ReceivedERC721`** for indexing/UX.

## Integrations

ERC‑4626 compatibility allows composability with aggregators and lending markets **where share behavior is understood**; integrators should note the **delegation lock** on transfers, which is stricter than a plain ERC‑20.
