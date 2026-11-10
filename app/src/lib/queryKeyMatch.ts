/**
 * Whether a React Query key mentions `needle`.
 *
 * Wagmi stores uint args as bigint (`getTop(count)`, `ownerOf(tokenId)`).
 * `JSON.stringify` throws on bigint, so a predicate that stringifies the key
 * skips those reads and leaves them cached after a write.
 */
export function queryKeyIncludes(queryKey: readonly unknown[], needle: string): boolean {
  const target = needle.toLowerCase()
  if (!target) return false
  try {
    return visit(queryKey, target, new WeakSet())
  } catch {
    return false
  }
}

function visit(value: unknown, target: string, seen: WeakSet<object>): boolean {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value).toLowerCase().includes(target)
  }
  if (value === null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      if (visit(item, target, seen)) return true
    }
    return false
  }
  for (const item of Object.values(value)) {
    if (visit(item, target, seen)) return true
  }
  return false
}
