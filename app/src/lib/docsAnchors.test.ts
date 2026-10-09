import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveDocsHref } from './docsLinks'
import { rehypeHeadingIds } from './headingSlug'

// Every `#anchor` in the in-app docs (in-page TOC links and `x.md#anchor`
// cross-links) must point at a heading id rendered by the Docs page pipeline.

const DOCS_ROOT = join(__dirname, '..', 'docs')

function listMarkdown(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return listMarkdown(full)
    return name.endsWith('.md') ? [full] : []
  })
}

const docs = new Map<string, string>(
  listMarkdown(DOCS_ROOT).map((file) => [relative(DOCS_ROOT, file).replace(/\.md$/, ''), readFileSync(file, 'utf8')]),
)

function headingIds(markdown: string): Set<string> {
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHeadingIds] }, markdown),
  )
  return new Set([...html.matchAll(/<h[1-6] id="([^"]+)"/g)].map((m) => m[1]))
}

describe('docs anchors', () => {
  it('renders ids for the sequence-diagrams Table of Contents', () => {
    const ids = headingIds(docs.get('reference/sequence-diagrams') ?? '')
    for (const id of [
      'system-overview-swimlane',
      'chamber-deployment',
      'delegation-flow',
      'transaction-submission-and-execution',
      'seat-update-proposal',
      'director-selection',
      'deposit-and-withdrawal',
    ]) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('every #anchor link in the docs has a matching heading', () => {
    const missing: string[] = []
    for (const [docPath, markdown] of docs) {
      for (const [, href] of markdown.matchAll(/\]\(([^)\s]*#[^)\s]+)\)/g)) {
        let targetDoc = docPath
        let anchor = href.slice(href.indexOf('#') + 1)
        if (!href.startsWith('#')) {
          const route = resolveDocsHref(href, docPath)
          if (!route) continue // external link
          const [path, hash] = route.replace(/^\/docs\//, '').split('#')
          targetDoc = path
          anchor = hash
        }
        const target = docs.get(targetDoc)
        if (!target || !headingIds(target).has(decodeURIComponent(anchor))) {
          missing.push(`${docPath}: ${href}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
