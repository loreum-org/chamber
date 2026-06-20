---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 1)
subject: Colony, Hats Protocol, Karpatkey/Llama, ERC-8004 agent governance
tags: [research-loop, chamber, colony, hats, erc-8004, karpatkey]
sources:
  - url: https://blog.colony.io/new-feature-fully-control-a-multi-sig-safe-with-a-dao/
    accessed: 2026-05-26
  - url: https://docs.hatsprotocol.xyz/using-hats/what-hats-do-i-need
    accessed: 2026-05-26
  - url: https://kpk.io/kpk-asset-management-framework/
    accessed: 2026-05-26
  - url: https://eips.ethereum.org/EIPS/eip-8004
    accessed: 2026-05-26
  - url: https://github.com/erc-8004/erc-8004
    accessed: 2026-05-26
---

# Extended governance competitors — Colony, Hats, Karpatkey, ERC-8004 (2026-05-26)

## Summary

Adjacent governance/treasury tools span **reputation-based DAOs (Colony)**,
**onchain role trees (Hats)**, **professional non-custodial treasury execution
(Karpatkey via Zodiac Roles)**, and **agent identity/reputation standards
(ERC-8004)**. None combine ERC4626 vault + NFT delegation board + agent directors
in one native stack per this research.

## Colony — quotes (verbatim)

> "Now, it's possible for your DAO on Colony to directly control the contents
> of a Safe(formerly Gnosis Safe) through your DAO governance processes."
> — [Colony blog, DAO control with a Multi-Sig Safe](https://blog.colony.io/new-feature-fully-control-a-multi-sig-safe-with-a-dao/)

> "Your DAO can now initiate Motions to trigger transactions from a Safe,
> including: Transferring funds, Transferring NFTs, Interacting with smart
> contracts, Creating raw transactions"
> — [Colony blog](https://blog.colony.io/new-feature-fully-control-a-multi-sig-safe-with-a-dao/)

> "Once initiated, Safe Control Motions proceed through the Colony governance
> process as any other Motion would, via the Lazy Consensus model."
> — [Colony blog](https://blog.colony.io/new-feature-fully-control-a-multi-sig-safe-with-a-dao/)

> "Colony's unique governance system serves as a powerful foundation for global
> organizations. Concepts like reputation-based governance and lazy consensus may
> be new to you, but you'll soon discover what a game-changer they are."
> — [Colony docs, Governance](https://docs.colony.io/learn/governance/)

## Hats Protocol — quotes (verbatim)

> "Hats Protocol is a protocol for DAO-native roles and credentials that supports
> revocable delegation of authority and responsibility."
> — [Dune, Hats Protocol dashboard description](https://dune.com/palmeradao/hats-protocol)

> "Hats are represented on-chain by non-transferable tokens that conform to the
> ERC1155 interface. An address with a balance of a given Hat token 'wears' that
> hat, granting them the responsibilities and authorities that have been assigned
> to the Hat by the DAO."
> — [Dune, Hats Protocol](https://dune.com/palmeradao/hats-protocol)

> "Top Hats should be worn by the highest-level governance surface of your
> organization."
> — [Hats docs, What Hats Do I Need?](https://docs.hatsprotocol.xyz/using-hats/what-hats-do-i-need)

> "Any address can wear a hat, so multisigs and pods can and often should be
> represented by hats as well."
> — [Hats docs](https://docs.hatsprotocol.xyz/using-hats/what-hats-do-i-need)

## Karpatkey (treasury execution pattern) — quotes (verbatim)

> "The core of Karpatkey's non-custodial and trust-minimised solution relies on
> the most battle-tested tooling to assist DAO treasuries: a proxy Management Safe
> and the Zodiac Roles Modifier."
> — [karpatkey, Framework for Active DAO Treasury Execution](https://kpk.io/kpk-asset-management-framework/)

> "The DAO treasury fund is held in a Safe wallet, controlled completely (1 out of
> 1) by the DAO. On the other hand, the Zodiac Roles Modifier Module enforces
> role-based permission presets that can unilaterally make calls to any pre-approved
> addresses, functions, and variables the role has access to."
> — [karpatkey framework](https://kpk.io/kpk-asset-management-framework/)

> "These presets are initially subject to community approval, e.g. Snapshot, and
> they can execute different types of pre-established sets of transactions."
> — [karpatkey framework](https://kpk.io/kpk-asset-management-framework/)

## ERC-8004 — quotes (verbatim)

> "To foster an open, cross-organizational agent economy, we need mechanisms for
> discovering and trusting agents in untrusted settings. This ERC addresses this
> need through three lightweight registries"
> — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)

> "Identity Registry - A minimal on-chain handle based on ERC-721 with URIStorage
> extension that resolves to an agent's registration file, providing every agent
> with a portable, censorship-resistant identifier."
> — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)

> "Reputation Registry - A standardized interface for publishing and reading
> feedback signals."
> — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)

> "Validation Registry - hooks for validator smart contracts to publish validation
> results."
> — [github.com/erc-8004/erc-8004 README](https://github.com/erc-8004/erc-8004)

> "While this ERC cryptographically ensures the registration file corresponds to
> the on-chain agent, it cannot cryptographically guarantee that advertised
> capabilities are functional and non-malicious."
> — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)

## Chamber implications (source-derived only)

- **Colony** and **Hats** offer alternative "who can act" models (reputation,
  revocable role trees) but still often compose with Safe for treasury custody.
- **Karpatkey pattern** shows market demand for constrained executors — similar
  job-to-be-done as agent auto-confirm, implemented via Zodiac Roles not native
  director policies.
- **ERC-8004** validates Chamber's ValidationRegistry direction but is identity/
  reputation infrastructure, not treasury governance — composable, not competitive.

## Open questions

- Would Chamber integrate Hats/ERC-1155 roles alongside NFT membership seats?
- Do DAOs choosing Karpatkey-style Roles still want a unified vault+board product?
