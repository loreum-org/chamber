import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { chamberAppUrl } from './config.ts';

type NavKey = 'home' | 'blog' | 'team' | 'whitepaper' | 'none';

const links: { key: NavKey | 'how' | 'why'; label: string; href: string; external?: boolean }[] = [
  { key: 'how', label: 'How it works', href: '/#how-it-works' },
  { key: 'why', label: 'Why Loreum', href: '/#why' },
  { key: 'blog', label: 'Blog', href: '/blog' },
  { key: 'team', label: 'Team', href: '/team' },
  { key: 'whitepaper', label: 'Whitepaper', href: '/whitepaper' },
];

function NavLink({
  item,
  active,
  onClick,
  className,
}: {
  item: (typeof links)[number];
  active: boolean;
  onClick?: () => void;
  className: string;
}) {
  const cls = `${className} ${active ? 'text-white' : 'text-slate-400 hover:text-white'}`;
  if (item.href.startsWith('/#')) {
    return (
      <a href={item.href} onClick={onClick} className={cls}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.href} onClick={onClick} className={cls}>
      {item.label}
    </Link>
  );
}

/** One header for every landing page. */
export default function Nav({ active = 'none' }: { active?: NavKey }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-900/92 backdrop-saturate-150">
      <div className="container-x h-16 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Loreum home">
          <img src="https://cdn.loreum.org/logos/white.svg" alt="" className="w-7 h-7" />
          <span className="font-semibold tracking-[0.02em] text-slate-100">Loreum</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[13.5px]" aria-label="Main">
          {links.map((item) => (
            <NavLink key={item.key} item={item} active={item.key === active} className="transition-colors" />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a href={chamberAppUrl} className="btn btn-primary !py-2 !px-4 text-[13px]">
            Open the app
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-ink-700"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-line bg-ink-800 px-5 py-3 flex flex-col" aria-label="Main">
          {links.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={item.key === active}
              onClick={() => setOpen(false)}
              className="py-2.5 text-sm"
            />
          ))}
        </nav>
      )}
    </header>
  );
}
