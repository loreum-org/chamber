---
type: research
created: 2026-07-01
methodology: automated web research (research loop iteration 4)
subject: Hats Signer Gate displacement — do buyers compose Safe+HSG instead of native Chamber?
tags: [research-loop, chamber, hats, purple, treasure, questbook, competitive]
sources:
  - url: https://www.hatsprotocol.xyz/wearer/purple
    accessed: 2026-07-01
  - url: https://www.hatsprotocol.xyz/wearer/multisigs
    accessed: 2026-07-01
  - url: https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority
    accessed: 2026-07-01
  - url: https://forum.safefoundation.org/t/discussion-obra-formalizing-the-guardian-role-onchain-with-hats-protocol-hats-protocol/4631
    accessed: 2026-07-01
---

# Hats Signer Gate displacement validation (2026-07-01)

## Summary

Iteration 4 triangulates **real DAO adopters** of Hats Signer Gate (HSG) on Safe:
Purple (Nouns Builder DAO), TreasureDAO, Questbook, RareDAO. Pattern: they keep
**Safe custody** and add **dynamic signers via hats + elections** — they do not
deploy a native vault+board+queue stack like Chamber.

## Purple (Nouns Builder DAO) — quotes (verbatim)

> "Purple, a pioneering Nouns Builder DAO, is leveraging Hats Protocol to bring its organizational roles onchain, ensuring fair elections and transparent accountability for its Security Council and directly responsible individuals including a Grants Chair and Revenue Chair."
> — [Hats Purple case study](https://www.hatsprotocol.xyz/wearer/purple)

> "This shift to delegated-decision making and accountability with Hats has decreased time spent on proposals across the DAO by 80% while holding security constant."
> — [Hats Purple case study](https://www.hatsprotocol.xyz/wearer/purple)

> "Purple tries to live the values of decentralization but before Hats there were still people who were appointed to multi-sigs who controlled certain funds and initiatives. Additionally some of those multi-sig members became inactive and it became more difficult to sign transactions."
> — Chris Carella, founder of Purple, [Hats Purple case study](https://www.hatsprotocol.xyz/wearer/purple)

> "The elected Security Council members automatically receive signing authority on the Security Council multisig via their Hats."
> — [Hats Purple case study](https://www.hatsprotocol.xyz/wearer/purple)

> "With Hats, Purple is defining a repeatable operational structure for all Nouns Builder DAOs"
> — [Hats Purple case study](https://www.hatsprotocol.xyz/wearer/purple)

## TreasureDAO + Questbook — quotes (verbatim)

> "TreasureDAO is giving more voice to its community through a Hats-powered council that can represent TreasureDAO in Arbitrum governance and vote with delegated $ARB in a safe and secure way"
> — [Hats multisigs case study](https://www.hatsprotocol.xyz/wearer/multisigs)

> "Questbook has granted designated Grants Allocators the ability to distribute grants allocated to them by the Arbitrum ecosystem across four domains. Questbook uses Hats to retain ultimate control over those Safes"
> — [Hats multisigs case study](https://www.hatsprotocol.xyz/wearer/multisigs)

> "RareDAO: streamlining the process of granting and transferring multisig signing authority from one set of committee members to another with each election"
> — [Safe Community Forum, OBRA + Hats discussion](https://forum.safefoundation.org/t/discussion-obra-formalizing-the-guardian-role-onchain-with-hats-protocol-hats-protocol/4631)

## HSG product constraints — quotes (verbatim)

> "Hats Signer Gate is a contract that grants Safe multisig signing rights to addresses wearing a given hat, enabling on-chain organizations (such as DAOs) to delegate revocable constrained signing authority and responsibility to individuals."
> — [Hats docs](https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority)

> "WARNING: HatsSignerGate must not be attached to a Safe with any other modules."
> — [Hats docs, HSG v2](https://docs.hatsprotocol.xyz/for-developers/hats-signer-gate-v2) (referenced in iter 2)

## Chamber implications

- **Displacement confirmed at pattern level:** NFT/community DAOs (Purple, Treasure)
  solve dynamic authority on **Safe + Hats**, not by replacing Safe with Chamber vault.
- Purple's pain (inactive signers, appointed multisigs) overlaps Chamber positioning
  but their chosen fix is **role elections → hat → Safe signer**, not delegation board.
- HSG lacks ERC4626 vault shares, membership NFT board ranking, and native calldata queue.
- Purple explicitly positions Hats as blueprint for **Nouns Builder DAOs** — Chamber's
  adjacent segment.

## Open questions

- Would Purple have considered Chamber if it existed at launch, or is Safe composability mandatory?
- Do buyers perceive HSG's module exclusivity constraint as acceptable vs Chamber monolith?
