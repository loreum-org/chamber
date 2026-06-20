---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 2)
subject: Tally governance platform — MultiGov, Relay, production features
tags: [research-loop, chamber, tally, multichain]
sources:
  - url: https://docs.tally.xyz/on-chain-operations/governance
    accessed: 2026-05-26
  - url: https://docs.tally.xyz/on-chain-operations/governance/multigov
    accessed: 2026-05-26
  - url: https://wormhole.com/blog/multigov-is-now-live-on-solana-ethereum-and-any-evm-l2
    accessed: 2026-05-26
  - url: https://docs.tally.xyz/how-to-use-tally/voting-on-proposals/relay/
    accessed: 2026-05-26
---

# Tally governance — deep dive (2026-05-26)

## Summary

**Tally** is a production governance platform (not just Safe linking): onchain
proposal lifecycle, delegation, security council elections, optimistic governance,
**MultiGov** multichain hub-and-spoke, and **Relay** gasless voting via OpenZeppelin
Defender sponsorship. Mature proposal UX and execution automation — Chamber gap
on proposal layer remains salient.

## Quotes (verbatim)

> "Deploy production-ready governance that scales with your protocol without requiring vendor migrations or custom integration work."
> — [Tally docs, Governance](https://docs.tally.xyz/on-chain-operations/governance)

> "Voting and proposal management: Secure, transparent voting mechanisms with collaborative proposal creation tools and no-code fund transfers. Approved proposals execute automatically with support for arbitrary executable actions."
> — [Tally docs, Governance](https://docs.tally.xyz/on-chain-operations/governance)

> "Delegation: Enable token holders to delegate voting power to trusted representatives without transferring token ownership."
> — [Tally docs, Governance](https://docs.tally.xyz/on-chain-operations/governance)

> "Optimistic governance: Streamline decision-making by assuming proposals pass unless explicitly vetoed by delegates, enabling faster execution while maintaining community oversight for critical decisions."
> — [Tally docs, Governance](https://docs.tally.xyz/on-chain-operations/governance)

> "MultiGov organizations use a hub-and-spoke model. This model combines well-understood building blocks – governor, token bridges, and message-passing."
> — [Tally docs, MultiGov](https://docs.tally.xyz/on-chain-operations/governance/multigov)

> "On the 'hub' chain, the organization has a standard ERC20Votes token and OpenZeppelin Governor with the Flexible Voting extension."
> — [Tally docs, MultiGov](https://docs.tally.xyz/on-chain-operations/governance/multigov)

> "MultiGov®, the first-of-its-kind multichain governance system, is now live on Solana, Ethereum mainnet, Base, Arbitrum, Optimism, and any supported EVM L2."
> — [Wormhole blog, MultiGov live](https://wormhole.com/blog/multigov-is-now-live-on-solana-ethereum-and-any-evm-l2)

> "Relay is a sponsorship system where organizations can cover the transaction costs for their members' governance activities like voting and delegating."
> — [Tally docs, Relay](https://docs.tally.xyz/how-to-use-tally/voting-on-proposals/relay/)

> "The technical foundation of Relay rests on OpenZeppelin Defender, a trusted security framework in the blockchain world."
> — [Tally docs, Relay](https://docs.tally.xyz/how-to-use-tally/voting-on-proposals/relay/)

> "Tally has processed hundreds of thousands of governance transactions, with associated gas fees reaching hundreds of thousands of dollars."
> — [Tally docs, Relay](https://docs.tally.xyz/how-to-use-tally/voting-on-proposals/relay/)

## Chamber implications

- Tally sets the **UX bar** for proposal creation, delegation, gasless participation,
  and multichain governance — areas flagged in Chamber competitive gaps.
- MultiGov is **token-weighted** hub-and-spoke, not NFT delegation leaderboard.

## Open questions

- Would Chamber target users accept Tally UI + Chamber contracts vs unified Chamber app?
- Does MultiGov reduce pressure for per-chain Chamber registry deployments?
