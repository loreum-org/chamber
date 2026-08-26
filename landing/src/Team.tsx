import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

/** Production default so CTAs work when env is unset in a static build. */
const chamberAppUrl =
  (import.meta.env.VITE_CHAMBER_APP_URL as string | undefined)?.trim() ||
  'https://app.loreum.org';

const founders = [
  {
    name: 'Chad Lynch',
    role: 'Co-founder',
    blurb: 'Chad designed and built Chamber. He leads protocol engineering.',
    photo: '/team/chad-lynch.jpg',
    xUrl: 'https://x.com/chad_evm',
    xHandle: '@chad_evm',
  },
  {
    name: 'Daniel Lynch',
    role: 'Co-founder',
    blurb: 'Daniel leads growth and the public story.',
    photo: '/team/daniel-lynch.jpg',
    xUrl: 'https://x.com/DLYNCH27',
    xHandle: '@DLYNCH27',
  },
];

function Team() {
  useEffect(() => {
    document.title = 'Team — Loreum';
    return () => {
      document.title = 'Loreum — Chamber: onchain governance for DAOs';
    };
  }, []);

  return (
    <div className="min-h-screen w-full min-w-0 bg-space-900 text-white selection:bg-space-accent selection:text-space-900 overflow-x-hidden relative">

      {/* Background Stars Effect */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-10 left-20 w-1 h-1 bg-white rounded-full animate-pulse-slow"></div>
        <div className="absolute top-40 right-40 w-2 h-2 bg-space-accent rounded-full animate-pulse"></div>
        <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-white rounded-full opacity-50"></div>
        <div className="absolute top-1/4 right-10 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse-slow delay-700"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between gap-4 px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full min-w-0 box-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Loreum Logo" className="w-8 h-8" />
          <span className="text-2xl font-display tracking-wider">LOREUM</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 font-light tracking-wide text-sm">
          <a href="/#clarity" className="hover:text-space-accent transition-colors">CLARITY</a>
          <a href="/#mission" className="hover:text-space-accent transition-colors">MISSION</a>
          <a href="/#technology" className="hover:text-space-accent transition-colors">TECHNOLOGY</a>
          <a href="/#governance" className="hover:text-space-accent transition-colors">GOVERNANCE</a>
          <Link to="/team" className="text-space-accent transition-colors">TEAM</Link>
        </div>
        <a
          href={chamberAppUrl}
          className="hidden md:flex items-center gap-2 border border-white/20 px-6 py-2 rounded-full hover:bg-white/10 transition-all text-sm tracking-wide"
        >
          LAUNCH APP
        </a>
      </nav>

      <section className="relative z-10 py-20 md:py-32 px-4 sm:px-6 w-full min-w-0 box-border">
        <div className="max-w-7xl mx-auto w-full min-w-0 px-1 sm:px-0">
          <FadeIn className="mb-20 max-w-4xl">
            <div className="mb-6 inline-block max-w-full px-3 sm:px-4 py-1.5 rounded-full border border-space-accent/30 bg-space-accent/10 text-space-accent text-xs tracking-[0.2em] backdrop-blur-sm">
              FOUNDERS
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-display mb-8 leading-tight break-words text-balance">
              Team
            </h1>
            <p className="text-lg md:text-xl text-gray-400 font-light leading-relaxed break-words">
              Loreum is built by people you can name. Chamber is our protocol for onchain governance: delegated voting, a ranked board, quorum, and treasury flows enforced in contracts.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl">
            {founders.map((founder, i) => (
              <FadeIn key={founder.name} delay={i * 0.15} className="group relative">
                <article className="relative h-full p-8 bg-space-800/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden group-hover:border-white/20 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-2xl">
                  <img
                    src={founder.photo}
                    alt={`${founder.name}, ${founder.role} of Loreum`}
                    width={800}
                    height={800}
                    className="w-full aspect-square object-cover object-top rounded-lg mb-6 border border-white/10"
                  />
                  <p className="text-xs tracking-[0.2em] text-space-accent mb-2">{founder.role.toUpperCase()}</p>
                  <h2 className="text-2xl md:text-3xl font-display mb-4 tracking-wide text-white group-hover:text-space-accent transition-colors">
                    {founder.name}
                  </h2>
                  <p className="text-gray-400 leading-relaxed text-sm group-hover:text-gray-300 transition-colors mb-6">
                    {founder.blurb}
                  </p>
                  <a
                    href={founder.xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-space-accent hover:text-white transition-colors tracking-widest text-sm font-bold"
                  >
                    X {founder.xHandle}
                  </a>
                </article>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.35} className="mt-16 max-w-4xl">
            <div className="p-6 md:p-8 border border-white/10 rounded-xl bg-space-800/30 backdrop-blur-sm">
              <p className="text-sm md:text-base text-gray-400 font-light leading-relaxed">
                Company: Loreum. Founded 2022. Jackson Hole, Wyoming, with people in the US and Canada.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-space-900 pt-20 pb-10 border-t border-white/10 w-full min-w-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-4 gap-12 mb-16 w-full min-w-0 box-border">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.svg" alt="Loreum Logo" className="w-6 h-6" />
              <span className="text-2xl font-display tracking-wider">LOREUM</span>
            </div>
            <p className="text-gray-500 max-w-xs font-light">
              The Chamber Protocol — infrastructure for credibly neutral, agent-driven
              Decentralized Governance Systems in the CLARITY era.
            </p>
          </div>

          <div>
            <h4 className="font-bold tracking-widest text-sm mb-6">PLATFORM</h4>
            <ul className="space-y-4 text-sm text-gray-400 font-light">
              <li><Link to="/team" className="hover:text-white transition-colors">Team</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Agents</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Chambers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Roadmap</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold tracking-widest text-sm mb-6">COMMUNITY</h4>
            <ul className="space-y-4 text-sm text-gray-400 font-light">
              <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600 w-full min-w-0 box-border text-center md:text-start">
          <div>© 2026 LOREUM DAO LLC. ALL RIGHTS RESERVED.</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-gray-400">PRIVACY POLICY</a>
            <a href="#" className="hover:text-gray-400">TERMS OF SERVICE</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Team;
