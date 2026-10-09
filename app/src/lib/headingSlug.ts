/**
 * GitHub-style heading anchors for the in-app docs (`/docs/*`).
 *
 * The Markdown under `app/src/docs/**` links to sections with GitHub anchors
 * (e.g. the sequence-diagrams Table of Contents → `#delegation-flow`, or
 * `governance.md#seat-updates` resolved by `resolveDocsHref`). These helpers
 * give rendered headings matching `id`s without adding a dependency such as
 * `rehype-slug` / `github-slugger`; the algorithm mirrors github-slugger:
 * lowercase, drop punctuation/symbols (keeping letters, numbers, `-`, `_` and
 * spaces), spaces → `-`, and de-duplicate repeats with `-1`, `-2`, ….
 */

// Anything that isn't a letter, combining mark, number, connector (`_`), space or `-`.
const STRIP = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu

/** Slug a single heading text the way GitHub does (no de-duplication). */
export function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(STRIP, '').replace(/ /g, '-')
}

/** Stateful slugger: repeated headings get `-1`, `-2`, … like GitHub. */
export function createHeadingSlugger(): (text: string) => string {
  const occurrences = new Map<string, number>()
  return (text: string) => {
    const base = slugifyHeading(text)
    let slug = base
    while (occurrences.has(slug)) {
      const next = (occurrences.get(base) ?? 0) + 1
      occurrences.set(base, next)
      slug = `${base}-${next}`
    }
    occurrences.set(slug, 0)
    return slug
  }
}

/** Minimal hast shapes (avoids a direct `@types/hast` dependency). */
interface HastNode {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Concatenated text content of a hast node (like `element.textContent`). */
export function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

/**
 * Tiny rehype plugin: set a GitHub-style `id` on every heading that doesn't
 * already have one. Each document render gets a fresh slugger so duplicates
 * are numbered per page, in document order.
 */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const slug = createHeadingSlugger()
    const visit = (node: HastNode) => {
      if (node.type === 'element' && node.tagName && HEADING_TAGS.has(node.tagName)) {
        node.properties = node.properties ?? {}
        if (!node.properties.id) node.properties.id = slug(hastText(node))
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

/** Element id targeted by a location hash (`#delegation-flow` → `delegation-flow`), or null. */
export function hashToId(hash: string | undefined | null): string | null {
  if (!hash || hash === '#') return null
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
