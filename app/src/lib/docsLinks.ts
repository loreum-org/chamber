/**
 * Helpers for in-app docs links (`/docs/*`).
 *
 * The Markdown under `app/src/docs/**` cross-links with relative file paths
 * such as `./why-not-multisig.md` or `../protocol/governance.md#roles`. Rendered
 * as raw `<a href>` those resolve against the browser URL and end up as
 * `/docs/introduction/why-not-multisig.md`, which the doc lookup cannot match.
 * These helpers turn such hrefs into in-app `/docs/<path>` routes.
 */

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** True for absolute URLs with a scheme (`https:`, `mailto:`, `tel:` …) and protocol-relative `//host`. */
export function isExternalHref(href: string): boolean {
  return EXTERNAL_SCHEME.test(href) || href.startsWith('//')
}

/** Strip a trailing `.md` (case-insensitive) and any trailing slash from a docs path. */
export function stripMdExtension(path: string): string {
  return path.replace(/\/+$/, '').replace(/\.md$/i, '')
}

/**
 * Directory of the doc currently shown, relative to the docs root
 * (`introduction/overview` → `introduction`, `README` → ``).
 */
export function docDirectory(currentDocPath: string): string {
  const clean = stripMdExtension(currentDocPath.replace(/^\/+/, ''))
  const idx = clean.lastIndexOf('/')
  return idx === -1 ? '' : clean.slice(0, idx)
}

/**
 * Resolve a relative Markdown link (`./x.md`, `../dir/x.md`, `x.md#anchor`)
 * found in the doc at `currentDocPath` (docs-root-relative, without `.md`, e.g.
 * `introduction/overview` or `README`) to an in-app route like
 * `/docs/protocol/governance#anchor`.
 *
 * Returns `null` when the href is not a relative `.md` link (external URLs,
 * `mailto:`, in-page `#anchor`, non-Markdown paths), so the caller can fall
 * back to a plain anchor.
 */
export function resolveDocsHref(href: string | undefined, currentDocPath: string): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || isExternalHref(trimmed)) return null

  const hashIdx = trimmed.indexOf('#')
  const pathPart = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx)
  const hash = hashIdx === -1 ? '' : trimmed.slice(hashIdx)
  // Drop any query string from the path portion before checking the extension.
  const pathOnly = pathPart.split('?')[0]
  if (!/\.md$/i.test(pathOnly)) return null

  // Absolute paths are taken relative to the docs root (e.g. `/protocol/vaults.md`).
  const baseSegments = pathOnly.startsWith('/') ? [] : docDirectory(currentDocPath).split('/').filter(Boolean)
  const segments = [...baseSegments]
  for (const segment of pathOnly.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  const resolved = stripMdExtension(segments.join('/'))
  if (!resolved) return null
  return `/docs/${resolved}${hash}`
}
