import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { getAddress } from 'viem'
import {
  indexerAppliesToChain,
  indexerRequest,
  indexerRetry,
  indexerRetryDelay,
  type IndexerHead,
} from '@/lib/indexer'

/** Ponder 0.8 caps list queries at 1000 rows. */
const PAGE_LIMIT = 1000

const CHAMBER_PROPOSALS_QUERY = /* GraphQL */ `
  query ChamberProposals($chamber: String!, $limit: Int!) {
    proposals(where: { chamberId: $chamber }, orderBy: "nonce", orderDirection: "asc", limit: $limit) {
      items {
        nonce
        executed
        confirmations
        target
        value
        data
        dataHash
        deadline
        requiredQuorum
        cancelled
        cancelConfirmations
        metadataURI
      }
    }
    proposalVotes(where: { chamberId: $chamber }, limit: $limit) {
      items {
        nonce
        tokenId
        confirmed
        cancelVoted
      }
    }
    _meta {
      status
    }
  }
`

export type IndexedProposal = {
  nonce: bigint
  executed: boolean
  confirmations: number
  target: `0x${string}`
  value: bigint
  dataHash: `0x${string}`
  /** Calldata from the stored view or the SubmitTransaction event; undefined if unknown. */
  data?: `0x${string}`
  deadline?: bigint
  requiredQuorum?: bigint
  cancelled: boolean
  cancelConfirmations: number
  metadataURI?: string
}

export type IndexedProposalVote = {
  nonce: bigint
  tokenId: bigint
  confirmed: boolean
  cancelVoted: boolean
}

type RawProposal = {
  nonce: string
  executed: boolean
  confirmations: number | null
  target: string | null
  value: string | null
  data: string | null
  dataHash: string | null
  deadline: string | null
  requiredQuorum: string | null
  cancelled: boolean
  cancelConfirmations: number | null
  metadataURI: string | null
}

type RawVote = { nonce: string; tokenId: string; confirmed: boolean; cancelVoted: boolean }

type ProposalsResponse = {
  proposals: { items: RawProposal[] }
  proposalVotes: { items: RawVote[] }
}

const optionalBig = (v: string | null) => (v === null ? undefined : BigInt(v))

function parseProposal(row: RawProposal): IndexedProposal | undefined {
  // A proposal row can exist before its submit event is indexed (deadline /
  // metadata events come first in the same tx); skip until it has a target.
  if (row.target === null || row.dataHash === null) return undefined
  return {
    nonce: BigInt(row.nonce),
    executed: row.executed,
    confirmations: row.confirmations ?? 0,
    // Indexer stores lowercase hex; checksum for display parity with RPC reads.
    target: getAddress(row.target),
    value: BigInt(row.value ?? '0'),
    dataHash: row.dataHash as `0x${string}`,
    data: (row.data as `0x${string}` | null) ?? undefined,
    deadline: optionalBig(row.deadline),
    requiredQuorum: optionalBig(row.requiredQuorum),
    cancelled: row.cancelled,
    cancelConfirmations: row.cancelConfirmations ?? 0,
    metadataURI: row.metadataURI || undefined,
  }
}

/**
 * All wallet transactions and per-seat votes for a chamber, from chamber-indexer.
 * `enabled` is false when no indexer serves the connected chain; callers fall back to RPC.
 */
export function useIndexedProposals(chamberAddress: `0x${string}` | undefined) {
  const chainId = useChainId()
  const enabled = !!chamberAddress && indexerAppliesToChain(chainId)
  const chamber = chamberAddress?.toLowerCase()

  const query = useQuery({
    queryKey: ['indexer', 'proposals', chainId, chamber],
    enabled,
    retry: indexerRetry,
    retryDelay: indexerRetryDelay,
    queryFn: async () => {
      const { data, head } = await indexerRequest<ProposalsResponse>(
        CHAMBER_PROPOSALS_QUERY,
        { chamber, limit: PAGE_LIMIT },
        { chamber },
      )
      const proposals = data.proposals.items
        .map(parseProposal)
        .filter((p): p is IndexedProposal => p !== undefined)
      const votes: IndexedProposalVote[] = data.proposalVotes.items.map((v) => ({
        nonce: BigInt(v.nonce),
        tokenId: BigInt(v.tokenId),
        confirmed: v.confirmed,
        cancelVoted: v.cancelVoted,
      }))
      return { proposals, votes, head: head as IndexerHead | undefined }
    },
  })

  return {
    enabled,
    proposals: query.data?.proposals,
    votes: query.data?.votes,
    head: query.data?.head,
    isFetched: query.isFetched,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
