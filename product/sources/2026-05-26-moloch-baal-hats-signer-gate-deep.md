---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 2)
subject: Moloch v3 Baal and Hats Signer Gate — dynamic Safe governance
tags: [research-loop, chamber, moloch, baal, hats, zodiac]
sources:
  - url: https://baal-docs.vercel.app/
    accessed: 2026-05-26
  - url: https://github.com/Moloch-Mystics/Baal/
    accessed: 2026-05-26
  - url: https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority
    accessed: 2026-05-26
  - url: https://docs.hatsprotocol.xyz/for-developers/hats-signer-gate-v2
    accessed: 2026-05-26
---

# Moloch Baal + Hats Signer Gate — deep dive (2026-05-26)

## Summary

**Moloch v3 (Baal)** is a governance layer on Safe using Zodiac — membership shares,
ragequit minority protection, Shamans for privileged roles. **Hats Signer Gate**
dynamically adds/removes Safe signers based on who wears a Hat — the closest
competitor pattern to Chamber's **dynamic board** without NFT delegation vault.

## Moloch Baal — quotes (verbatim)

> "Baal is a governance layer that sits on top of a multisig treasury. It uses the Gnosis Zodiac standards to interface with the treasury."
> — [Baal docs](https://baal-docs.vercel.app/)

> "Shareholders are the collective DAO admins."
> — [Moloch-Mystics/Baal README](https://github.com/Moloch-Mystics/Baal/)

> "Members can ragequit to burn some amount of membership shares or loot shares and receive a proportional amount of funds from the treasury."
> — [Baal docs](https://baal-docs.vercel.app/)

> "It is a form of minority protection, meaning a member can ragequit (and withdraw their proportional stake) before a proposal is executed, even if the majority has approved it."
> — [Baal docs, Ragequit](https://baal-docs.vercel.app/features/ragequit)

> "Shamans - are specific addresses that have more granular control outside the standard governance proposal flow."
> — [Moloch-Mystics/Baal README](https://github.com/Moloch-Mystics/Baal/)

## Hats Signer Gate — quotes (verbatim)

> "Hats Signer Gate is a contract that grants Safe multisig signing rights to addresses wearing a given hat, enabling on-chain organizations (such as DAOs) to delegate revocable constrained signing authority and responsibility to individuals."
> — [Hats docs, Safe Multisig Signing Authority](https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority)

> "Grants multisig signing rights to addresses based on whether they are wearing the appropriate hat(s)."
> — [Hats docs](https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority)

> "Removes signers who are no long valid (i.e. no longer wearing the signer hat)"
> — [Hats docs](https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority)

> "Manages the multisig threshold within the owner-specified range as new signers are added or removed."
> — [Hats docs](https://docs.hatsprotocol.xyz/hats-integrations/permissions-and-authorities/safe-multisig-signing-authority)

> "HSG v2 is a contract that grants multisig signing rights to addresses wearing a given hats, enabling on-chain organizations to revocably delegate to individuals constrained authority and responsibility to operate an account (i.e. a Safe) owned by the organization."
> — [Hats docs, HSG v2](https://docs.hatsprotocol.xyz/for-developers/hats-signer-gate-v2)

> "WARNING: HatsSignerGate must not be attached to a Safe with any other modules."
> — [Hats docs, Creating New Instances](https://docs.hatsprotocol.xyz/for-developers/hats-signer-gate-sdk/creating-new-instances)

## Chamber implications

- **Hats Signer Gate** implements dynamic signer sets on Safe — overlaps Chamber's
  "directors change as power shifts" story but via ERC-1155 hats + Safe, not vault shares.
- **Baal ragequit** is a minority protection primitive Chamber does not document —
  potential product gap for contentious treasuries.
- Both **compose with Safe+Zodiac** — again modular incumbent stack.

## Open questions

- Do DAOs choosing HSG perceive it as sufficient vs rebuilding governance in Chamber?
- Is ragequit a must-have for Chamber's target segment?
