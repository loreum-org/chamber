import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'

/** Production default so docs redirects work when env is unset in a static build. */
const chamberAppUrl =
  (import.meta.env.VITE_CHAMBER_APP_URL as string | undefined)?.trim() ||
  'https://app.loreum.org'

/**
 * Landing has no docs SPA. /docs and /docs/* were blank (SPA catch-all + no route).
 * Send users to the Chamber app docs, preserving any path suffix.
 */
export function DocsRedirect() {
  // Take the suffix from the router (route matching is case-insensitive, so
  // string-stripping "/docs" from the pathname breaks on /Docs).
  const { '*': rest = '' } = useParams()
  const { search, hash } = useLocation()
  useEffect(() => {
    const base = chamberAppUrl.replace(/\/+$/, '')
    const path = rest ? `${base}/docs/${rest}` : `${base}/docs`
    window.location.replace(`${path}${search}${hash}`)
  }, [rest, search, hash])
  return null
}

/** React Router preserves scroll across routes unless we reset it explicitly. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
