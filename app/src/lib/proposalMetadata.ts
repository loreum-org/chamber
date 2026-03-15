/**
 * Proposal metadata storage (title, description) for Chamber transactions.
 * Stored in localStorage since the contract does not support on-chain metadata.
 * Key: chamber-proposal-{chamberAddress}-{txId}
 */

const STORAGE_PREFIX = 'chamber-proposal'

export interface ProposalMetadata {
  title: string
  description?: string
  templateId?: string
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
