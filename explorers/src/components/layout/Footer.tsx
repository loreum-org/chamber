export function Footer() {
  return (
    <footer className="border-t border-slate-700/40 bg-slate-900/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Loreum. Onchain governance infrastructure.
        </p>
        <nav className="flex items-center gap-6 text-sm text-slate-400">
          <a
            href="https://loreum.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-400 transition-colors duration-200"
          >
            loreum.org
          </a>
          <a
            href="https://github.com/loreum-org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-400 transition-colors duration-200"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
