export interface Transaction {
  id: number
  executed: boolean
  confirmations: number
  target: `0x${string}`
  value: bigint
  data: `0x${string}`
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
}

export interface TransactionQueueItem extends Transaction {
  status: 'pending' | 'ready' | 'executed' | 'failed'
  requiredConfirmations: number
}
