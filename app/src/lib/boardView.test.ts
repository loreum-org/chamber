import { describe, expect, it } from 'vitest'
import { boardReadStatus, boardViewShouldRefetch } from './boardView'

describe('boardViewShouldRefetch', () => {
  it('refetches only when the user switches onto the Board tab', () => {
    expect(boardViewShouldRefetch(null, 'board')).toBe(false)
    expect(boardViewShouldRefetch('delegation', 'board')).toBe(true)
    expect(boardViewShouldRefetch('overview', 'board')).toBe(true)
    expect(boardViewShouldRefetch('board', 'board')).toBe(false)
    expect(boardViewShouldRefetch('board', 'delegation')).toBe(false)
    expect(boardViewShouldRefetch('overview', 'vault')).toBe(false)
  })
})

describe('boardReadStatus', () => {
  it('does not treat a pending or failed read as an empty board', () => {
    expect(boardReadStatus({ memberCount: 0, pending: true, error: false })).toBe('loading')
    expect(boardReadStatus({ memberCount: 0, pending: false, error: true })).toBe('error')
    expect(boardReadStatus({ memberCount: 0, pending: false, error: false })).toBe('ready')
  })

  it('keeps the last ranking when a refetch fails after members loaded', () => {
    expect(boardReadStatus({ memberCount: 2, pending: false, error: true })).toBe('ready')
    expect(boardReadStatus({ memberCount: 2, pending: true, error: false })).toBe('ready')
  })
})
