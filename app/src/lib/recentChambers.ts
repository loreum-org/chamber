const MAX_RECENTS = 20

function storageKey(chainId: number): string {
  return `chamber:recents:${chainId}`
}

function normalize(addr: string): `0x${string}` | undefined {
  const value = addr.trim().toLowerCase()
  if (!value.startsWith('0x') || value.length !== 42) return undefined
  return value as `0x${string}`
}

export function getRecentChambers(chainId: number): `0x${string}`[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(chainId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: `0x${string}`[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const addr = normalize(item)
      if (!addr || seen.has(addr)) continue
      seen.add(addr)
      out.push(addr)
    }
    return out
  } catch {
    return []
  }
}

export function addRecentChamber(chainId: number, address: string): `0x${string}`[] {
  const addr = normalize(address)
  if (!addr) return getRecentChambers(chainId)
  const next = [addr, ...getRecentChambers(chainId).filter((item) => item !== addr)].slice(0, MAX_RECENTS)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(chainId), JSON.stringify(next))
    } catch {
      // ignore quota / private mode
    }
  }
  return next
}
