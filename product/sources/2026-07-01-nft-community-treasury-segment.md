---
type: research
created: 2026-07-01
methodology: automated web research (research loop iteration 4)
subject: NFT/community treasury segment vs OpenZeppelin Governor token-DAO path
tags: [research-loop, chamber, nft-dao, community-treasury, oz-governor, safe]
sources:
  - url: https://skrumble.com/learn/what-is-a-dao/
    accessed: 2026-07-01
  - url: https://www.spark.money/tools/crypto-dao-treasury-comparison
    accessed: 2026-07-01
  - url: https://truetech.dev/blockchain-development/services/dao
    accessed: 2026-07-01
  - url: https://medium.com/coinmonks/a-technical-post-mortem-of-superuman-dao-sudao-hack-flaws-of-existing-governance-tools-553de4d4736e
    accessed: 2026-07-01
---

# NFT / community treasury segment vs token Governor (2026-07-01)

## Summary

Research loop iteration 4 maps **two buyer paths** in the corpus:

1. **Token protocol DAOs** → OpenZeppelin Governor + Timelock + Tally (binding onchain)
2. **Community / hybrid treasuries** → Safe custody + offchain signaling (Snapshot) + module execution (Zodiac Reality/SafeSnap) OR role-based signers (Hats)

Chamber targets structural clarity (vault shares + NFT board + queue) — a third
native path not documented as standard in 2026 market guides.

## Hybrid DAO pattern — quotes (verbatim)

> "Most DAOs that survived past the initial token launch operate as hybrid entities: an executive team or core contributor group does day-to-day operations under multisig control; on-chain governance approves major decisions (treasury spend over a threshold, protocol upgrades, parameter changes)."
> — [Skrumble DAO guide 2026](https://skrumble.com/learn/what-is-a-dao/)

> "Many DAOs use both: open token-based voting for protocol parameters, multisig executive control for fast operational decisions."
> — [Skrumble DAO guide 2026](https://skrumble.com/learn/what-is-a-dao/)

> "Treasury spending in a DAO requires connecting proposal systems to fund execution. The standard pattern on EVM chains uses Snapshot for off-chain voting combined with a Safe multisig for on-chain execution, bridged by the Zodiac Reality Module (formerly SafeSnap)."
> — [Spark DAO treasury comparison](https://www.spark.money/tools/crypto-dao-treasury-comparison)

> "For fully on-chain governance, Tally integrates with OpenZeppelin Governor contracts to create binding proposals that execute automatically through timelocked controllers."
> — [Spark DAO treasury comparison](https://www.spark.money/tools/crypto-dao-treasury-comparison)

## OZ Governor as token-DAO baseline — quotes (verbatim)

> "Standard: OpenZeppelin Governor + TimelockController + ERC-20Votes (or ERC-721Votes for NFT-based)."
> — [TRUETECH DAO services](https://truetech.dev/blockchain-development/services/dao)

> "Minimum delay for TVL > $10M is"
> — [TRUETECH DAO services](https://truetech.dev/blockchain-development/services/dao) (timelock guidance for large treasuries)

> "Important: Safe multisig and Governor are different levels. Governor manages protocol (upgrades, parameters). Safe manages treasury (payouts, grants)."
> — [TRUETECH DAO services](https://truetech.dev/blockchain-development/services/dao)

## Composable stack risks — quotes (verbatim)

> "The SuDAO (SuperUMAn DAO) uses a Gnosis Safe Multisig wallet. In addition, it uses Snapshot in conjunction with the Zodiac Reality Module for the on-chain implementation of the governance votes."
> — [SuDAO hack post-mortem](https://medium.com/coinmonks/a-technical-post-mortem-of-superuman-dao-sudao-hack-flaws-of-existing-governance-tools-553de4d4736e)

> "Some of these existing composable governance and treasury management tools have been adopted without thorough vetting and configuration, thus posing a threat risking millions of dollars in treasuries."
> — [SuDAO hack post-mortem](https://medium.com/coinmonks/a-technical-post-mortem-of-superuman-dao-sudao-hack-flaws-of-existing-governance-tools-553de4d4736e)

## Chamber segment hypothesis

| Segment | Typical stack | Chamber fit |
|---------|---------------|-------------|
| Token protocol DAO (Uniswap-scale) | OZ Governor + Tally + Safe treasury | **Low** — entrenched Governor path |
| NFT / community treasury (Nouns Builder, Purple) | Safe + Hats elections + Snapshot/JokeRace | **Medium** — pain overlap, different architecture choice |
| Founder multisig graduating to rules | Safe → add modules OR greenfield Chamber | **High** — matches `why-not-multisig-positioning.md` |

## Open questions

- Do NFT/community treasuries explicitly avoid ERC-20Votes governance, or is it just not the default?
- Is SuDAO-style module risk a buyer motivator for Chamber's monolithic queue?
