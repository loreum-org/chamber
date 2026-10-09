import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiAlertCircle, FiBook, FiHome, FiPlus } from 'react-icons/fi'

const NOT_FOUND_TITLE = 'Page not found — Loreum'

/** Catch-all for unknown routes, rendered inside `Layout` so the header and nav stay visible. */
export default function NotFound() {
  const { pathname } = useLocation()

  useEffect(() => {
    const previous = document.title
    document.title = NOT_FOUND_TITLE
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <div className="panel p-8 sm:p-12 max-w-lg w-full text-center">
        <FiAlertCircle className="w-10 h-10 text-accent-500 mx-auto mb-4" aria-hidden />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">404</p>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-100 mb-3">Page not found</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Nothing lives at <code className="font-mono text-accent-300 break-all">{pathname}</code>. The link may be
          mistyped or out of date.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn btn-primary">
            <FiHome className="w-4 h-4" aria-hidden />
            Back to home
          </Link>
          <Link to="/docs" className="btn btn-secondary">
            <FiBook className="w-4 h-4" aria-hidden />
            Browse docs
          </Link>
          <Link to="/deploy" className="btn btn-ghost">
            <FiPlus className="w-4 h-4" aria-hidden />
            Deploy a Chamber
          </Link>
        </div>
      </div>
    </div>
  )
}
