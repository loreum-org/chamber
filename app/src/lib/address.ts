export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

export function isNonZeroAddress(addr: string | undefined): addr is `0x${string}` {
  return !!addr && addr !== ZERO_ADDRESS && addr.startsWith('0x') && addr.length === 42
}
