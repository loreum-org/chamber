---
title: Membership and Equity
date: 2026-09-21
summary: Every company splits investors from executors. Investors struggle to influence execution. Executors struggle to gain economic upside. Chamber closes the gap with two tokens that trade against each other.
---

## The oldest split in business

Every company ever built runs on the same quiet division of labor: **investors own, employees do.**

The cap table and the org chart are two different documents, and the distance between them is where most companies bleed. Investors hold equity — real economic upside — but they are several steps removed from execution. They can hire and fire, vote at annual meetings, take a board seat. What they cannot do is make execution respond to them day to day. Their influence is seasonal: quarterly board meetings, annual proxy votes, the occasional crisis.

The people on the org chart have the opposite problem. They execute — they ship, sell, operate — but their connection to economic upside is thin and indirect. Salaries are fixed. Options, where they exist, come with vesting cliffs, strike prices, and an exit event nobody can schedule. The people doing the work rarely hold meaningful equity in the outcome of the work.

So both sides struggle. **Investors struggle to influence execution. Employees — the executors — struggle to gain economic upside.** Every management structure since the joint-stock company is really a patch on this split: board seats, proxy advisors, ESOPs, RSUs, phantom equity, earnouts. Each patch adds a lawyer and a footnote, and none of them closes the gap.

## Onchain governance inherited the flaw

When organizations moved onchain, they didn't escape the split — they compressed it into a single token.

In the standard token-voting model, one ERC-20 carries both roles at once. Holding the token makes you a shareholder and a governor simultaneously: your economic stake *is* your vote. This sounds elegant and produces two familiar failure modes.

**Whale dominance.** One wallet, one whale, one outcome. When voting weight is proportional to balance, governance is a liquidation preference with extra steps. Small holders rationally stop participating — their vote is noise — and turnout collapses, which hands even more power to the large holders who remain. Influence and stake get conflated, so neither works well.

**The opaque multisig.** The reaction to whale-rule was to move execution into a fixed signer set. But a multisig is a closed club: signers are pseudonymous addresses, the roster is static, and there is no mechanism for the token holders outside the club to reward good decisions or punish bad ones. You can read the chain and see *what* happened. You cannot influence *who* decides, and you cannot replace them if they underperform.

Notice that both failures are the startup's problem again, in different clothes. The whale is the investor whose equity buys influence but buys no accountability. The multisig signer is the executor who holds power but no economic stake — and whom nobody elected.

## Two tokens, two roles

A Chamber is a community-governed treasury built on a deliberate answer: **split the roles into two tokens, and connect them with a market.**

**Membership — the ERC-721.** A non-fungible token is a seat in the Chamber. Each token ID is a unique chair on a board of fixed size. Holding it is what gives you the *right to execute*: to submit proposals, confirm them at quorum, and carry them out. Seats are scarce by design. They can be transferred — sold, gifted, inherited — and every transfer recomputes the board.

**Equity — the ERC-20.** A fungible token is a claim on the Chamber's treasury. Deposit it into the Chamber's vault (an ERC-4626 tokenized treasury) and you hold shares: proportional economic ownership of everything the Chamber controls. Shares are divisible, liquid, and tradable on any DEX.

Neither token alone is governance. The two are joined by **delegation**: shareholders delegate their voting weight to the seat holders they trust, and the top-N most-delegated NFTs become the active board — the directors. That's the whole machine.

## The governance loop

1. Shareholders deposit the equity token into the vault and receive shares.
2. Shareholders delegate their voting power to NFT holders — revocably, any time.
3. Seat holders compete for that delegation: campaign, publish a track record, deliver.
4. The top-N delegated NFTs form the board.
5. A director submits a proposal — a treasury action, a contract call.
6. Quorum of directors confirm it (say, 3 of 5), and it executes.

Delegation is continuous, not annual. A director who underperforms bleeds delegation in real time and drops off the board. A newcomer who earns it takes a seat without asking anyone's permission — they only need shareholders to notice.

## A five-seat chamber

Five seats. One million equity tokens; the vault holds half of them.

Alice holds seat #1 and has attracted 300,000 shares of delegation. Bob 250,000, Charlie 200,000, Diana 150,000, Eve 100,000. Alice submits a proposal to pay a contractor 10,000 tokens. Bob, Charlie, and Diana confirm — quorum met, the payment executes, and every step is an onchain fact.

Now Eve sells her seat to Frank. Frank inherits nothing but the chair — delegation follows trust, not ownership, so he starts from zero and has to earn it. If he earns more than Diana, he replaces her on the board. The org chart updates itself, continuously, onchain.

## Why there is an NFT

The obvious question: why a non-fungible token at all? Why not just addresses?

**Scarcity.** A fixed seat count makes influence competitive. There are five chairs, not unlimited wallets — so getting one means persuading shareholders you'll use it well.

**Identity and accountability.** A seat is a persistent, queryable identity. "Who decided this?" stops being an archaeology project across multisig logs and becomes a lookup. Every director's record — proposals submitted, confirmed, executed — accumulates on the seat itself. Reputation becomes a property of the token.

**Transferability with consequences.** Because the seat trades, governance influence has a price and a market — but buying a seat buys you the *opportunity* to govern, not the power. Power still has to be delegated to you. You can't buy your way to a board majority; you can only earn one.

**Composability.** Seats are ERC-721s, so they plug into marketplaces, lending protocols, and reputation systems that already exist.

An address can't do any of this. An address is where a person happens to be; an NFT is a role that has a history.

## Closing the split

Now put the two halves of the old problem back on the table.

**Investors — the shareholders — finally get real influence over execution.** Not a board seat four times a year: a continuous, revocable delegation they can point at any seat holder on the board. If execution drifts, they re-point it. If it performs, they compound their weight behind it. Influence stops being an annual ritual and becomes a market signal — the same way capital moves, but with a paper trail.

**Executors — the members — finally get economic upside in what they execute.** A director is compensated for governing well, because governing well attracts delegation, and delegation is what makes a seat valuable enough to buy or sell. Directors can hold equity too — skin in the game they'd be foolish not to want. And because the seat itself is an asset, the person doing the work holds a balance-sheet item, not just a title. The employee-equity gap doesn't get patched; it gets priced.

This is the thing neither the cap table nor the org chart ever managed: **execution and equity are separate tokens, but they trade against each other.** The executors' standing is set by the people with economic stake. The investors' influence flows through the people with execution power. Each side disciplines the other through an open market, not a boardroom.

## What you get

- **Accountable leadership** — directors are identifiable, competitively selected, and re-selectable at any time.
- **Aligned incentives** — the people moving the treasury can hold a claim on it; the people with a claim choose who moves it.
- **Liquid governance** — both tokens trade. Entry and exit don't require anyone's permission and don't freeze the machine.
- **Scalable decisions** — shareholders don't vote on everything; they choose voters, and can change their minds.

## The point

Chambers didn't invent the tension between the people who own and the people who do. They're just the first structure where the tension resolves in public, onchain, continuously — instead of in a boardroom, annually, behind lawyers.

Investors get influence that works. Executors get upside that's real. The seat and the share are different tokens, and that's the whole trick.
