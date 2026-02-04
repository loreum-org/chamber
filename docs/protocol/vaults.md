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
