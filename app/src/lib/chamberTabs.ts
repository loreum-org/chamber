export type ChamberTab = 'overview' | 'board' | 'staking' | 'delegation' | 'proposals'

/** Route for each section of a chamber page; Proposals lives at /transactions. */
export function chamberTabHref(chamberAddress: `0x${string}`, tab: ChamberTab): string {
  switch (tab) {
    case 'overview':
      return `/chamber/${chamberAddress}`
    case 'proposals':
      return `/chamber/${chamberAddress}/transactions`
    default:
      return `/chamber/${chamberAddress}/${tab}`
  }
}
