import { useParams, Link } from 'react-router-dom'
import { useChainId, useSwitchChain, useReadContract, useEnsName } from 'wagmi'
import { mainnet, sepolia } from '@/wagmi'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'
import { useTokenMetadata, useCollection } from '@/hooks'
import { Button, Panel, Callout, Skeleton } from '@/components/ui'
import { ipfsToGatewayUrl } from '@/lib/ipfs'

const SUPPORTED_CHAINS = [mainnet.id, sepolia.id] as const

/**
 * Token detail page — single Explorer inspection.
 * Route: /token/:id. Deep-linkable, works for any token id.
 *
 * States:
 *  - Wrong network → named state + Switch
 *  - Loading → skeleton
 *  - Nonexistent id (ownerOf reverts, or id >= totalSupply) → "hasn't been minted" + link to /
 *  - Metadata unresolved → id + owner shown; traits pending; Retry
 *  - Resolved → large image, name, token id, full attributes list, owner, links
 *
 * No seat/board/governance info. No transfer/list/sell actions.
 * Mobile parity at ≤768px via grid-cols-1 md:grid-cols-2.
 */
export function TokenDetail() {
  const { id } = useParams<{ id: string }>()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const tokenId = parseTokenId(id)
  const isWrongNetwork = !SUPPORTED_CHAINS.includes(chainId as typeof SUPPORTED_CHAINS[number])

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <div className="space-y-6">
        <DetailHeader tokenId={tokenId} />
        <Callout variant="warn" title="Unsupported network">
          Switch to Ethereum mainnet or Sepolia to view this Explorer.
        </Callout>
        <Button onClick={() => switchChain?.({ chainId: mainnet.id })}>
          Switch to Mainnet
        </Button>
      </div>
    )
  }

  // Invalid or missing id
  if (tokenId === undefined) {
    return (
      <div className="space-y-6">
        <DetailHeader tokenId={undefined} />
        <Callout variant="bad" title="Invalid token ID">
          <span>The token ID in the URL is not a valid number. </span>
          <Link to="/" className="text-accent-300 hover:text-accent-200 underline">
            Go home
          </Link>
        </Callout>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TokenDetailContent tokenId={tokenId} />
    </div>
  )
}

function DetailHeader({ tokenId }: { tokenId: bigint | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="font-heading text-2xl font-semibold text-slate-100">
        {tokenId !== undefined ? `Explorer #${tokenId.toString()}` : 'Explorer'}
      </h1>
      <Link to="/" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to home
      </Link>
    </div>
  )
}

