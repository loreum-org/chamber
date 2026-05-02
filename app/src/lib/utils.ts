import { BaseError, getAddress, hexToString, type Hex } from 'viem'

/** EIP-1967 implementation slot (OpenZeppelin `ERC1967Utils.IMPLEMENTATION_SLOT`). */
export const ERC1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const

/** Decode `Chamber.VERSION` (`bytes32` short string, right-padded) for UI. */
export function chamberVersionBytes32ToLabel(value: Hex | undefined): string | undefined {
  if (!value || value === '0x') return undefined
  try {
    const s = hexToString(value, { size: 32 })
    const trimmed = s.replace(/\0+$/g, '').trim()
    return trimmed.length > 0 ? trimmed : undefined
  } catch {
    return undefined
  }
}

export function addressFromEip1967ImplementationSlot(slotValue: Hex | undefined): `0x${string}` | undefined {
  if (!slotValue || slotValue === '0x' || slotValue === `0x${'0'.repeat(64)}`) return undefined
  try {
    return getAddress(`0x${slotValue.slice(-40)}` as `0x${string}`)
  } catch {
    return undefined
  }
}

export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

/** Human-readable revert / RPC messages for toast UI (wagmi/viem/BaseError chains). */
export function formatWalletSendError(error: unknown, fallback = 'Transaction failed'): string {
  if (error instanceof BaseError) return (error.shortMessage || error.message || fallback).trim()
  if (typeof error === 'object' && error !== null) {
    const o = error as { shortMessage?: string; message?: string }
    const s = typeof o.shortMessage === 'string' ? o.shortMessage.trim() : ''
    if (s) return s
    const m = typeof o.message === 'string' ? o.message.trim() : ''
    if (m && m !== 'Rejected user operation.' && !m.includes('Internal JSON-RPC error')) return m.slice(0, 320)
    if (m) return m.slice(0, 280)
  }
  if (error instanceof Error) return error.message.slice(0, 280)
  return fallback
}

/** Full toast body for localhost test ERC-721 mint (nonce/cache vs chain reset guidance). */
export function formatLocalTestMintToast(error: unknown): string {
  const base = formatWalletSendError(error)
  const b = base.toLowerCase()

  const nonceStale =
    b.includes('nonce too low') ||
    b.includes('nonce too high') ||
    b.includes('invalid nonce')

  if (nonceStale) {
    return `${base}. Wallets often cache the next tx nonce; after Anvil restarts the chain nonce resets. In MetaMask: Settings → Advanced → Clear activity tab data, then mint again. Other wallets: disconnect or use an account reset for this network if available. If the chain was wiped, also run make setup-local.`
  }

  return `${base} If Anvil was reset, redeploy mocks (make setup-local).`
}

/** Chain ID to block explorer base URL */
const BLOCK_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  31337: 'http://localhost:8545', // Anvil - no block explorer by default
}

export function getBlockExplorerUrl(chainId: number): string {
  return BLOCK_EXPLORERS[chainId] ?? 'https://etherscan.io'
}

export function getBlockExplorerAddressUrl(address: string, chainId: number): string {
  const base = getBlockExplorerUrl(chainId)
  if (chainId === 31337) return base
  return `${base}/address/${address}`
}

export function getBlockExplorerTxUrl(txHash: string, chainId: number): string {
  const base = getBlockExplorerUrl(chainId)
  if (chainId === 31337) return base
  return `${base}/tx/${txHash}`
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatNumber(value: number | bigint, decimals = 2): string {
  const num = typeof value === 'bigint' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatCompactNumber(value: number | bigint): string {
  const num = typeof value === 'bigint' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num)
}

export function formatTimestamp(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(timestamp: number | bigint): string {
  const now = Date.now()
  const time = Number(timestamp) * 1000
  const diff = now - time

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

export function parseDataField(data: string): { method?: string; decoded?: string } {
  if (!data || data === '0x') {
    return { method: 'Native Transfer' }
  }
  
  // Common method signatures (4-byte selectors)
  const methodSignatures: Record<string, string> = {
    '0xa9059cbb': 'transfer(address,uint256)',
    '0x23b872dd': 'transferFrom(address,address,uint256)',
    '0x095ea7b3': 'approve(address,uint256)',
    '0x40c10f19': 'mint(address,uint256)',
    '0x42966c68': 'burn(uint256)',
    '0xa0712d68': 'mint(uint256)',
    '0x2e1a7d4d': 'withdraw(uint256)',
    '0xd0e30db0': 'deposit()',
    '0x70a08231': 'balanceOf(address)',
    '0x18160ddd': 'totalSupply()',
    '0x38ed1739': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
    '0x7ff36ab5': 'swapExactETHForTokens(uint256,address[],address,uint256)',
    '0x18cbafe5': 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
    '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens(...)',
    '0x4e71d92d': 'claim()',
    '0x2e17de78': 'claim(uint256)',
    '0x3d18b912': 'withdraw(uint256,uint256)',
    '0xe2bbb158': 'deposit(uint256,uint256)',
  }

  const methodId = data.slice(0, 10).toLowerCase()
  const method = methodSignatures[methodId]

  return {
    method: method || `Unknown (${methodId})`,
    decoded: data.slice(10),
  }
}
