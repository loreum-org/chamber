# Vision and primitives

Chamber merges three primitives that DAOs typically wire together manually:

1. **ERC‑4626 custody** — one share token accounting model for treasury deposits and withdrawals.  
2. **Fluid representation** — share holders delegate numeric weight toward **membership NFT token IDs**, producing an on-chain **leaderboard**.  
3. **Coordinated execution** — top seats act as multisig directors with **transparent quorum**, **explicit calldata**, **optional disclosure metadata**, and **upgrade hooks** mediated by **ProxyAdmin** ownership on each Chamber proxy.

Organizational hierarchy can be mirrored on-chain where a Chamber’s underlying asset **is itself another Chamber’s share token**, using **`Registry`** parent/child bookkeeping.

Operational extensions (risk dashboards, alerting, simulation) compose around these interfaces without replacing on-chain quorum or custody accounting.