function TokenDetailContent({ tokenId }: { tokenId: bigint }) {
  const chainId = useChainId()
  const contractAddress = getLoreumNftAddress(chainId)

  // Read ownerOf(id) — reverts if token doesn't exist
  const {
    data: ownerRaw,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useReadContract({
    address: contractAddress!,
    abi: loreumNftAbi,
    functionName: 'ownerOf',
    args: [tokenId],
    query: { enabled: contractAddress !== undefined },
  })

  // totalSupply as a secondary existence check
  const { data: collection, isLoading: collectionLoading } = useCollection()
  const totalSupply = collection.totalSupply

  // Determine if token exists:
  // - ownerOf reverts → ownerError is true
  // - id >= totalSupply → token hasn't been minted yet
  const beyondSupply = totalSupply !== undefined && tokenId >= totalSupply
  const isNonexistent = !ownerLoading && (ownerError || beyondSupply)

  // Loading state — wait for ownerOf result
  if (ownerLoading || (collectionLoading && !ownerError && !ownerRaw)) {
    return (
      <>
        <DetailHeader tokenId={tokenId} />
        <DetailSkeleton />
      </>
    )
  }

  // Nonexistent state
  if (isNonexistent) {
    return (
      <>
        <DetailHeader tokenId={tokenId} />
        <Callout variant="info" title="This Explorer hasn't been minted.">
          <span>Token #{tokenId.toString()} does not exist yet. </span>
          <Link to="/" className="text-accent-300 hover:text-accent-200 underline">
            Go home
          </Link>
        </Callout>
      </>
    )
  }

  // Token exists — show full detail
  const owner = ownerRaw as `0x${string}` | undefined

  return (
    <>
      <DetailHeader tokenId={tokenId} />
      <TokenDetailBody tokenId={tokenId} owner={owner} />
    </>
  )
}

function TokenDetailBody({
  tokenId,
  owner,
}: {
  tokenId: bigint
  owner: `0x${string}` | undefined
}) {
  const chainId = useChainId()
  const contractAddress = getLoreumNftAddress(chainId)!

  // Metadata (includes tokenUri for raw link)
  const metaResult = useTokenMetadata(tokenId)
  const meta = metaResult.data
  const tokenUri = metaResult.tokenUri

  // ENS name for owner (ENS lives on mainnet)
  const { data: ensName } = useEnsName({
    address: owner,
    chainId: mainnet.id,
  })

  // Image URL — convert ipfs:// to gateway
  const imageSrc = meta.image
    ? meta.image.startsWith('ipfs://')
      ? ipfsToGatewayUrl(meta.image)
      : meta.image
    : undefined

  // Etherscan URL (chain-correct)
  const etherscanBase = chainId === sepolia.id
    ? 'https://sepolia.etherscan.io'
    : 'https://etherscan.io'
  const etherscanTokenUrl = `${etherscanBase}/token/${contractAddress}?a=${tokenId}`

  // Owner display: ENS name when available, truncated address otherwise
  const ownerDisplay = owner
    ? ensName ?? truncateAddress(owner)
    : '—'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column: large image */}
      <Panel className="flex items-center justify-center">
        {meta.status === 'loading' ? (
          <Skeleton className="aspect-square w-full max-w-md" />
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={`Explorer #${tokenId.toString()}`}
            className="w-full max-w-md aspect-square object-cover rounded-lg"
          />
        ) : (
          <div className="w-full max-w-md aspect-square flex items-center justify-center bg-slate-800/40 rounded-lg">
            <span className="text-slate-500 text-sm">Image unavailable</span>
          </div>
        )}
      </Panel>

      {/* Right column: metadata, owner, attributes, links */}
      <div className="space-y-4">
        {/* Name + ID */}
        <Panel>
          <h2 className="font-heading text-xl font-semibold text-slate-100">
            {meta.status === 'resolved' && meta.name
              ? meta.name
              : `Explorer #${tokenId.toString()}`}
          </h2>
          <p className="font-mono text-sm text-slate-400 mt-1">
            Token #{tokenId.toString()}
          </p>
        </Panel>

        {/* Owner */}
        <Panel>
          <div className="text-sm text-slate-400 mb-1">Owner</div>
          <div className="font-mono text-sm text-slate-100 break-all">
            {ownerDisplay}
          </div>
          {owner && ensName && (
            <div className="font-mono text-xs text-slate-500 mt-0.5 break-all">
              {truncateAddress(owner)}
            </div>
          )}
        </Panel>

        {/* Attributes */}
        <Panel>
          <div className="text-sm text-slate-400 mb-2">Attributes</div>
          {meta.status === 'loading' ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24" />
              ))}
            </div>
          ) : meta.status === 'unresolved' ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Metadata could not be resolved. The token URI may be unavailable.
              </p>
              <Button variant="ghost" size="sm" onClick={() => metaResult.refetch()}>
                Retry
              </Button>
            </div>
          ) : meta.attributes && meta.attributes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {meta.attributes
                .filter((a) => a.trait_type !== undefined && a.value !== undefined && a.value !== null)
                .map((a, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-700/30"
                  >
                    <div className="text-[11px] text-slate-500 uppercase tracking-wide">
                      {String(a.trait_type)}
                    </div>
                    <div className="text-sm text-slate-200 font-medium">
                      {String(a.value)}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No attributes.</p>
          )}
        </Panel>

        {/* Links */}
        <Panel>
          <div className="text-sm text-slate-400 mb-2">Links</div>
          <div className="space-y-1.5">
            <a
              href={etherscanTokenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              View on Etherscan ↗
            </a>
            {tokenUri && (
              <a
                href={tokenUri}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-slate-400 hover:text-slate-300 transition-colors break-all"
              >
                Raw token URI ↗
              </a>
            )}
          </div>
        </Panel>

        {/* Navigation */}
        <Link
          to="/gallery"
          className="text-sm text-slate-400 hover:text-accent-400 transition-colors"
        >
          ← Back to gallery
        </Link>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Panel className="flex items-center justify-center">
        <Skeleton className="aspect-square w-full max-w-md" />
      </Panel>
      <div className="space-y-4">
        <Panel>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-24" />
        </Panel>
        <Panel>
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </Panel>
        <Panel>
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </Panel>
        <Panel>
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-4 w-40" />
        </Panel>
      </div>
    </div>
  )
}

/** Parse a token ID from the URL param. Returns undefined if invalid. */
function parseTokenId(id: string | undefined): bigint | undefined {
  if (!id) return undefined
  try {
    const n = BigInt(id)
    return n >= 0n ? n : undefined
  } catch {
    return undefined
  }
}

/** Truncate an Ethereum address to 0x1234…abcd format. */
function truncateAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
