---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 3)
subject: Commonwealth (Common) — unified forum + Snapshot + onchain governance UI
tags: [research-loop, chamber, commonwealth, snapshot, governance-ui]
sources:
  - url: https://www.alchemy.com/dapps/commonwealth
    accessed: 2026-05-26
  - url: https://gov.frax.finance/t/fip-89-adopt-commonwealth-im-for-frax-governance-forum/1564
    accessed: 2026-05-26
  - url: https://docs.common.xyz/commonwealth/community-overview-2/governance/snapshot-bi-directional-integration/off-chain-governance
    accessed: 2026-05-26
---

# Commonwealth governance platform — deep dive (2026-05-26)

## Summary

**Commonwealth** (Common) is an all-in-one **governance UX platform**: web3-native
forum, Snapshot offchain voting, onchain proposal UI, chat bridges, and treasury
management hooks. Competes with Tally/Aragon on **coordination layer**, not custody.
700+ DAOs cited in Frax adoption proposal. Fragmentation reduction is the wedge —
similar JTBD to Chamber app proposal UX but without native treasury contract.

## Quotes (verbatim)

> "Commonwealth is a governance platform for on-chain communities that manages proposals, treasury, voting, membership, and more."
> — [Alchemy dapps, Commonwealth](https://www.alchemy.com/dapps/commonwealth)

> "Commonwealth also helps break down silos between chat apps like Discord, Telegram, and Riot by providing integrations for webhooks and bridges."
> — [Alchemy dapps, Commonwealth](https://www.alchemy.com/dapps/commonwealth)

> "No matter what protocol DAOs build on, Commonwealth allows them to participate in important on-chain actions like staking and voting through their app."
> — [Alchemy dapps, Commonwealth](https://www.alchemy.com/dapps/commonwealth)

> "Commonwealth is a great option for DAOs seeking to centralize all of their functions into one app."
> — [Alchemy dapps, Commonwealth](https://www.alchemy.com/dapps/commonwealth)

> "Commonwealth offers a fully crypto-native forum, voting interface (polls, Snapshot, and on-chain governance), and chat all in one product."
> — [Frax FIP-89](https://gov.frax.finance/t/fip-89-adopt-commonwealth-im-for-frax-governance-forum/1564)

> "We eliminate the need for multiple governance products / DAO tools. We offer fully crypto native discussion, chat, polling, onchain governance, Snapshot support, and member analytics / profiles."
> — [Frax FIP-89](https://gov.frax.finance/t/fip-89-adopt-commonwealth-im-for-frax-governance-forum/1564)

> "We power over 700+ DAOs including dYdX, Redacted Cartel, Axie Infinity, Osmosis, Staggate, Element Finance, Spiritswap, and soon Olympus."
> — [Frax FIP-89](https://gov.frax.finance/t/fip-89-adopt-commonwealth-im-for-frax-governance-forum/1564)

> "Currently the Frax governance community is highly fragmented (Telegram, Discord, Discourse, Snapshot, on-chain voting) and has little transparency into the discussion / voting activity."
> — [Frax FIP-89](https://gov.frax.finance/t/fip-89-adopt-commonwealth-im-for-frax-governance-forum/1564)

> "Communities that utilize Snapshot for off-chain governance are able to create and vote on Snapshot proposals via their community interface."
> — [Common docs, Off-Chain Governance](https://docs.common.xyz/commonwealth/community-overview-2/governance/snapshot-bi-directional-integration/off-chain-governance)

> "Linking Snapshot to your Common Community — Currently, only ERC-20 communities have access to Snapshot."
> — [Common docs, Off-Chain Governance](https://docs.common.xyz/commonwealth/community-overview-2/governance/snapshot-bi-directional-integration/off-chain-governance)

## Chamber implications

- Commonwealth sets the **unified governance app** bar (forum + vote + execute UI).
- Chamber app competes on proposal/queue UX but Commonwealth has **700+ DAO** scale
  and Snapshot bidirectional integration — Chamber lacks forum/discord consolidation.
- Commonwealth treasury features are UI over existing contracts — Chamber's onchain
  vault+board is deeper custody but shallower coordination tooling.

## Open questions

- Would Chamber partner with Commonwealth/Tally for UX vs build full coordination stack?
- Does Frax-style fragmentation pain exist in Chamber's target segment?
