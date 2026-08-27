/**
 * H-02: seating is mature when `block.number >= seatedAt`.
 * `seatedAt == 0` is the on-chain grandfather for pre-upgrade incumbents
 * (`Board._isSeatingMature`) — treat those seats as mature.
 *
 * Copied from `app/src/lib/chamberGovernance.ts` so the operator does not
 * depend on the React app.
 */
export function isSeatingMature(
  seatedAt: bigint | undefined,
  blockNumber: bigint | undefined,
): boolean {
  if (seatedAt === undefined) return false
  if (seatedAt === 0n) return true
  if (blockNumber === undefined) return false
  return blockNumber >= seatedAt
}
