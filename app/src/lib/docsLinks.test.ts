import { describe, expect, it } from 'vitest'
import { docDirectory, isExternalHref, resolveDocsHref, stripMdExtension } from './docsLinks'

describe('resolveDocsHref', () => {
  it('resolves a sibling ./x.md link against the current doc folder', () => {
    expect(resolveDocsHref('./why-not-multisig.md', 'introduction/overview')).toBe(
      '/docs/introduction/why-not-multisig',
    )
  })

  it('resolves a bare sibling x.md link', () => {
    expect(resolveDocsHref('getting-started.md', 'introduction/overview')).toBe(
      '/docs/introduction/getting-started',
    )
  })

  it('resolves ../dir/x.md to another section', () => {
    expect(resolveDocsHref('../protocol/governance.md', 'introduction/overview')).toBe(
      '/docs/protocol/governance',
    )
  })

  it('resolves ./dir/x.md from README against the docs root', () => {
    expect(resolveDocsHref('./introduction/why-not-multisig.md', 'README')).toBe(
      '/docs/introduction/why-not-multisig',
    )
    expect(resolveDocsHref('./protocol/vaults.md', 'README.md')).toBe('/docs/protocol/vaults')
  })

  it('keeps the #anchor', () => {
    expect(resolveDocsHref('governance.md#seat-updates', 'protocol/vaults')).toBe(
      '/docs/protocol/governance#seat-updates',
    )
    expect(resolveDocsHref('../reference/api-reference.md#chamber', 'protocol/vaults')).toBe(
      '/docs/reference/api-reference#chamber',
    )
  })

  it('does not climb above the docs root', () => {
    expect(resolveDocsHref('../../README.md', 'introduction/overview')).toBe('/docs/README')
  })

  it('treats a leading slash as docs-root relative', () => {
    expect(resolveDocsHref('/protocol/vaults.md', 'introduction/overview')).toBe('/docs/protocol/vaults')
  })

  it('ignores external, mailto, in-page and non-markdown links', () => {
    expect(resolveDocsHref('https://www.loreum.org/whitepaper', 'README')).toBeNull()
    expect(resolveDocsHref('http://example.com/x.md', 'README')).toBeNull()
    expect(resolveDocsHref('//example.com/x.md', 'README')).toBeNull()
    expect(resolveDocsHref('mailto:chad@loreum.org', 'README')).toBeNull()
    expect(resolveDocsHref('#system-overview-swimlane', 'reference/sequence-diagrams')).toBeNull()
    expect(resolveDocsHref('/deploy', 'introduction/getting-started')).toBeNull()
    expect(resolveDocsHref('./diagram.png', 'introduction/overview')).toBeNull()
    expect(resolveDocsHref(undefined, 'README')).toBeNull()
    expect(resolveDocsHref('', 'README')).toBeNull()
  })
})

describe('helpers', () => {
  it('stripMdExtension removes a trailing .md and slash', () => {
    expect(stripMdExtension('introduction/why-not-multisig.md')).toBe('introduction/why-not-multisig')
    expect(stripMdExtension('protocol/vaults.MD')).toBe('protocol/vaults')
    expect(stripMdExtension('protocol/')).toBe('protocol')
    expect(stripMdExtension('protocol/vaults')).toBe('protocol/vaults')
  })

  it('docDirectory returns the folder of the current doc', () => {
    expect(docDirectory('introduction/overview')).toBe('introduction')
    expect(docDirectory('README')).toBe('')
    expect(docDirectory('')).toBe('')
  })

  it('isExternalHref detects schemes', () => {
    expect(isExternalHref('https://x.y')).toBe(true)
    expect(isExternalHref('mailto:a@b.c')).toBe(true)
    expect(isExternalHref('./x.md')).toBe(false)
  })
})
