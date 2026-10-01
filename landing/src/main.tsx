import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Whitepaper from './Whitepaper.tsx'
import Team from './Team.tsx'
import { BlogIndex, BlogPost } from './Blog.tsx'

/** Production default so docs redirects work when env is unset in a static build. */
const chamberAppUrl =
  (import.meta.env.VITE_CHAMBER_APP_URL as string | undefined)?.trim() ||
  'https://app.loreum.org'

/**
 * Landing has no docs SPA. /docs and /docs/* were blank (SPA catch-all + no route).
 * Send users to the Chamber app docs, preserving any path suffix.
 */
function DocsRedirect() {
  const { pathname } = useLocation()
  useEffect(() => {
    const suffix = pathname.replace(/^\/docs\/?/, '')
    const target = suffix
      ? `${chamberAppUrl}/docs/${suffix}`
      : `${chamberAppUrl}/docs`
    window.location.replace(target)
  }, [pathname])
  return null
}

/** React Router preserves scroll across routes unless we reset it explicitly. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/whitepaper" element={<Whitepaper />} />
        <Route path="/team" element={<Team />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/docs" element={<DocsRedirect />} />
        <Route path="/docs/*" element={<DocsRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
