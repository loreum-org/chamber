export type BoardReadStatus = 'loading' | 'error' | 'ready'

/**
 * Refetch board reads when the user enters the Board tab.
 * The chamber page stays mounted across tabs, and contract reads are cached,
 * so a tab change does not remount `getTop` / `getDelegations`.
 * The first paint (`previous === null`) is the hook's own fetch.
 */
export function boardViewShouldRefetch(previous: string | null, next: string): boolean {
  return previous !== null && next === 'board' && previous !== 'board'
}

/**
 * An empty member list is a real empty board only after a successful read.
 * A pending or failed `getTop` must not look like "no membership tokens".
 * A failed refetch that still has members keeps the last good ranking.
 */
export function boardReadStatus(input: {
  memberCount: number
  pending: boolean
  error: boolean
}): BoardReadStatus {
  if (input.memberCount > 0) return 'ready'
  if (input.pending) return 'loading'
  if (input.error) return 'error'
  return 'ready'
}
