Core concepts

1. Modular custody and governance

The Chamber combines ERC-4626 vault custody with NFT-backed membership and share-weight delegation:

- **Leaderboard of directors**: Stakeholders delegate Chamber share balance toward membership token IDs; the highest-weight IDs occupy board seats up to a configured maximum.
- **Quorum governance**: Directors propose, confirm, and execute outbound transactions through the Wallet module with transparent quorum rules.
- **Registry**: Verified Chamber implementations are deployed behind proxies with ProxyAdmin ownership transferred to each Chamber.

2. Execution model

Treasury moves are encoded as queued Wallet transactions; directors coordinate confirmations before execution. Proposal metadata URIs can be attached at submission time for accountability.

3. Smart-contract participation

Director addresses may be EOAs or smart contracts; where applicable the Chamber validates EIP-1271 signatures so contract wallets can govern alongside humans.

4. Open-source growth

Extensions live around Chamber surfaces—telemetry, analytics, automation—that integrate without replacing on-chain quorum or custody guarantees.

How it works

1. Users deposit underlying assets into the Chamber vault and receive Chamber shares.

2. Share holders delegate voting weight toward NFT-backed seats that compete on an on-chain leaderboard.

3. Sitting directors steward the transaction queue: submit targets and calldata, gather confirmations, and execute once quorum is satisfied.

4. Sub-chambers may nest vault hierarchies via the Registry when parent vault ERC-20 shares back child Chambers.

Use cases

1. Treasury governance with explicit multisig workflow on-chain.

2. Delegated voting toward designated membership representatives without sacrificing ERC-4626 accounting.

3. Structured upgrades and operational moves enforced through Wallet confirmations rather than EOAs holding funds directly.
