import { useParams, Link, useNavigate } from 'react-router-dom'
import { useChainId, useSwitchChain, useReadContract, useEnsName } from 'wagmi'
import { mainnet, sepolia } from '@/wagmi'
import { getLoreumNftAddress } from '@/lib/addresses'
import { isBeyondSupply } from '@/lib/beyondSupply'
import { ipfsToGatewayUrl } from '@/lib/ipfs'
import { loreumNftAbi } from '@/abi'
import { useTokenMetadata, useCollection } from '@/hooks'
import {
  ArtFrame,
  SectionHeading,
  Button,
  Callout,
  Skeleton,
  buttonClass,
} from '@/components/ui'

const SUPPORTED_CHAINS = [mainnet.id, sepolia.id] as const

/**
 * /token/:id — provenance- and rarity-forward detail page (#311).
 *
 * Two-column layout:
 *  - Left: large art via ArtFrame (shadow-glow, eager load)
 *  - Right: name + #id, traits as the hero (grid, only when resolved),
 *    owner (ENS on mainnet else truncated), provenance links, prev/next nav
 *
 * States: wrong_network · invalid id · loading · not-minted · resolved.
 * All data from useCollection, useTokenMetadata, ownerOf, useEnsName.
 */
export function TokenDetail() {
  const { id } = useParams<{ id: string }>()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const tokenId = parseTokenId(id)
  const isWrongNetwork = !SUPPORTED_CHAINS.includes(chainId as (typeof SUPPORTED_CHAINS)[number])

  // Wrong network
  if (isWrongNetwork) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Token detail"
          title={tokenId !== undefined ? `Explorer #${tokenId.toString()}` : 'Explorer'}
          description="Switch to a supported network to view this token."
        />
        <Callout variant="warn" title="Unsupported network">
          <span>Explorers are on Ethereum mainnet and Sepolia testnet. Switch your wallet to continue.</span>
          <div className="mt-3">
            <Button size="sm" onClick={() => switchChain?.({ chainId: mainnet.id })}>
              Switch to Ethereum
            </Button>
          </div>
        </Callout>
      </div>
    )
  }

  // Invalid or missing id
  if (tokenId === undefined) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Token detail"
          title="Invalid token"
          description="The token ID in the URL is not valid."
        />
        <Callout variant="bad" title="Invalid token ID">
          <span>The token ID in the URL is not a valid number. </span>
          <Link to="/" className="text-accent-300 underline underline-offset-2 hover:text-accent-200">
            Go home
          </Link>
        </Callout>
      </div>
    )
  }

  return <TokenDetailContent tokenId={tokenId} />
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

  const { data: collection, isLoading: collectionLoading } = useCollection()
  const totalSupply = collection.totalSupply

  // Token existence checks. LoreumNFT ids are 1..N when totalSupply is N.
  const beyondSupply = isBeyondSupply(tokenId, totalSupply)
  const isNonexistent = !ownerLoading && (ownerError || beyondSupply)

  // Loading
  if (ownerLoading || (collectionLoading && !ownerError && !ownerRaw)) {
    return <DetailSkeleton tokenId={tokenId} />
  }

  // Not minted
  if (isNonexistent) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Token detail"
          title={`Explorer #${tokenId.toString()}`}
          description="This token hasn't been minted yet."
        />
        <div className="glass p-10 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-accent-600/10 text-accent-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-semibold text-slate-100">
            Not yet minted
          </h3>
          <p className="mt-2 max-w-sm mx-auto text-sm text-slate-400">
            Token #{tokenId.toString()} hasn't been minted yet.{' '}
            {totalSupply !== undefined && (
              <>Currently {totalSupply.toString()} of {collection.maxSupply?.toString()} exist. </>
            )}
          </p>
          <div className="mt-6">
            <Link to="/claim" className={buttonClass('primary', 'lg', 'px-7')}>
              Claim an Explorer
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const owner = ownerRaw as `0x${string}` | undefined

  return <TokenDetailBody tokenId={tokenId} owner={owner} totalSupply={totalSupply} />
}

