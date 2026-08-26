# Vaults (ERC4626)

Chamber instances function as fully compliant **ERC4626 Tokenized Vaults**. This ensures deep compatibility with the broader DeFi ecosystem.

## Asset Management

Every Chamber is paired with an underlying **ERC20 asset**.
- **Deposits**: Users deposit the underlying asset and receive "Chamber Shares".
- **Withdrawals**: Users burn shares to retrieve the underlying asset.

## Shares and Voting Power

Chamber shares represent two things:
1. **Economic Ownership**: A claim on the underlying assets held by the Chamber.
2. **Governance Power**: Only shareholders can delegate voting power to NFTs.

### Delegation Constraint
To prevent double-spending of voting power, the Chamber enforces a withdrawal limit:
`Available for Withdrawal = Total Balance - Total Amount Delegated`

If a user wish to withdraw more than their available balance, they must first **undelegate** a portion of their voting power.

## Yield & Integration

Since the Chamber follows the ERC4626 standard:
- It can be integrated into yield aggregators.
- Shares can be used as collateral in lending protocols.
- It provides a standardized interface for `deposit`, `withdraw`, `mint`, and `redeem` operations.

## ETH and NFT intake (not vault deposits)

These paths do **not** mint shares or change board seats.

- **ETH** sent to the Chamber is accepted (`receive` / payable `fallback`).
- **Any ERC-721** is accepted via `onERC721Received`. The hook does **not** restrict `msg.sender` to the membership collection (`nft()`). Chamber is intended to custody arbitrary ERC-721s; directors transfer them out through the wallet (`executeTransaction`).
- **ERC-1155 intake is absent.** There is no `onERC1155Received` / `onERC1155BatchReceived`. ERC-1155 `safeTransferFrom` to the Chamber reverts.
