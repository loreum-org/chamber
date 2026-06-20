---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 3)
subject: OpenZeppelin Governor standalone deployments — timelock, treasury, Tally UX
tags: [research-loop, chamber, openzeppelin, governor, token-governance]
sources:
  - url: https://docs.openzeppelin.com/contracts/5.x/governance
    accessed: 2026-05-26
  - url: https://docs.tally.xyz/user-guides/governance-frameworks/openzeppelin-governor/
    accessed: 2026-05-26
  - url: https://docs.openzeppelin.com/contracts/5.x/api/governance
    accessed: 2026-05-26
---

# OpenZeppelin Governor standalone — deep dive (2026-05-26)

## Summary

**OpenZeppelin Governor** is the de facto onchain governance contract standard for
token DAOs. Typical deployment: ERC20Votes token + Governor modules +
**TimelockController** holding treasury assets. Proposal lifecycle is
propose → vote → **queue** → execute. Tally is the dominant UI layer. This is
the baseline stack Chamber's token-governance competitors inherit — distinct from
Chamber's NFT delegation board + native vault model.

## Quotes (verbatim)

> "Decentralized protocols are in constant evolution from the moment they are publicly released. Often, the initial team retains control of this evolution in the first stages, but eventually delegates it to a community of stakeholders. The process by which this community makes decisions is called on-chain governance, and it has become a central component of decentralized protocols, fueling varied decisions such as parameter tweaking, smart contract upgrades, integrations with other protocols, treasury management, grants, etc."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "For OpenZeppelin Contracts, we set out to build a modular system of Governor contracts so that forking is not needed, and different requirements can be accommodated by writing small modules using Solidity inheritance."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "Tally is a full-fledged application for user owned on-chain governance. It comprises a voting dashboard, proposal creation wizard, real time research and analysis, and educational content."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "For all of these options, the Governor will be compatible with Tally: users will be able to create proposals, see voting periods and delays following IERC6372, visualize voting power and advocates, navigate proposals, and cast votes."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "It is good practice to add a timelock to governance decisions. This allows users to exit the system if they disagree with a decision before it is executed."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "When using a timelock, it is the timelock that will execute proposals and thus the timelock that should hold any funds, ownership, and access control roles."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "If a timelock was set up, the first step to execution is queueing. You will notice that both the queue and execute functions require passing in the entire proposal parameters, as opposed to just the proposal id. This is necessary because this data is not stored on chain, as a measure to save gas."
> — [OpenZeppelin, How to set up on-chain governance](https://docs.openzeppelin.com/contracts/5.x/governance)

> "Timelock extensions add a delay for governance decisions to be executed. The workflow is extended to require a `queue` step before execution. With these modules, proposals are executed by the external timelock contract, thus it is the timelock that has to hold the assets that are being governed."
> — [OpenZeppelin, Governance API](https://docs.openzeppelin.com/contracts/5.x/api/governance)

> "The OpenZeppelin Governor is a contract for onchain governance, designed to be compatible with existing systems based on Compound's GovernorAlpha and GovernorBravo."
> — [Tally docs, OpenZeppelin Governor](https://docs.tally.xyz/user-guides/governance-frameworks/openzeppelin-governor/)

> "Voting power is determined based on the number of tokens delegated to each address. This means users must submit a delegation transaction before their tokens will be included in governance votes."
> — [Tally docs, OpenZeppelin Governor](https://docs.tally.xyz/user-guides/governance-frameworks/openzeppelin-governor/)

> "If the quorum threshold has been met and the vote gains majority support, the passed proposal is then placed into a timelock queue which delays code execution (this is currently set to 2 days for most governance systems). This timelock is intended as a security measure, allowing users to withdraw funds if they think the proposal is malicious or otherwise unacceptable."
> — [Tally docs, OpenZeppelin Governor](https://docs.tally.xyz/user-guides/governance-frameworks/openzeppelin-governor/)

> "However, in contrast to Compound Governor which requires use of a linked timelock to function, OpenZeppelin Governor can be deployed and used without a timelock if desired."
> — [Tally docs, OpenZeppelin Governor](https://docs.tally.xyz/user-guides/governance-frameworks/openzeppelin-governor/)

## Chamber implications

- Token-weighted delegation + timelock queue is the **default mental model** for
  "onchain governance" — Chamber's NFT board + ERC4626 vault is structurally different.
- OZ Governor shares Chamber's **queue-before-execute** pattern but stores proposal
  calldata offchain (events only) — same UX pain Chamber's app recently addressed.
- Tally + OZ Governor is the incumbent **governance UI + contract** pairing for token DAOs.

## Open questions

- Do Chamber target users already run OZ Governor + Tally and only need treasury custody?
- Is ERC721Votes wrapping a viable bridge for NFT communities vs Chamber native board?
