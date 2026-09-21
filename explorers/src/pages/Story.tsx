import { HeroBackground } from '@/components/ui'

/**
 * /story — Why the Loreum Explorer NFT exists
 * 
 * Explains the NFT as a membership token for the Loreum DAO ecosystem,
 * framed as exploration into uncharted domains of corporate legal and
 * equity structuring in the age of AI.
 */
export function Story() {
  return (
    <div className="relative">
      {/* Hero section */}
      <section className="bleed relative overflow-hidden pb-16 pt-12 lg:pb-24 lg:pt-20">
        <HeroBackground />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="animate-fade-up">
            <div className="eyebrow mb-4">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
              The Loreum Explorer
            </div>
            <h1 className="font-display text-4xl font-semibold text-slate-100 sm:text-5xl lg:text-6xl">
              Exploring Uncharted Domains
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
              Corporate legal and equity structuring in the age of AI demands new primitives.
              The Loreum Explorer is one of them.
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="relative mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="prose prose-invert prose-lg max-w-none">
          {/* Section 1: The Problem */}
          <div className="animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              The Oldest Split in Business
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Every company ever built runs on the same quiet division of labor: <strong className="text-slate-100">investors own, employees do.</strong>
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              The cap table and the org chart are two different documents, and the distance between them is where most companies bleed. Investors hold equity — real economic upside — but they are several steps removed from execution. They can hire and fire, vote at annual meetings, take a board seat. What they cannot do is make execution respond to them day to day. Their influence is seasonal: quarterly board meetings, annual proxy votes, the occasional crisis.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              The people on the org chart have the opposite problem. They execute — they ship, sell, operate — but their connection to economic upside is thin and indirect. Salaries are fixed. Options, where they exist, come with vesting cliffs, strike prices, and an exit event nobody can schedule. The people doing the work rarely hold meaningful equity in the outcome of the work.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              So both sides struggle. <strong className="text-slate-100">Investors struggle to influence execution. Employees — the executors — struggle to gain economic upside.</strong> Every management structure since the joint-stock company is really a patch on this split: board seats, proxy advisors, ESOPs, RSUs, phantom equity, earnouts. Each patch adds a lawyer and a footnote, and none of them closes the gap.
            </p>
          </div>

          {/* Section 2: The AI Context */}
          <div className="mt-16 animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              The Age of AI Changes Everything
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              We are entering an era where the boundary between "investor" and "executor" dissolves faster than ever before. AI agents can own assets. They can execute decisions. They can hold treasury. They can govern.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              But the legal and equity structures we inherited were designed for a world where humans sat on both sides of the split. When an AI agent can be a director, when a DAO can own a company, when execution can happen without a human in the loop — the old patches don't just fail, they become liabilities.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              We need new primitives. Not patches. Not workarounds. <strong className="text-slate-100">New legal and economic structures that work for a world where the executor might not be human, and the investor might not be either.</strong>
            </p>
          </div>

          {/* Section 3: The Loreum Explorer */}
          <div className="mt-16 animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              Why There Is an NFT
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              The Loreum Explorer is a non-fungible token — an ERC-721 — that represents a <strong className="text-slate-100">seat in the Loreum Chamber</strong>. It is not a collectible. It is not a profile picture. It is a membership token that grants the holder the right to participate in governance.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              The obvious question: why a non-fungible token at all? Why not just addresses?
            </p>
            <ul className="mt-4 space-y-3 text-slate-300">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500" />
                <span><strong className="text-slate-100">Scarcity.</strong> A fixed seat count makes influence competitive. There are five chairs, not unlimited wallets — so getting one means persuading shareholders you'll use it well.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500" />
                <span><strong className="text-slate-100">Identity and accountability.</strong> A seat is a persistent, queryable identity. "Who decided this?" stops being an archaeology project across multisig logs and becomes a lookup. Every director's record — proposals submitted, confirmed, executed — accumulates on the seat itself. Reputation becomes a property of the token.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500" />
                <span><strong className="text-slate-100">Transferability with consequences.</strong> Because the seat trades, governance influence has a price and a market — but buying a seat buys you the <em>opportunity</em> to govern, not the power. Power still has to be delegated to you. You can't buy your way to a board majority; you can only earn one.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500" />
                <span><strong className="text-slate-100">Composability.</strong> Seats are ERC-721s, so they plug into marketplaces, lending protocols, and reputation systems that already exist. An address can't do any of this. An address is where a person happens to be; an NFT is a role that has a history.</span>
              </li>
            </ul>
          </div>

          {/* Section 4: The Two-Token Architecture */}
          <div className="mt-16 animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              Two Tokens, Two Roles
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              A Chamber is a community-governed treasury built on a deliberate answer: <strong className="text-slate-100">split the roles into two tokens, and connect them with a market.</strong>
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6">
                <h3 className="font-display text-xl font-semibold text-slate-100">
                  Membership — The Explorer NFT
                </h3>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  A non-fungible token is a seat in the Chamber. Each token ID is a unique chair on a board of fixed size. Holding it is what gives you the <em>right to execute</em>: to submit proposals, confirm them at quorum, and carry them out. Seats are scarce by design. They can be transferred — sold, gifted, inherited — and every transfer recomputes the board.
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6">
                <h3 className="font-display text-xl font-semibold text-slate-100">
                  Equity — The LORE Token
                </h3>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  A fungible token is a claim on the Chamber's treasury. Deposit it into the Chamber's vault and you hold shares: proportional economic ownership of everything the Chamber controls. Shares are divisible, liquid, and tradable on any DEX.
                </p>
              </div>
            </div>
            <p className="mt-6 text-slate-300 leading-relaxed">
              Neither token alone is governance. The two are joined by <strong className="text-slate-100">delegation</strong>: shareholders delegate their voting weight to the seat holders they trust, and the top-N most-delegated NFTs become the active board — the directors. That's the whole machine.
            </p>
          </div>

          {/* Section 5: Closing the Split */}
          <div className="mt-16 animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              Closing the Split
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Now put the two halves of the old problem back on the table.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              <strong className="text-slate-100">Investors — the shareholders — finally get real influence over execution.</strong> Not a board seat four times a year: a continuous, revocable delegation they can point at any seat holder on the board. If execution drifts, they re-point it. If it performs, they compound their weight behind it. Influence stops being an annual ritual and becomes a market signal — the same way capital moves, but with a paper trail.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              <strong className="text-slate-100">Executors — the members — finally get economic upside in what they execute.</strong> A director is compensated for governing well, because governing well attracts delegation, and delegation is what makes a seat valuable enough to buy or sell. Directors can hold equity too — skin in the game they'd be foolish not to want. And because the seat itself is an asset, the person doing the work holds a balance-sheet item, not just a title. The employee-equity gap doesn't get patched; it gets priced.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              This is the thing neither the cap table nor the org chart ever managed: <strong className="text-slate-100">execution and equity are separate tokens, but they trade against each other.</strong> The executors' standing is set by the people with economic stake. The investors' influence flows through the people with execution power. Each side disciplines the other through an open market, not a boardroom.
            </p>
          </div>

          {/* Section 6: The Exploration */}
          <div className="mt-16 animate-fade-up">
            <h2 className="font-display text-3xl font-semibold text-slate-100">
              The Exploration Continues
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              The Loreum Explorer is not the end of the story. It is the beginning of an exploration into what corporate governance looks like when the primitives are tokens, when the board is a market, when the executor can be an AI agent, and when the investor's influence is as liquid as their capital.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              We are building in the open. The contracts are audited. The code is public. The governance is onchain. And the seats — the Explorers — are available to anyone willing to earn them.
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              <strong className="text-slate-100">This is uncharted territory. We're just getting started.</strong>
            </p>
          </div>

          {/* CTA */}
          <div className="mt-16 animate-fade-up">
            <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 p-8 text-center">
              <h3 className="font-display text-2xl font-semibold text-slate-100">
                Claim Your Seat
              </h3>
              <p className="mt-3 text-slate-300">
                The Loreum Explorer is your membership in the Loreum DAO ecosystem.
              </p>
              <a
                href="/claim"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-6 py-3 font-medium text-white transition-colors hover:bg-accent-600"
              >
                Claim an Explorer
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