function TokenDetailBody({
  tokenId,
  owner,
  totalSupply,
}: {
  tokenId: bigint
  owner: `0x${string}` | undefined
  totalSupply: bigint | undefined
}) {
  const chainId = useChainId()
  const navigate = useNavigate()
  const contractAddress = getLoreumNftAddress(chainId)!

  const metaResult = useTokenMetadata(tokenId)
  const meta = metaResult.data
  const tokenUri = metaResult.tokenUri

  // ENS name for owner (ENS lives on mainnet)
  const { data: ensName } = useEnsName({
    address: owner,
    chainId: mainnet.id,
  })

  // Image URL
  const imageSrc = meta.image ? ipfsToGatewayUrl(meta.image) : null

  // Etherscan URL
  const etherscanBase = chainId === sepolia.id
    ? 'https://sepolia.etherscan.io'
    : 'https://etherscan.io'
  const etherscanTokenUrl = `${etherscanBase}/token/${contractAddress}?a=${tokenId}`

  // Owner display
  const ownerDisplay = owner
    ? ensName ?? truncateAddress(owner)
    : '—'

  // Prev/next navigation
  const hasPrev = tokenId > 1n
  const hasNext = totalSupply !== undefined && tokenId < totalSupply

  const displayName = meta.status === 'resolved' && meta.name
    ? meta.name
    : `Explorer #${tokenId.toString()}`

  // Filter valid attributes
  const validAttributes = meta.status === 'resolved' && meta.attributes
    ? meta.attributes.filter((a) => a.trait_type !== undefined && a.value !== undefined && a.value !== null)
    : []

  return (
    <div className="space-y-8">
      {/* Breadcrumb nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/gallery"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← My Explorers
        </Link>

        {/* Prev/Next */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && navigate(`/token/${(tokenId - 1n).toString()}`)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-accent-500/30 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
            aria-label="Previous token"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="font-mono text-xs text-slate-500 tabular-nums min-w-[3ch] text-center">
            #{tokenId.toString()}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && navigate(`/token/${(tokenId + 1n).toString()}`)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-accent-500/30 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
            aria-label="Next token"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        {/* ── Left: large art ──────────────────────────────────── */}
        <div className="animate-fade-up">
          <ArtFrame
            src={imageSrc}
            alt={displayName}
            aspect="square"
            eager
            className="shadow-glow"
          >
            {meta.status === 'loading' && (
              <div aria-hidden className="shimmer absolute inset-0 bg-slate-800/50" />
            )}
          </ArtFrame>
        </div>

        {/* ── Right: detail column ─────────────────────────────── */}
        <div className="animate-fade-up [animation-delay:80ms] space-y-6">
          {/* Name + ID */}
          <div>
            <div className="eyebrow mb-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Loreum DAO membership
            </div>
            <h1 className="font-display text-display-sm font-semibold text-slate-50">
              {meta.status === 'loading' ? (
                <span className="shimmer inline-block h-[1em] w-[8ch] rounded-lg bg-slate-800/60 align-middle" />
              ) : (
                <span className="display-gradient">{displayName}</span>
              )}
            </h1>
            <span className="chip mt-3 font-mono text-[11px]">
              #{tokenId.toString()}
            </span>
          </div>

          {/* ── Traits — the hero of this column ─────────────── */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-eyebrow text-slate-500 mb-3">
              Attributes
            </h2>
            {meta.status === 'loading' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <Skeleton className="h-3 w-12 mb-1.5" />
                    <Skeleton className="h-4 w-16" />
                  </div>
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
            ) : validAttributes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {validAttributes.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-accent-600/15 bg-accent-600/[0.04] p-3 transition-colors hover:border-accent-500/25"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-400/80">
                      {String(a.trait_type)}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-100">
                      {String(a.value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No attributes recorded.</p>
            )}
          </div>

          {/* ── Owner ────────────────────────────────────────── */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-eyebrow text-slate-500 mb-2">
              Owner
            </h2>
            <div className="font-mono text-sm text-slate-100 break-all">
              {ownerDisplay}
            </div>
            {owner && ensName && (
              <div className="font-mono text-xs text-slate-500 mt-0.5 break-all">
                {truncateAddress(owner)}
              </div>
            )}
          </div>

          {/* ── Provenance / Links ───────────────────────────── */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-eyebrow text-slate-500 mb-3">
              Provenance
            </h2>
            <div className="space-y-2">
              <a
                href={etherscanTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent-300 hover:text-accent-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                View on Etherscan
              </a>
              {tokenUri && (
                <a
                  href={tokenUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Raw token URI
                </a>
              )}
              {contractAddress && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <span className="font-mono">
                    Contract: {truncateAddress(contractAddress)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Two-column skeleton for loading state. */
function DetailSkeleton({ tokenId }: { tokenId: bigint }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/gallery"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← My Explorers
        </Link>
        <span className="font-mono text-xs text-slate-500">#{tokenId.toString()}</span>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <ArtFrame aspect="square" className="shadow-glow">
          <div aria-hidden className="shimmer absolute inset-0 bg-slate-800/50" />
        </ArtFrame>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-10 w-48 mb-3" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="glass p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <Skeleton className="h-3 w-12 mb-1.5" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
          <div className="glass p-5">
            <Skeleton className="h-3 w-12 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="glass p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
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
