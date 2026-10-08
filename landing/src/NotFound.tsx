import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BlogChrome } from './Blog.tsx';

/** Keep unknown URLs out of search indexes while the NotFound view is mounted. */
function useNoIndex() {
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !el;
    const previous = el?.getAttribute('content') ?? null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex');
    return () => {
      if (created) el?.remove();
      else if (previous !== null) el?.setAttribute('content', previous);
    };
  }, []);
}

/** Catch-all for unknown landing routes (SPA fallback serves index.html for every path). */
export default function NotFound() {
  const { pathname } = useLocation();
  useNoIndex();

  return (
    <BlogChrome
      title="Page not found — Loreum"
      description="This page does not exist on loreum.org."
      path={pathname}
      highlightBlog={false}
    >
      <section className="relative z-10 py-20 md:py-32 px-4 sm:px-6 w-full min-w-0 box-border">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-[0.2em] text-space-accent mb-4">404</p>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-display mb-8 leading-tight">
            Page not found
          </h1>
          <p className="text-gray-400 font-light mb-8 break-words">
            There is nothing at <code className="font-mono text-sm text-space-accent break-all">{pathname}</code>.
            The link may be mistyped or out of date.
          </p>
          <div className="flex flex-wrap gap-8">
            <Link to="/" className="text-space-accent hover:text-white transition-colors tracking-widest text-sm font-bold">
              BACK TO HOME
            </Link>
            <Link to="/blog" className="text-space-accent hover:text-white transition-colors tracking-widest text-sm font-bold">
              READ THE BLOG
            </Link>
          </div>
        </div>
      </section>
    </BlogChrome>
  );
}
