/**
 * Proposal metadata helpers for Chamber transactions.
 * Metadata is now committed onchain as a URI, with localStorage kept as a legacy fallback.
 * Key: chamber-proposal-{chamberAddress}-{txId}
 */

const STORAGE_PREFIX = 'chamber-proposal'

export interface ProposalMetadata {
  title: string
  description?: string
  templateId?: string
  riskLevel?: 'low' | 'medium' | 'high'
  riskSummary?: string
  target?: string
  valueEth?: string
  functionName?: string
  /** Full execution calldata (hex); optional archive for directors on other devices. */
  calldata?: string
  metadataURI?: string
  createdAt: number
}

function storageKey(chamberAddress: string, txId: number): string {
  return `${STORAGE_PREFIX}-${chamberAddress.toLowerCase()}-${txId}`
}

export function getProposalMetadata(
  chamberAddress: string,
  txId: number
): ProposalMetadata | null {
  try {
    const raw = localStorage.getItem(storageKey(chamberAddress, txId))
    if (!raw) return null
    return JSON.parse(raw) as ProposalMetadata
  } catch {
    return null
  }
}

export function setProposalMetadata(
  chamberAddress: string,
  txId: number,
  meta: Omit<ProposalMetadata, 'createdAt'>
): void {
  const key = storageKey(chamberAddress, txId)
  const full: ProposalMetadata = {
    ...meta,
    createdAt: Date.now(),
  }
  localStorage.setItem(key, JSON.stringify(full))
}

export function createProposalMetadataURI(meta: Omit<ProposalMetadata, 'createdAt'>): string {
  const payload: ProposalMetadata = {
    ...meta,
    createdAt: Date.now(),
  }
  return `data:application/json;base64,${btoa(JSON.stringify(payload))}`
}

export function parseProposalMetadataURI(metadataURI?: string): ProposalMetadata | null {
  if (!metadataURI) return null

  try {
    if (metadataURI.startsWith('data:application/json;base64,')) {
      const encoded = metadataURI.replace('data:application/json;base64,', '')
      return JSON.parse(atob(encoded)) as ProposalMetadata
    }

    if (metadataURI.startsWith('data:application/json,')) {
      const encoded = metadataURI.replace('data:application/json,', '')
      return JSON.parse(decodeURIComponent(encoded)) as ProposalMetadata
    }
  } catch {
    return null
  }

  return {
    title: 'External proposal metadata',
    metadataURI,
    createdAt: 0,
  }
}
