import { useAccount, useChainId, useReadContracts } from 'wagmi'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'

export type AllowanceReason = 'ok' | 'wallet_limit' | 'sold_out'

export interface AllowanceData {
  totalMinted: bigint | undefined
  balance: bigint | undefined
  claimable: bigint | undefined
  reason: AllowanceReason | undefined
}

/**
 * Pure claimable math — exported for unit testing.
 * claimable = min(MAX_MINT − totalMinted, MAX_SUPPLY − totalSupply), floored at 0.
 */
export function computeClaimable(
  totalMinted: bigint,
  totalSupply: bigint,
  maxSupply: bigint,
  maxMint: bigint,
): { claimable: bigint; reason: AllowanceReason } {
  const walletRemaining = maxMint - totalMinted
  const globalRemaining = maxSupply - totalSupply
  const raw = walletRemaining < globalRemaining ? walletRemaining : globalRemaining
  const claimable = raw > 0n ? raw : 0n

  const reason: AllowanceReason =
    claimable === 0n
      ? globalRemaining <= 0n
        ? 'sold_out'
        : 'wallet_limit'
      : 'ok'

  return { claimable, reason }
}

/**
 * Derive how many tokens the connected wallet can still mint.
 * claimable = min(MAX_MINT − totalMinted, MAX_SUPPLY − totalSupply), floored at 0.
 * reason: 'ok' | 'wallet_limit' | 'sold_out'
 */
export function useMyAllowance() {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const contractAddress = getLoreumNftAddress(chainId)
  const enabled = contractAddress !== undefined && account !== undefined

  const contracts = enabled
    ? ([
        // 0: totalMinted(me) — uses balanceOf as proxy (tokens already minted by this wallet)
        { address: contractAddress, abi: loreumNftAbi, functionName: 'balanceOf', args: [account!] },
        // 1: totalSupply (global)
        { address: contractAddress, abi: loreumNftAbi, functionName: 'totalSupply' },
        // 2: MAX_SUPPLY
        { address: contractAddress, abi: loreumNftAbi, functionName: 'MAX_SUPPLY' },
        // 3: MAX_MINT (per-wallet cap)
        { address: contractAddress, abi: loreumNftAbi, functionName: 'MAX_MINT' },
      ] as const)
    : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = useReadContracts({ contracts, query: { enabled } } as any)
  const results = (query.data ?? []) as Array<{ result?: unknown; status?: string }>

  const balance = results[0]?.result as bigint | undefined
  const totalSupply = results[1]?.result as bigint | undefined
  const maxSupply = results[2]?.result as bigint | undefined
  const maxMint = results[3]?.result as bigint | undefined

  // totalMinted by this wallet = balance (tokens already minted)
  const totalMinted = balance

  let claimable: bigint | undefined
  let reason: AllowanceReason | undefined

  if (maxMint !== undefined && totalSupply !== undefined && maxSupply !== undefined && totalMinted !== undefined) {
    const { claimable: c, reason: r } = computeClaimable(totalMinted, totalSupply, maxSupply, maxMint)
    claimable = c
    reason = r
  }

  const data: AllowanceData = { totalMinted, balance, claimable, reason }
  return { ...query, data }
}
