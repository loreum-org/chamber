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

type Seat = { id: string; name: string; token: string; weight: number };

const SEATS = 5;

const INITIAL: Seat[] = [
  { id: 'aria', name: 'aria.eth', token: '#7', weight: 2410 },
  { id: 'kofi', name: 'kofi.eth', token: '#12', weight: 1905 },
  { id: 'treasury', name: 'grants.eth', token: '#31', weight: 1120 },
  { id: 'lena', name: 'lena.eth', token: '#44', weight: 980 },
  { id: 'marco', name: 'marco.eth', token: '#58', weight: 612 },
  { id: 'nadia', name: 'nadia.eth', token: '#63', weight: 540 },
];

function fmt(n: number) {
  return n.toLocaleString();
}

/**
 * Every few seconds some delegated weight moves from marco to nadia (and back),
 * so the viewer watches seat 5 change hands. That is the whole product idea in
 * one motion: the board follows delegation.
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
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{SEATS} seats · quorum 3 of {SEATS}</p>
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
                    <span className={`text-sm truncate ${seated ? 'text-slate-100' : 'text-slate-500'}`}>
                      {s.name}
                      <span className="text-slate-500 mono text-xs ml-2">{s.token}</span>
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
        <span>Delegation moves, the board re-sorts.</span>
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
    title: 'Transfer 120,000 USDC to the Grants Safe',
    decoded: 'USDC.transfer(0x4d2e…9A1c, 120,000)',
    sim: 'Simulation passes · treasury −120,000 USDC',
    status: 'Ready to execute',
    tone: 'chip-ok',
    confirmations: '3 of 3',
  },
  {
    id: 47,
    title: 'Add a sixth board seat',
    decoded: 'updateSeats(6) · board change · 7-day timelock',
    sim: 'Quorum rises to 4 of 6 once it executes',
    status: 'Timelock',
    tone: 'chip-warn',
    confirmations: '2 of 3',
  },
  {
    id: 48,
    title: 'Upgrade the chamber implementation',
    decoded: 'upgradeImplementation(0x8bF1…c0De)',
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
    title: 'Deposit',
    body: 'Members put the treasury token into the chamber vault and receive shares. Withdraw any time.',
    note: 'ERC-4626 vault',
  },
  {
    n: '02',
    title: 'Delegate',
    body: 'Point your shares at a member you trust. You keep your shares; only the weight moves. Change your mind whenever you like.',
    note: 'No lockups',
  },
  {
    n: '03',
    title: 'Seat',
    body: 'The most-delegated members fill the board seats automatically. When delegation shifts, the board shifts with it one block later.',
    note: 'Board follows delegation',
  },
  {
    n: '04',
    title: 'Decide',
    body: 'Any director proposes a transaction. Everyone sees what it does and a simulation of the result. A quorum confirms, then it executes.',
    note: 'Nothing moves alone',
  },
];

const RULES = [
  { k: 'Quorum', v: '1 + ⌊n × 51 / 100⌋', s: 'so 3 of 5 directors' },
  { k: 'Seat changes', v: '1 block', s: 'then the new director can act' },
  { k: 'Board resize', v: '7 days', s: 'public timelock before it applies' },
  { k: 'Stale proposals', v: '30 days', s: 'then they expire unexecuted' },
];

const COMPARE: { q: string; multisig: string; loreum: string }[] = [
  { q: 'Who can move funds?', multisig: 'A fixed list of signer addresses', loreum: 'Whoever currently holds the most delegated weight' },
  { q: 'How does leadership change?', multisig: 'Someone edits the signer list, by hand', loreum: 'Members move their delegation; seats update themselves' },
  { q: 'What does a vote do?', multisig: 'Signals in Discord. Signers still decide.', loreum: 'A confirmation on the actual transaction' },
  { q: 'Can outsiders check it?', multisig: 'Signer list plus a policy doc', loreum: 'Seats, quorum and every proposal are contract state' },
];

const TESTS = [
  {
    title: 'Transparent and programmatic',
    body: 'Decisions run on published contract rules, not on polls or admin keys.',
  },
  {
    title: 'No unilateral control',
    body: 'There is no owner key. Treasury and upgrades move only through a board quorum.',
  },
  {
    title: 'Distributed and impartial',
    body: 'Seats go to whoever members delegate to, and anyone can verify who that is.',
  },
];

function App() {
  useSeo(
    'Loreum — Accountable boards for onchain treasuries',
    'Loreum gives a shared treasury an elected board. Members deposit, delegate to people they trust, and nothing moves without a quorum. Open source, non-custodial, on Ethereum.',
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
            Onchain treasury governance
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[2.6rem] sm:text-6xl lg:text-[4rem] leading-[1.02] font-light tracking-[-0.02em] text-slate-50"
          >
            A treasury your community actually controls.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed"
          >
            Loreum gives a shared treasury an elected board. Members deposit, delegate to the people
            they trust, and the most-trusted members take the seats. Nothing moves without a quorum,
            and the contract enforces every rule. Not us.
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
            title={
              <>
                Most “decentralized” treasuries are five founders and a Discord poll.
              </>
            }
            lead="A multisig is a good lock. It is not a way to run an organization. Three things go wrong as soon as the group grows."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                t: 'The signer list never changes',
                b: 'Power moved to new contributors, but the wallet still trusts last year’s five addresses.',
              },
              {
                t: 'Votes don’t execute anything',
                b: 'The forum says yes. Execution is still whoever holds the keys, whenever they get to it.',
              },
              {
                t: 'Nobody can check who is in charge',
                b: 'Token holders exist, but who speaks for them is informal and lives in chat history.',
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
            title="Delegation picks the board. The board runs one queue."
            lead="A chamber is one contract that holds the treasury, ranks the board, and executes approved transactions. Four steps, all onchain."
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
              title="Decoded before anyone signs."
              lead="Directors never confirm a blob of hex. Every proposal shows what it will do in plain words, and a simulation of the result, before a single confirmation."
            />
            <ul className="mt-8 space-y-5">
              {[
                {
                  t: 'Readable calls',
                  b: 'Transfers, contract calls, board changes and upgrades are decoded into a sentence and flagged by risk.',
                },
                {
                  t: 'Simulated first',
                  b: 'Execution runs a simulation against the latest block and shows the balance change before your wallet opens.',
                },
                {
                  t: 'Scoped keys for teams',
                  b: 'A seat owned by a Safe or another contract can register a key that is limited to specific actions and always expires.',
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
            eyebrow="Versus a multisig"
            title="Same safety idea. A shape that keeps up with the group."
            lead="Both stop one person from draining the treasury. Only one of them knows who should hold the keys this month."
          />
          <Reveal delay={0.1} className="mt-12 surface overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.1fr_1fr_1fr] px-6 py-3 border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span />
              <span>Plain multisig</span>
              <span className="text-accent-300">Loreum chamber</span>
            </div>
            <ul className="divide-y divide-line">
              {COMPARE.map((row) => (
                <li key={row.q} className="grid gap-2 md:gap-6 md:grid-cols-[1.1fr_1fr_1fr] px-6 py-5">
                  <p className="text-slate-100 font-medium">{row.q}</p>
                  <p className="text-sm text-slate-500">
                    <span className="md:hidden text-[11px] uppercase tracking-[0.12em] mr-2">Multisig</span>
                    {row.multisig}
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
            eyebrow="Built for the rules that are coming"
            title="Decentralized in a way you can prove."
            lead={
              <>
                Regulators increasingly ask one question of a protocol: does anyone still hold effective
                control? A chamber is designed so the honest answer is no, and so that anyone can check.{' '}
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
              Deploy a chamber in minutes.
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto leading-relaxed">
              Pick the treasury token and a membership collection, choose the number of seats, and the
              contract does the rest. Try it on Sepolia first.
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

      <Footer />
    </div>
  );
}

export default App;
