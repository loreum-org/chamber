# Discovery query — Where does Chamber sit in the governance stack?

> Corpus: **developing**, 15 sources, no user interviews.

## Findings

### 1. OpenZeppelin Governor + Timelock is the default onchain governance contract for token DAOs

**Multi-source** (OZ docs + Tally docs + prior Safe/Zodiac research).

> "When using a timelock, it is the timelock that will execute proposals and thus the timelock that should hold any funds, ownership, and access control roles."
> — `2026-05-26-openzeppelin-governor-standalone-deep.md`

> "For all of these options, the Governor will be compatible with Tally"
> — `2026-05-26-openzeppelin-governor-standalone-deep.md`

> "Voting power is determined based on the number of tokens delegated to each address."
> — `2026-05-26-openzeppelin-governor-standalone-deep.md`

Confidence: **Multi-source** for contract pattern; **Assumed** Chamber's NFT board competes in same buyer decisions.

### 2. OZ Governor shares Chamber's calldata-at-execution UX pattern

**Multi-source** (OZ docs + Chamber product intent).

> "both the queue and execute functions require passing in the entire proposal parameters, as opposed to just the proposal id. This is necessary because this data is not stored on chain, as a measure to save gas."
> — `2026-05-26-openzeppelin-governor-standalone-deep.md`

> "calldata checked against a stored hash"
> — `chamber-product-intent.md`

Confidence: **Multi-source** pattern similarity; not buyer-validated as pain.

### 3. Parcel is treasury ops on Safe — governance stays external

**Single-source** (Chainscore + Parcel docs).

> "Governance is typically an external step (e.g., a Snapshot vote) before using Parcel as an execution tool."
> — `2026-05-26-parcel-treasury-ops-deep.md`

> "some large DAOs use both: Llama for high-value proposal governance and Parcel for executing the approved recurring payments."
> — `2026-05-26-parcel-treasury-ops-deep.md`

Confidence: **Single-source** on stack pattern. Parcel is **adjacent** to Chamber, not a governance-core competitor.

### 4. Commonwealth competes on unified coordination UX

**Single-source** (Alchemy + Frax FIP).

> "We eliminate the need for multiple governance products / DAO tools."
> — `2026-05-26-commonwealth-governance-deep.md`

> "Currently the Frax governance community is highly fragmented (Telegram, Discord, Discourse, Snapshot, on-chain voting)"
> — `2026-05-26-commonwealth-governance-deep.md`

Confidence: **Single-source**. Competes with Tally/Chamber **app layer**, not custody contract.

### 5. Chamber occupies a distinct layer — but buyers may buy stacks not layers

**Inferred from corpus** — mark as gap, not finding.

Large DAO pattern emerging: Safe (custody) + OZ Governor/Llama (rules) + Tally/Commonwealth (UX) + Parcel (ops). Chamber proposes replacing custody+authority core; buyers may extend Safe instead.

Confidence: **Assumed** — needs buyer validation.

## Stack map (corpus-supported)

```
Coordination UX    →  Commonwealth, Tally, Aragon app
Governance rules   →  OZ Governor, Llama, Baal, Chamber contracts
Treasury ops       →  Parcel, Karpatkey
Custody avatar     →  Safe
```

Chamber spans **governance rules + custody** natively; competitors often compose layers.

## Gaps

- No evidence target buyers want single-contract vs composable stack.
- Parcel current adoption metrics post-2021 unknown.
- Commonwealth onchain execution depth vs Tally unclear.
- Whether NFT/community treasuries avoid OZ Governor path entirely — silent.

## Discovery questions

1. Walk me through your last treasury proposal — which tools did you use at each step?
2. Do you run OpenZeppelin Governor, or something else? Why?
3. How do you handle contributor payroll — Safe, Parcel, manual, other?
4. Would you switch treasury contracts, or add tools on top of Safe?
5. Is forum/discussion fragmentation a real pain, or acceptable overhead?

Answer your question from the findings. Fill the gaps before you commit to anything.
