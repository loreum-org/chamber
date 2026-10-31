import React, { useEffect, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Github } from 'lucide-react';
import Footer from './Footer.tsx';
import Nav from './Nav.tsx';
import { chamberAppUrl } from './config.ts';
import { formatPostDate, posts } from './posts.ts';
import { useSeo } from './seo';

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const Reveal = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    className={className}
  >
    {children}
  </motion.div>
);

function SectionTitle({
  eyebrow,
  title,
  lead,
  align = 'left',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <Reveal className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.1] text-slate-50">{title}</h2>
      {lead && <p className="mt-4 text-lg text-slate-400 leading-relaxed">{lead}</p>}
    </Reveal>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Hero visual: delegation moves, the board re-sorts itself                    */
/* ────────────────────────────────────────────────────────────────────────── */

type Seat = { id: string; name: string; token: string; weight: number; kind: 'person' | 'agent' };

/** Example board in the hero. Protocol max is 20; this preview shows 5. */
const SEATS = 5;
const MAX_DIRECTORS = 20;

const INITIAL: Seat[] = [
  { id: 'aria', name: 'aria.eth', token: '#7', weight: 2410, kind: 'person' },
  { id: 'ops', name: 'ops', token: '#19', weight: 1880, kind: 'agent' },
  { id: 'kofi', name: 'kofi.eth', token: '#12', weight: 1705, kind: 'person' },
  { id: 'lena', name: 'lena.eth', token: '#44', weight: 980, kind: 'person' },
  { id: 'marco', name: 'marco.eth', token: '#58', weight: 612, kind: 'person' },
  { id: 'nadia', name: 'nadia.eth', token: '#63', weight: 540, kind: 'person' },
];

function fmt(n: number) {
  return n.toLocaleString();
}

/**
 * Every few seconds some delegated weight moves from marco to nadia (and back),
 * so the viewer watches seat 5 change hands. The board follows delegation.
 * One seated director is an agent wallet; the rest are people.
 */
function BoardPreview() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setPhase((p) => (p + 1) % 2), 3600);
    return () => window.clearInterval(t);
  }, []);

  const seats = INITIAL.map((s) => {
    if (phase === 1 && s.id === 'nadia') return { ...s, weight: 760 };
    if (phase === 1 && s.id === 'marco') return { ...s, weight: 430 };
    return s;
  }).sort((a, b) => b.weight - a.weight);
  const max = seats[0].weight;

  return (
    <div className="surface p-0 overflow-hidden text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">Example chamber</span>
            <span className="chip chip-accent">eqLORE</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Example · {SEATS} of {MAX_DIRECTORS} seats · quorum 3 of {SEATS}
          </p>
        </div>
        <span className="chip">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Board live
        </span>
      </div>

      <LayoutGroup>
        <ol className="py-1">
          {seats.map((s, i) => {
            const seated = i < SEATS;
            return (
              <motion.li
                key={s.id}
                layout
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className={`px-5 py-2.5 flex items-center gap-3 ${
                  i === SEATS ? 'border-t border-dashed border-line-strong mt-1 pt-3' : ''
                }`}
              >
                <span
                  className={`w-6 text-xs tabular-nums mono ${seated ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm flex items-center min-w-0 ${seated ? 'text-slate-100' : 'text-slate-500'}`}>
                      <span className="truncate">{s.name}</span>
                      <span className="text-slate-500 mono text-xs ml-2 shrink-0">{s.token}</span>
                      {s.kind === 'agent' && (
                        <span className="chip chip-accent ml-2 shrink-0">Agent</span>
                      )}
                    </span>
                    <span className="text-xs tabular-nums mono text-slate-400 shrink-0">{fmt(s.weight)}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-ink-600 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${seated ? 'bg-accent-500' : 'bg-slate-600'}`}
                      animate={{ width: `${(s.weight / max) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
                <span className={`chip ${seated ? 'chip-ok' : ''} w-[74px] justify-center`}>
                  {seated ? 'Seated' : 'Next'}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>

      <div className="border-t border-line px-5 py-3 text-xs text-slate-500 flex items-center justify-between gap-3">
        <span>Delegation re-sorts the board.</span>
        <span className="tabular-nums">seat changes take effect after 1 block</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Queue visual                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const QUEUE = [
  {
    id: 46,
    title: 'Transfer 120,000 USDC to operating reserves',
    decoded: 'USDC.transfer(0x4d2e…9A1c, 120,000)',
    sim: 'Simulation passes · treasury −120,000 USDC',
    status: 'Ready to execute',
    tone: 'chip-ok',
    confirmations: '3 of 3',
  },
  {
    id: 47,
    title: 'Raise the board to 12 directors',
    decoded: 'updateSeats(12) · board change · 7-day timelock',
    sim: 'Quorum rises to 7 of 12 once it executes',
    status: 'Timelock',
    tone: 'chip-warn',
    confirmations: '2 of 3',
  },
  {
    id: 48,
    title: 'Upgrade the chamber implementation',
    decoded: 'ProxyAdmin.upgradeAndCall(chamber, 0x8bF1…c0De, 0x)',
    sim: 'Self-call · takes effect the moment it executes',
    status: 'High risk',
    tone: 'chip-bad',
    confirmations: '1 of 3',
  },
];

function QueuePreview() {
  return (
    <div className="surface overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <span className="font-semibold text-slate-100">Proposals</span>
        <span className="text-xs text-slate-500">1 needs you · 1 ready · 1 waiting</span>
      </div>
      <ul className="divide-y divide-line">
        {QUEUE.map((q) => (
          <li key={q.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-100">
                  <span className="mono text-slate-500 mr-2">#{q.id}</span>
                  {q.title}
                </p>
                <p className="mono text-[12px] text-slate-400 mt-1.5 truncate">{q.decoded}</p>
                <p className="text-xs text-slate-500 mt-1">{q.sim}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`chip ${q.tone}`}>{q.status}</span>
                <span className="text-xs text-slate-500 tabular-nums">{q.confirmations}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Page                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: '01',
    title: 'Capital',
    body: 'Shareholders deposit the treasury token and receive shares. Withdraw any time. A public token sale is not required.',
    note: 'ERC-4626 vault',
  },
  {
    n: '02',
    title: 'Elect',
    body: "Point your shares at the seats you want on the board: a founder, an operator, or an agent's wallet. You keep the shares. Only the weight moves.",
    note: 'No lockups',
  },
  {
    n: '03',
    title: 'Seat',
    body: 'The most-delegated members fill the board, up to 20 directors. A director is a member elected to a board seat, held by any wallet, including an agent\'s. The board follows delegation one block later.',
    note: 'People or agents',
  },
  {
    n: '04',
    title: 'Act',
    body: 'Any director, human or agent, proposes from their own wallet. The board sees the decoded call and a simulation. Quorum confirms, then it executes. One seat cannot move funds alone.',
    note: 'Board quorum',
  },
];

const RULES = [
  { k: 'Quorum', v: '1 + ⌊n × 51 / 100⌋', s: 'board size sets it, up to 20 directors' },
  { k: 'Seat changes', v: '1 block', s: 'then the new director can act' },
  { k: 'Board resize', v: '7 days', s: 'timelock before a new size applies' },
  { k: 'Stale proposals', v: '30 days', s: 'then they expire unexecuted' },
];

const COMPARE: { q: string; other: string; loreum: string }[] = [
  {
    q: 'Who can move funds?',
    other: 'Safe: the signer list. Aragon: a DAO vote, then a separate executor.',
    loreum: 'Seated directors — people or agents — and only at quorum',
  },
  {
    q: 'How does the board change?',
    other: 'Safe: edit the signer list by hand. Aragon: pass a governance proposal.',
    loreum: 'Shareholders move delegation. Seats update themselves, up to 20.',
  },
  {
    q: 'Who is it for?',
    other: 'Safe: a shared wallet. Aragon: a public token community.',
    loreum: 'A startup or company. A public community is optional.',
  },
  {
    q: 'Where do agents sit?',
    other: 'Safe: another signer, if someone adds one. Aragon: a DAO body, not a company director.',
    loreum: "On the board. A member elected to a seat, held by any wallet, including an agent's.",
  },
];

const ARTIFICIAL_BEING_URL = 'https://www.amazon.com/dp/B0HNWWPCP8';

const TESTS = [
  {
    title: 'Transparent and programmatic',
    body: 'Decisions run on published contract rules. Seats, quorum, and proposals are state anyone can read.',
  },
  {
    title: 'No owner key beside the board',
    body: 'Treasury and upgrades move only when directors reach quorum. Board size, from 1 to 20, sets that quorum.',
  },
  {
    title: 'Directors can be agents',
    body: "A director is a member elected to a board seat, held by any wallet, including an agent's. That wallet signs under the same quorum as every other director.",
  },
];

function App() {
  useSeo(
    'Loreum — Corporate treasuries for decentralized autonomous corporations',
    "Chamber is a corporate treasury and board for startups and companies. Shareholders elect up to 20 directors — people or autonomous agents — and nothing moves without the board's quorum.",
    '/',
  );

  const latest = posts.slice(0, 3);

  return (
    <div className="min-h-screen w-full min-w-0 text-slate-200 overflow-x-hidden">
      <Nav active="home" />

      {/* Hero */}
      <section className="relative container-x pt-16 pb-14 sm:pt-24 sm:pb-20 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="max-w-xl">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="eyebrow mb-5"
          >
            Decentralized autonomous corporations
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[2.6rem] sm:text-6xl lg:text-[4rem] leading-[1.02] font-light tracking-[-0.02em] text-slate-50"
          >
            A corporate treasury. Directors can be agents.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed"
          >
            Chamber is the treasury and the board for a startup or a company. Shareholders elect up
            to 20 directors. A director is a member elected to a board seat, held by any wallet,
            including an agent's. Nothing moves without the board's quorum. A public token community
            is optional. Unlike a DAO treasury, the public is not the premise.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-col sm:flex-row gap-3"
          >
            <a href={chamberAppUrl} className="btn btn-primary" data-umami-event="cta-launch-app">
              Open the app
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how-it-works" className="btn btn-secondary">
              See how it works
            </a>
          </motion.div>
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"
          >
            {['Open source', 'Non-custodial', 'Built on Ethereum', 'Live on Sepolia'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent-400" aria-hidden />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="w-full min-w-0 lg:max-w-[520px] lg:ml-auto"
        >
          <BoardPreview />
        </motion.div>
      </section>

      {/* Problem */}
      <section id="why" className="border-t border-line">
        <div className="container-x py-20 sm:py-28">
          <SectionTitle
            eyebrow="The problem"
            title="A company treasury is not a public DAO."
            lead="Safe is a lock with a fixed signer list. Aragon is built for a token community. A startup needs shareholders, a board, and a treasury that still runs when some directors are agents."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                t: 'Safe never reseats itself',
                b: 'The signer list is whoever was typed in. Hiring, firing, or seating an agent means editing the wallet by hand.',
              },
              {
                t: 'Aragon assumes a public DAO',
                b: 'Token votes and a community treasury. A company may have shareholders and no public token at all.',
              },
              {
                t: 'An agent has no seat',
                b: 'A multisig still waits for a person to click approve. An autonomous agent can hold a wallet, but it is not a director until the board gives it a seat and holds it to quorum.',
              },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <div className="surface p-6 h-full">
                  <h3 className="text-lg text-slate-100">{c.t}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{c.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-line bg-ink-950/40">
        <div className="container-x py-20 sm:py-28">
          <SectionTitle
            eyebrow="How it works"
            title="Shareholders elect the board. Directors — people or agents — hold the keys."
            lead="A chamber is one contract: the corporate treasury, a board of up to 20 seats, and a single queue. A director is a member elected to a board seat, held by any wallet, including an agent's. Chamber does not run the agent."
          />
          <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <li className="surface p-6 h-full flex flex-col">
                  <span className="mono text-xs text-accent-300">{s.n}</span>
                  <h3 className="mt-3 text-xl text-slate-100">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">{s.body}</p>
                  <span className="mt-5 chip self-start">{s.note}</span>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.1} className="mt-6">
            <dl className="surface grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line">
              {RULES.map((r) => (
                <div key={r.k} className="px-6 py-5">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{r.k}</dt>
                  <dd className="mt-1.5 text-xl font-light text-slate-100 tabular-nums">{r.v}</dd>
                  <dd className="text-xs text-slate-500 mt-0.5">{r.s}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Product: the queue */}
      <section className="border-t border-line">
        <div className="container-x py-20 sm:py-28 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <SectionTitle
              eyebrow="The queue"
              title="Decoded before a director signs."
              lead="A human director and an agent director see the same proposal: plain language, a simulation, then a confirmation. One seat still cannot move the treasury alone."
            />
            <ul className="mt-8 space-y-5">
              {[
                {
                  t: 'Readable calls',
                  b: 'Transfers, contract calls, board changes and upgrades are decoded into a sentence and flagged by risk.',
                },
                {
                  t: 'Simulated first',
                  b: 'Execution runs a simulation against the latest block and shows the balance change before the director confirms.',
                },
                {
                  t: 'Agents hold seats',
                  b: "A director is a member elected to a board seat, held by any wallet, including an agent's. A smart account can call Chamber as that wallet. Chamber keeps no agent registry.",
                },
              ].map((f) => (
                <li key={f.t} className="flex gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-400 shrink-0" />
                  <div>
                    <p className="text-slate-100 font-medium">{f.t}</p>
                    <p className="text-sm text-slate-400 leading-relaxed mt-0.5">{f.b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.1} className="w-full min-w-0">
            <QueuePreview />
          </Reveal>
        </div>
      </section>

      {/* Compare */}
      <section className="border-t border-line bg-ink-950/40">
        <div className="container-x py-20 sm:py-28">
          <SectionTitle
            eyebrow="Versus Safe and Aragon"
            title="A corporate board, not a signer list or a DAO."
            lead="Safe keeps a fixed list of addresses. Aragon governs a public DAO. Chamber is the company: shareholders elect the directors, and those directors are the keys."
          />
          <Reveal delay={0.1} className="mt-12 surface overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.1fr_1fr_1fr] px-6 py-3 border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span />
              <span>Safe and Aragon</span>
              <span className="text-accent-300">Loreum chamber</span>
            </div>
            <ul className="divide-y divide-line">
              {COMPARE.map((row) => (
                <li key={row.q} className="grid gap-2 md:gap-6 md:grid-cols-[1.1fr_1fr_1fr] px-6 py-5">
                  <p className="text-slate-100 font-medium">{row.q}</p>
                  <p className="text-sm text-slate-500">
                    <span className="md:hidden text-[11px] uppercase tracking-[0.12em] mr-2">Safe / Aragon</span>
                    {row.other}
                  </p>
                  <p className="text-sm text-slate-200">
                    <span className="md:hidden text-[11px] uppercase tracking-[0.12em] text-accent-300 mr-2">Loreum</span>
                    {row.loreum}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Regulation */}
      <section className="border-t border-line">
        <div className="container-x py-20 sm:py-28 grid gap-12 lg:grid-cols-2 lg:items-start">
          <SectionTitle
            eyebrow="A board you can audit"
            title="The board holds the keys, and anyone can check."
            lead={
              <>
                Control sits with the directors, not with a founder key or a chat. Anyone can read who
                holds each seat, what the quorum is, and which proposals passed. An agent on the board
                is a named seat, under the same quorum as every other director.{' '}
                <Link to="/whitepaper" className="text-accent-300 hover:text-accent-200">
                  Read the whitepaper
                </Link>
                .
              </>
            }
          />
          <ul className="grid gap-3">
            {TESTS.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.08}>
                <li className="surface p-5 flex gap-4">
                  <span className="mono text-xs text-accent-300 pt-1 w-6 shrink-0">0{i + 1}</span>
                  <div>
                    <p className="text-slate-100 font-medium">{t.title}</p>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Blog */}
      {latest.length > 0 && (
        <section className="border-t border-line bg-ink-950/40">
          <div className="container-x py-20 sm:py-24">
            <div className="flex items-end justify-between gap-4 mb-8">
              <SectionTitle eyebrow="Latest" title="From the team" />
              <Link to="/blog" className="text-sm text-accent-300 hover:text-accent-200 shrink-0">
                All posts →
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {latest.map((post, i) => (
                <Reveal key={post.slug} delay={i * 0.08}>
                  <Link to={`/blog/${post.slug}`} className="surface p-6 h-full flex flex-col hover:border-line-strong transition-colors">
                    <p className="text-xs text-slate-500 tabular-nums">{formatPostDate(post.date)}</p>
                    <h3 className="mt-2 text-lg text-slate-100 leading-snug">{post.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed line-clamp-3">{post.summary}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-line">
        <div className="container-x py-20 sm:py-28">
          <Reveal className="surface p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[-0.02em] text-slate-50">
              Seat the company's board.
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto leading-relaxed">
              Pick the treasury token and the memberships, and choose a board of up to 20 directors.
              A seat is held by any wallet, including an agent's. Try it on Sepolia first.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={chamberAppUrl} className="btn btn-primary" data-umami-event="cta-launch-app">
                Open the app
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/loreum-org/chamber"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <Github className="w-4 h-4" />
                Read the code
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The Artificial Being */}
      <section className="border-t border-line bg-ink-950/40" aria-labelledby="artificial-being-heading">
        <div className="container-x py-20 sm:py-24">
          <Reveal>
            <div className="surface p-6 sm:p-10 grid gap-8 sm:gap-10 md:grid-cols-[200px_1fr] md:items-center">
              <a
                href={ARTIFICIAL_BEING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-auto md:mx-0 block w-[180px] sm:w-[200px] rounded-lg border border-line-strong overflow-hidden shadow-[0_24px_50px_-28px_rgba(0,0,0,0.85)]"
              >
                <img
                  src="/the-artificial-being.webp"
                  alt="The Artificial Being by Chad W. D. Lynch — cover"
                  width={480}
                  height={768}
                  className="block w-full h-auto"
                />
              </a>
              <div className="min-w-0 text-center md:text-left">
                <p className="eyebrow mb-3">The book</p>
                <h2
                  id="artificial-being-heading"
                  className="text-3xl sm:text-4xl leading-[1.1] font-light tracking-[-0.02em] text-slate-50"
                >
                  The Artificial Being
                </h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Four Thousand Years of the Corporation, from Clay Tablets to Code
                </p>
                <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl md:mx-0 mx-auto">
                  For four thousand years, people have built artificial beings: corporations that own property, sign
                  contracts and outlive their founders, from clay-tablet partnerships to the joint-stock company. Chad
                  W. D. Lynch&apos;s <cite className="text-slate-200 not-italic">The Artificial Being</cite> traces that
                  history to the point where the corporation becomes code. Chamber is that next step: an organization
                  whose members elect the board that holds the keys, and where nothing moves without the board&apos;s
                  quorum.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start">
                  <a
                    href={ARTIFICIAL_BEING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    data-umami-event="cta-get-the-book"
                  >
                    Get the book
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <p className="text-sm text-slate-500">Kindle, paperback, and hardcover on Amazon.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default App;
