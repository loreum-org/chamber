import { describe, expect, it } from 'vitest'
import { createHeadingSlugger, hashToId, rehypeHeadingIds, slugifyHeading } from './headingSlug'

describe('slugifyHeading', () => {
  it('matches the sequence-diagrams Table of Contents anchors', () => {
    const headings: Record<string, string> = {
      'System Overview Swimlane': 'system-overview-swimlane',
      'Chamber Deployment': 'chamber-deployment',
      'Delegation Flow': 'delegation-flow',
      'Transaction Submission and Execution': 'transaction-submission-and-execution',
      'Seat Update Proposal': 'seat-update-proposal',
      'Director Selection': 'director-selection',
      'Deposit and Withdrawal': 'deposit-and-withdrawal',
    }
    for (const [text, slug] of Object.entries(headings)) {
      expect(slugifyHeading(text)).toBe(slug)
    }
  })

  it('strips punctuation like GitHub, keeping - and _', () => {
    expect(slugifyHeading('Events / errors')).toBe('events--errors')
    expect(slugifyHeading('Nested chambers (contemplated)')).toBe('nested-chambers-contemplated')
    expect(slugifyHeading("What's new? v1.2!")).toBe('whats-new-v12')
    expect(slugifyHeading('submit_transaction()')).toBe('submit_transaction')
    expect(slugifyHeading('Pre-flight & checks')).toBe('pre-flight--checks')
    expect(slugifyHeading('`Chamber.sol` API')).toBe('chambersol-api')
  })

  it('keeps non-ASCII letters', () => {
    expect(slugifyHeading('Über Café')).toBe('über-café')
  })
})

describe('createHeadingSlugger', () => {
  it('de-duplicates repeats with -1, -2 in order', () => {
    const slug = createHeadingSlugger()
    expect(slug('Read')).toBe('read')
    expect(slug('Read')).toBe('read-1')
    expect(slug('Write')).toBe('write')
    expect(slug('Read')).toBe('read-2')
  })

  it('does not collide with a literal heading that already ends in -1', () => {
    const slug = createHeadingSlugger()
    expect(slug('Foo')).toBe('foo')
    expect(slug('Foo 1')).toBe('foo-1')
    expect(slug('Foo')).toBe('foo-2')
  })
})

describe('rehypeHeadingIds', () => {
  it('sets ids on headings from their text content and leaves existing ids', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: 'Delegation Flow' }] },
        {
          type: 'element',
          tagName: 'h3',
          properties: {},
          children: [
            { type: 'element', tagName: 'code', properties: {}, children: [{ type: 'text', value: 'Chamber' }] },
            { type: 'text', value: ' events' },
          ],
        },
        { type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: 'Delegation Flow' }] },
        { type: 'element', tagName: 'h2', properties: { id: 'custom' }, children: [{ type: 'text', value: 'X' }] },
        { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: 'Delegation Flow' }] },
      ],
    }
    rehypeHeadingIds()(tree)
    const ids = tree.children.map((n) => (n.properties as Record<string, unknown>).id)
    expect(ids).toEqual(['delegation-flow', 'chamber-events', 'delegation-flow-1', 'custom', undefined])
  })
})

describe('hashToId', () => {
  it('decodes the location hash', () => {
    expect(hashToId('#delegation-flow')).toBe('delegation-flow')
    expect(hashToId('#%C3%BCber-caf%C3%A9')).toBe('über-café')
    expect(hashToId('#100%')).toBe('100%')
    expect(hashToId('')).toBeNull()
    expect(hashToId('#')).toBeNull()
    expect(hashToId(undefined)).toBeNull()
  })
})
