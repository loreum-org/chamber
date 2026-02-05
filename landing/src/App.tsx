import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Layers, Shield, Sparkles, Cpu } from 'lucide-react';

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

function App() {
  return (
    <div className="min-h-screen bg-space-900 text-white selection:bg-space-accent selection:text-space-900 overflow-hidden relative">
      
      {/* Background Stars Effect */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-10 left-20 w-1 h-1 bg-white rounded-full animate-pulse-slow"></div>
        <div className="absolute top-40 right-40 w-2 h-2 bg-space-accent rounded-full animate-pulse"></div>
        <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-white rounded-full opacity-50"></div>
        <div className="absolute top-1/4 right-10 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse-slow delay-700"></div>
        {/* Glowing Orb */}
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Loreum Logo" className="w-8 h-8" />
          <span className="text-2xl font-display tracking-wider">LOREUM</span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-light tracking-wide text-sm">
          <a href="#mission" className="hover:text-space-accent transition-colors">MISSION</a>
          <a href="#technology" className="hover:text-space-accent transition-colors">TECHNOLOGY</a>
          <a href="#governance" className="hover:text-space-accent transition-colors">GOVERNANCE</a>
        </div>
        <button className="hidden md:flex items-center gap-2 border border-white/20 px-6 py-2 rounded-full hover:bg-white/10 transition-all text-sm tracking-wide">
          LAUNCH APP
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[90vh] flex items-center justify-center px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="mb-6 inline-block"
          >
            <span className="px-4 py-1.5 rounded-full border border-space-accent/30 bg-space-accent/10 text-space-accent text-xs tracking-[0.2em] backdrop-blur-sm">
              THE NEXT ERA OF GOVERNANCE
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl lg:text-9xl font-display leading-tight mb-8"
          >
            EXPLORE THE <br />
            <span className="text-gradient">UNKNOWN</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed"
          >
            Loreum enables AI-driven organizations to navigate the vast complexities of the decentralized universe. 
            Empower autonomous agents to govern, manage, and scale your protocol.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-space-900 hover:bg-space-accent transition-colors rounded-none text-sm tracking-widest font-bold flex items-center justify-center gap-2 group">
              START MISSION
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 border border-white/20 hover:border-white hover:bg-white/5 transition-all rounded-none text-sm tracking-widest font-bold">
              READ WHITEPAPER
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats/Info Strip */}
      <section className="relative z-10 border-y border-white/10 bg-space-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: "Active Agents", value: "2,048" },
            { label: "Treasury Value", value: "$420M+" },
            { label: "Proposals Processed", value: "15K+" },
            { label: "Block Time", value: "< 2s" }
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-3xl font-display mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500 tracking-widest uppercase">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Features */}
      <section id="technology" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-20">
            <h2 className="text-4xl md:text-5xl font-display mb-6">Autonomous Architecture</h2>
            <p className="text-gray-400 max-w-xl text-lg font-light">
              Built on the Chamber Protocol, Loreum introduces a new standard for organizational intelligence.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Cpu className="w-8 h-8 text-blue-400" />,
                title: "Agent Directors",
                desc: "Smart contracts that can propose, vote, and execute transactions based on programmed policies and AI inference."
              },
              {
                icon: <Shield className="w-8 h-8 text-purple-400" />,
                title: "Policy Modules",
                desc: "Modular governance guardrails that ensure safety while enabling autonomous operation."
              },
              {
                icon: <Layers className="w-8 h-8 text-emerald-400" />,
                title: "Sub-Chambers",
                desc: "Fractal organizational structures allowing for specialized departments and efficient resource allocation."
              }
            ].map((feature, i) => (
              <FadeIn key={i} delay={i * 0.2} className="p-8 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group cursor-default">
                <div className="mb-6 p-4 bg-white/5 inline-block rounded-lg group-hover:scale-110 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-display mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {feature.desc}
                </p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Showcase Section */}
      <section className="relative z-10 py-32 px-6 bg-space-800/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <FadeIn>
              <h2 className="text-4xl md:text-5xl font-display mb-8">
                Command Your <br />
                <span className="text-gradient">Digital Fleet</span>
              </h2>
              <div className="space-y-6">
                {[
                  "Deploy fleets of autonomous agents.",
                  "Monitor real-time treasury analytics.",
                  "Execute complex cross-chain strategies."
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-gray-300">
                    <div className="w-2 h-2 bg-space-accent rounded-full" />
                    <span className="font-light tracking-wide">{item}</span>
                  </div>
                ))}
              </div>
              <button className="mt-10 flex items-center gap-2 text-space-accent hover:text-white transition-colors tracking-widest text-sm font-bold">
                VIEW DEMO <ArrowRight className="w-4 h-4" />
              </button>
            </FadeIn>
          </div>
          
          <div className="flex-1 relative">
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 1 }}
              className="relative aspect-square max-w-[500px] mx-auto"
            >
              {/* Abstract Representation of AI/Core */}
              <div className="absolute inset-0 border border-white/20 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-8 border border-white/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative z-10 w-24 h-24 bg-space-900 border border-white/30 flex items-center justify-center rounded-lg rotate-45">
                   <div className="-rotate-45">
                     <Sparkles className="w-10 h-10 text-space-accent" />
                   </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 right-10 bg-space-800 border border-white/10 p-4 rounded-lg backdrop-blur-md"
              >
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className="text-green-400 text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Operational
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-10 left-0 bg-space-800 border border-white/10 p-4 rounded-lg backdrop-blur-md"
              >
                <div className="text-xs text-gray-500 mb-1">Transactions</div>
                <div className="text-white text-sm font-mono">
                  0x7f...3a2b
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-space-900 pt-20 pb-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.svg" alt="Loreum Logo" className="w-6 h-6" />
              <span className="text-2xl font-display tracking-wider">LOREUM</span>
            </div>
            <p className="text-gray-500 max-w-xs font-light">
              Pioneering the future of decentralized autonomous organizations through AI and programmable governance.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold tracking-widest text-sm mb-6">PLATFORM</h4>
            <ul className="space-y-4 text-sm text-gray-400 font-light">
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
        
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
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

export default App;
