# Chamber Governance

Chamber combines ERC-4626 vault mechanics with an elected **board of directors**: membership NFT holders who receive delegated Chamber share voting weight rank on an on-chain leaderboard; the top seats form the board.

## Delegation

Share holders delegate Chamber ERC-20 balance (subject to custody rules) toward specific membership token IDs. Delegation drives board composition and Wallet quorum for treasury transactions.

## Transaction queue

Directors propose, confirm, and execute outbound calls through the Chamber Wallet module with quorum and nonce ordering. Proposal authors may attach durable metadata URIs on submission for disclosure and audit trails.

## Registry

The Registry deploys Chamber proxies with verified implementations and wires Transparent ProxyAdmin ownership so each Chamber controls its own upgrades via governance.
