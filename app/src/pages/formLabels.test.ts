import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// The app's vitest setup runs in the node environment (no DOM / Testing Library),
// so pages are rendered to static markup and labels are resolved the same way
// `getByLabelText` does: <label for="id"> → element with that id, or aria-label.

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: false, address: undefined }),
  useChainId: () => 11155111,
  useReadContract: () => ({ data: undefined }),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => null,
}))

vi.mock('@/hooks', () => ({
  useMyChambers: () => ({ chambers: [], recents: [] }),
}))

vi.mock('@/hooks/useComplianceMetrics', () => ({
  useComplianceMetrics: () => ({
    metrics: null,
    snapshot: null,
    computedAt: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: async () => undefined,
  }),
}))

vi.mock('@/lib/wagmi', () => ({
  getNetworkName: () => 'Sepolia',
}))

import Migrate, { PhaseParallel } from './Migrate'
import Compliance from './Compliance'

const FORM_CONTROL = /<(input|select|textarea)\b[^>]*>/g

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m?.[1]
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** Static-markup equivalent of Testing Library's `getByLabelText`. Returns the control's opening tag. */
function getByLabelText(html: string, text: string): string {
  const matches: string[] = []
  const labelRe = /<label\b([^>]*)>([\s\S]*?)<\/label>/g
  for (const [, attrs, inner] of html.matchAll(labelRe)) {
    if (stripTags(inner) !== text) continue
    const forId = attr(` ${attrs}`, 'for')
    if (!forId) continue
    for (const [tag] of html.matchAll(FORM_CONTROL)) {
      if (attr(tag, 'id') === forId) matches.push(tag)
    }
  }
  for (const [tag] of html.matchAll(FORM_CONTROL)) {
    if (attr(tag, 'aria-label') === text) matches.push(tag)
  }
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one control labelled "${text}", found ${matches.length}`)
  }
  return matches[0]
}

/** Every input/select/textarea must have an associated <label for> or an aria-label. */
function unlabeledControls(html: string): string[] {
  const labelled = new Set(
    [...html.matchAll(/<label\b[^>]*\sfor="([^"]*)"/g)].map(([, id]) => id),
  )
  return [...html.matchAll(FORM_CONTROL)]
    .map(([tag]) => tag)
    .filter((tag) => {
      if (attr(tag, 'type') === 'hidden') return false
      if (attr(tag, 'aria-label') || attr(tag, 'aria-labelledby')) return false
      const id = attr(tag, 'id')
      return !(id && labelled.has(id))
    })
}

describe('/migrate form labels', () => {
  const connectHtml = renderToStaticMarkup(createElement(Migrate))
  const parallelHtml = renderToStaticMarkup(
    createElement(PhaseParallel, {
      cooldownDays: 14,
      setCooldownDays: () => {},
      parallelRun: {
        startDate: 0,
        cooldownDays: 14,
        steps: [],
        mirroredTxCount: 0,
        safeTxCount: 0,
        divergences: 0,
      },
      startParallelRun: () => {},
      mapping: [],
      canProceed: false,
      onNext: () => {},
      onPrev: () => {},
    }),
  )

  it('labels the Safe Address input', () => {
    const tag = getByLabelText(connectHtml, 'Safe Address')
    expect(attr(tag, 'id')).toBe('migrate-safe-address')
    expect(attr(tag, 'type')).toBe('text')
  })

  it('labels the Seats slider and announces its value', () => {
    const tag = getByLabelText(connectHtml, 'Seats')
    expect(attr(tag, 'id')).toBe('migrate-seats')
    expect(attr(tag, 'type')).toBe('range')
    expect(attr(tag, 'aria-valuetext')).toBe('5 seats')
  })

  it('labels the Cooldown Period slider and announces its value', () => {
    const tag = getByLabelText(parallelHtml, 'Cooldown Period')
    expect(attr(tag, 'id')).toBe('migrate-cooldown')
    expect(attr(tag, 'type')).toBe('range')
    expect(attr(tag, 'aria-valuetext')).toBe('14 days')
  })

  it('has no unlabeled form controls', () => {
    expect(unlabeledControls(connectHtml)).toEqual([])
    expect(unlabeledControls(parallelHtml)).toEqual([])
  })
})

describe('/compliance form labels', () => {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ['/compliance'] }, createElement(Compliance)),
  )

  it('labels the manual Chamber address input and keeps its placeholder', () => {
    const tag = getByLabelText(html, 'Chamber address')
    expect(attr(tag, 'placeholder')).toBe('Paste chamber address…')
  })

  it('keeps the chamber select labelled', () => {
    expect(attr(getByLabelText(html, 'Chamber'), 'id')).toBe('compliance-chamber')
  })

  it('has no unlabeled form controls', () => {
    expect(unlabeledControls(html)).toEqual([])
  })
})
