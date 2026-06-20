---
type: research
created: 2026-05-26
methodology: automated web research (research loop iteration 2)
subject: Nouns Flows capital deployment, Agent Bravo AI governance, Zodiac security incident
tags: [research-loop, chamber, nouns, agent-bravo, zodiac, security]
sources:
  - url: https://gitcoin.co/research/nouns-dao-governance-evolution
    accessed: 2026-05-26
  - url: https://github.com/mikeghen/agent-bravo-contracts
    accessed: 2026-05-26
  - url: https://help.safe.global/articles/3569845223-zodiac-module-vulnerability
    accessed: 2026-05-26
  - url: https://www.cryptotimes.io/2026/06/03/zodiac-reveals-flaw-behind-gnosis-pay-exploit-safe-unaffected/
    accessed: 2026-05-26
---

# Nouns Flows, Agent Bravo, Zodiac security — deep dive (2026-05-26)

## Nouns / Flows.wtf — quotes (verbatim)

> "Nouns DAO evolved from direct proposals (bottleneck) to Prop House (faster but still manual) to Flows.wtf (continuous, curated funding)."
> — [Gitcoin Research, Nouns DAO evolution](https://gitcoin.co/research/nouns-dao-governance-evolution)

> "Flows.wtf represents the next evolution: from discrete competitive rounds to continuous, community-curated fund streaming."
> — [Gitcoin Research](https://gitcoin.co/research/nouns-dao-governance-evolution)

> "Flows enables second-by-second fund distribution to approved recipients, governed by Nouns holders via L2 proofs."
> — [Gitcoin Research](https://gitcoin.co/research/nouns-dao-governance-evolution)

> "Direct proposals maximized legitimacy but constrained velocity. Prop House improved velocity but sacrificed sustainability. Flows.wtf attempted to address all three simultaneously through continuous streaming and TCR-based curation."
> — [Gitcoin Research](https://gitcoin.co/research/nouns-dao-governance-evolution)

> "By early 2026, the platform reported 605 builders funded across active flows spanning multiple ecosystems including Higher, Zora, and Farcaster."
> — [Gitcoin, Flows.wtf app](https://gitcoin.co/apps/flows-wtf)

## Agent Bravo — quotes (verbatim)

> "Agent Bravo is a framework that enables delegates to operate AI agents capable of participating in any GovernorBravo-compatible governance system."
> — [mikeghen/agent-bravo-contracts README](https://github.com/mikeghen/agent-bravo-contracts)

> "Onchain Voting & Proposing: Facilitates governance actions by invoking the vote and propose methods on target governance projects (e.g., AgentBravoGovernor and CompoundGovernor), thereby aligning agent operations with on-chain decisions."
> — [agent-bravo-contracts README](https://github.com/mikeghen/agent-bravo-contracts)

> "Policy Enactment - Enact policies (i.e., system prompts) provided by the agent's delegate owner."
> — [agent-bravo-backend README](https://github.com/mikeghen/agent-bravo-backend)

> "Cast votes on proposals directly on the blockchain."
> — [agent-bravo-backend README](https://github.com/mikeghen/agent-bravo-backend)

> "Be conservative and vote no if there seems like any chance the proposal could have a negative impact on our community"
> — [agent-bravo-backend, example policy template](https://github.com/mikeghen/agent-bravo-backend)

## Zodiac security incident (June 2026) — quotes (verbatim)

> "Important: this is an issue in third-party Zodiac modules, not in Safe. The Safe smart contracts, the Safe{Wallet} app, Safe infrastructure, and the Account Recovery feature are not affected and require no action."
> — [Safe Knowledge Base, Zodiac Module Vulnerability](https://help.safe.global/articles/3569845223-zodiac-module-vulnerability)

> "You are only potentially affected if your account uses one of these specific module versions: Roles Modifier v2 (versions 2.1.0 and 2.1.1), Delay Modifier v1.1.0"
> — [Safe Knowledge Base](https://help.safe.global/articles/3569845223-zodiac-module-vulnerability)

> "The vulnerability affected Roles Modifier v2 and Delay Modifier v1.1.0 under a specific set of conditions."
> — [Crypto Times, Zodiac disclosure](https://www.cryptotimes.io/2026/06/03/zodiac-reveals-flaw-behind-gnosis-pay-exploit-safe-unaffected/)

> "The issue did not affect Safe smart contracts, Safe{Wallet} infrastructure, account recovery systems, or the Safe user interface."
> — [Crypto Times](https://www.cryptotimes.io/2026/06/03/zodiac-reveals-flaw-behind-gnosis-pay-exploit-safe-unaffected/)

## Chamber implications

- **Nouns/Flows** competes on **capital deployment velocity**, not treasury custody model —
  different axis from Chamber but relevant for grant-heavy DAOs.
- **Agent Bravo** is Governor-token voting with LLM policies — differs from Chamber's
  **director seat + transaction queue** model; low adoption (4 GitHub stars in prior research).
- **Zodiac module risk** is a real counterweight to "just integrate with Safe modules" —
  Chamber native queue avoids third-party module composition risk but must prove security story.

## Open questions

- Does Chamber need continuous funding (Flows-like) or only discrete transaction queue?
- How to position agent directors vs Agent Bravo's Governor-delegate pattern?
- Does Zodiac incident increase appetite for native governance contracts?
