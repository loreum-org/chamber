import React from 'react';
import { motion } from 'framer-motion';
import Footer from './Footer.tsx';
import Nav from './Nav.tsx';
import { useSeo } from './seo';

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
  {
    name: 'Hurricane',
    role: 'Co-founder',
    blurb: 'Hurricane leads strategic relations and partnerships.',
    photo: '/team/hurricane.jpg',
    xUrl: 'https://x.com/hurricaneloreum',
    xHandle: '@hurricaneloreum',
  },
];

function Team() {
  useSeo('Team — Loreum', 'The team behind Loreum Chamber.', '/team');

  return (
    <div className="min-h-screen w-full min-w-0 bg-space-900 text-white selection:bg-space-accent selection:text-space-900 overflow-x-hidden relative">

      {/* Background Stars Effect */}
      <Nav active="team" />

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

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
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

      <Footer />
    </div>
  );
}

export default Team;