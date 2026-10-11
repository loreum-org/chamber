import { Link } from 'react-router-dom';
import { chamberAppUrl } from './config.ts';

const itemClass = 'hover:text-white transition-colors';

/**
 * Landing footer. Every link is a live destination. Dead stubs (Agents,
 * Roadmap, Security, Discord, Privacy, Terms) are omitted until real pages exist.
 * Do not link docs.loreum.org (broken TLS) or landing /docs (no SPA route).
 */
function Footer() {
  return (
    <footer className="relative z-10 border-t border-line w-full min-w-0 overflow-x-hidden">
      <div className="container-x py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <img src="https://cdn.loreum.org/logos/white.svg" alt="" className="w-6 h-6" />
            <span className="font-semibold tracking-[0.02em] text-slate-100">Loreum</span>
          </div>
          <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
            Open-source contracts that give a shared treasury an elected board. Non-custodial,
            enforced on Ethereum.
          </p>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">Product</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><a href={chamberAppUrl} className={itemClass}>Open the app</a></li>
            <li><a href={`${chamberAppUrl}/docs`} target="_blank" rel="noopener noreferrer" className={itemClass}>Documentation</a></li>
            <li><Link to="/whitepaper" className={itemClass}>Whitepaper</Link></li>
            <li><Link to="/blog" className={itemClass}>Blog</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">Company</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li><Link to="/team" className={itemClass}>Team</Link></li>
            <li><a href="https://github.com/loreum-org/chamber" target="_blank" rel="noopener noreferrer" className={itemClass}>GitHub</a></li>
            <li><a href="https://x.com/loreumdao" target="_blank" rel="noopener noreferrer" className={itemClass}>X</a></li>
          </ul>
        </div>
      </div>

      <div className="container-x pb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-600">
        <div>© 2026 Loreum DAO LLC</div>
        <p className="max-w-xl leading-relaxed">
          Loreum is non-custodial governance software, not legal, tax, investment, broker, dealer, exchange, or custodial advice.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
