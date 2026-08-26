export interface Transaction {
  id: number
  executed: boolean
  /** Stored confirmation counter (includes evicted tokenIds until they revoke). */
  confirmations: number
  /** Confirmations whose tokenId is still in the live top-seat set (H-01). */
  liveConfirmations?: number
  /** max(submit snapshot, live quorum) — M-04. */
  requiredConfirmations?: number
  target: `0x${string}`
  value: bigint
  /** `keccak256(calldata)` stored onchain; full calldata must be supplied at execution unless stored (L-04). */
  dataHash: `0x${string}`
  /** Exclusive-after unix timestamp (M-06). */
  deadline?: bigint
  expired?: boolean
}

export interface BoardMember {
  tokenId: bigint
  amount: bigint
  next: bigint
  prev: bigint
  owner?: `0x${string}`
  rank?: number
}

export interface SeatUpdate {
  proposedSeats: bigint
  timestamp: bigint
  requiredQuorum: bigint
  supporters: bigint[]
}

export interface Delegation {
  tokenId: bigint
  amount: bigint
}

export interface ChamberInfo {
  address: `0x${string}`
  name: string
  symbol: string
  totalAssets: bigint
  totalSupply: bigint
  seats: number
  quorum: number
  directors: `0x${string}`[]
  transactionCount: number
  assetToken: `0x${string}`
  nftToken: `0x${string}`
  version: string
  paused?: boolean
}

export interface TransactionQueueItem extends Transaction {
  status: 'pending' | 'ready' | 'executed' | 'failed' | 'cancelled' | 'expired'
  requiredConfirmations: number
}
