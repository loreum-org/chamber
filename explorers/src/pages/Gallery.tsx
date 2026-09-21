import { Link } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useMyTokens, useMyAllowance, useTokenMetadata, useCollection } from '@/hooks'
import { ipfsToGatewayUrl } from '@/lib/ipfs'
import { mainnet, sepolia } from '@/wagmi'
import {
  ArtFrame,
  SectionHeading,
  StatTile,
  StatRow,
  Button,
  Callout,
  Skeleton,
  buttonClass,
} from '@/components/ui'

const SUPPORTED_CHAINS = [mainnet.id, sepolia.id] as const

/**
 * /gallery — "My Explorers" collection wall (#310).
 *
 * Wallet-scoped: shows only the connected wallet's tokens. No full-collection
 * enumeration (that would need an indexer). Uses the new design system:
 * ArtFrame cards with hover glow, StatRow holdings summary, SectionHeading.
 *
 * States:
 *  - Disconnected → connect CTA
 *  - Wrong network → switch CTA
 *  - Loading → skeleton wall
 *  - Empty → inviting "no Explorers yet" + Claim CTA
 *  - Populated → responsive grid of ArtFrame cards linking to /token/:id
 */
export function Gallery() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()

  const isWrongNetwork =
    isConnected && !SUPPORTED_CHAINS.includes(chainId as (typeof SUPPORTED_CHAINS)[number])

  // Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Your collection"
          title="My Explorers"
          description="Connect your wallet to view your Loreum Explorer NFTs."
        />
        <div className="glass p-8 text-center">
          <p className="text-slate-400 mb-5">
            Your personal collection of Loreum Explorer NFTs lives on-chain.
            Connect your wallet to see them here.
          </p>
          <Button size="lg" onClick={openConnectModal}>
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  // Wrong network
  if (isWrongNetwork) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Your collection"
          title="My Explorers"
          description="Switch to a supported network to view your Explorers."
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

  // Connected on supported chain
  return <GalleryContent />
}

function GalleryContent() {
  const { data: myTokensData, isLoading: tokensLoading } = useMyTokens()
  const { data: allowanceData } = useMyAllowance()
  const { data: collection } = useCollection()

  const tokens = myTokensData?.tokens
  const claimable = allowanceData?.claimable
  const heldCount = tokens?.length ?? 0

  const claimableNum = claimable !== undefined ? Number(claimable) : 0
  const canClaimMore = claimableNum > 0

  return (
    <div className="space-y-10">
      {/* ── Header + holdings summary ──────────────────────────── */}
      <div>
        <SectionHeading
          eyebrow="Your collection"
          title="My Explorers"
          description="Tokens you hold in this wallet. Each Explorer is minted on-chain with art stored on IPFS."
          action={
            canClaimMore ? (
              <Link to="/claim" className={buttonClass('primary', 'sm', 'px-5')}>
                Claim more
              </Link>
            ) : undefined
          }
        />

        {/* Holdings stats */}
        <div className="mt-6">
          <StatRow className="max-w-md">
            <StatTile
              label="Held"
              value={tokensLoading ? undefined : heldCount.toString()}
              loading={tokensLoading}
            />
            <StatTile
              label="Claimable"
              value={claimable !== undefined ? claimable.toString() : undefined}
              loading={claimable === undefined}
              sub={
                collection.maxMint !== undefined
                  ? `Max ${collection.maxMint.toString()} per wallet`
                  : undefined
              }
            />
          </StatRow>
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────────────── */}
      {tokensLoading && <SkeletonWall />}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!tokensLoading && tokens !== undefined && tokens.length === 0 && (
        <div className="glass p-10 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-accent-600/10 text-accent-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-semibold text-slate-100">
            No Explorers yet
          </h3>
          <p className="mt-2 max-w-sm mx-auto text-sm text-slate-400">
            This wallet doesn't hold any Explorers. Claim your first one — they're minted
            directly from the contract with art on IPFS.
          </p>
          <div className="mt-6">
            <Link to="/claim" className={buttonClass('primary', 'lg', 'px-7')}>
              Claim an Explorer
            </Link>
          </div>
        </div>
      )}

      {/* ── Populated wall ─────────────────────────────────────── */}
      {!tokensLoading && tokens !== undefined && tokens.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tokens.map((tokenId) => (
            <GalleryCard key={tokenId.toString()} tokenId={tokenId} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Gallery card — ArtFrame with hover overlay showing name + id. */
function GalleryCard({ tokenId }: { tokenId: bigint }) {
  const { data: meta } = useTokenMetadata(tokenId)
  const image = meta.image ? ipfsToGatewayUrl(meta.image) : null
  const displayName = meta.status === 'resolved' && meta.name
    ? meta.name
    : `Explorer #${tokenId.toString()}`

  return (
    <Link
      to={`/token/${tokenId.toString()}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
    >
      <ArtFrame src={image} alt={displayName} aspect="square" hover>
        {/* Hover overlay — name + id */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="truncate text-sm font-semibold text-white">
            {displayName}
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            #{tokenId.toString()}
          </span>
        </div>

        {/* Trait hint — only when resolved, max 2 traits */}
        {meta.status === 'resolved' && meta.attributes !== undefined && meta.attributes.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1 p-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {meta.attributes
              .filter((a) => a.trait_type !== undefined && a.value !== undefined && a.value !== null)
              .slice(0, 2)
              .map((a) => (
                <span
                  key={String(a.trait_type)}
                  className="rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] text-slate-200"
                >
                  {String(a.trait_type)} · {String(a.value)}
                </span>
              ))}
          </div>
        )}
      </ArtFrame>

      {/* Card footer — always visible */}
      <div className="mt-2 px-0.5">
        <div className="truncate text-sm font-medium text-slate-200 group-hover:text-slate-100">
          {displayName}
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          #{tokenId.toString()}
        </div>
      </div>
    </Link>
  )
}

/** Skeleton wall — 8 placeholder cards matching the grid layout. */
function SkeletonWall() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <ArtFrame aspect="square">
            <div aria-hidden className="shimmer absolute inset-0 bg-slate-800/50" />
          </ArtFrame>
          <div className="mt-2 space-y-1.5 px-0.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
