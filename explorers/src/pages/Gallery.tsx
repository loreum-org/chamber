import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Link } from 'react-router-dom'
import { mainnet, sepolia } from '@/wagmi'
import { useMyTokens, useTokenMetadata, useMyAllowance } from '@/hooks'
import { Button, Panel, TokenCard, Skeleton, Callout } from '@/components/ui'
import type { TokenTrait } from '@/components/ui'
import { ipfsToGatewayUrl } from '@/lib/ipfs'

const SUPPORTED_CHAINS = [mainnet.id, sepolia.id] as const

/**
 * Gallery page — the connected wallet's own Explorers.
 * Route: /gallery. Nav label: "My Explorers".
 *
 * States:
 *  - Disconnected → short explanation + Connect
 *  - Wrong network → named state + Switch
 *  - Loading → Skeleton cards
 *  - Empty → "No Explorers in this wallet yet." + Claim one
 *  - Metadata unresolved → Card with token id; traits pending; Retry
 *  - After a claim → new tokens appear without manual refresh (wagmi invalidation)
 */
export function Gallery() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()

  const isWrongNetwork = isConnected && !SUPPORTED_CHAINS.includes(chainId as typeof SUPPORTED_CHAINS[number])

  // Disconnected state
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <GalleryHeader disconnected />
        <Callout variant="info" title="Connect your wallet">
          Connect your wallet to view your Loreum Explorers and manage your tokens.
        </Callout>
        <Button onClick={openConnectModal}>Connect Wallet</Button>
      </div>
    )
  }

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <div className="space-y-6">
        <GalleryHeader disconnected />
        <Callout variant="warn" title="Unsupported network">
          Switch to Ethereum mainnet or Sepolia to view your Explorers.
        </Callout>
        <Button onClick={() => switchChain?.({ chainId: mainnet.id })}>
          Switch to Mainnet
        </Button>
      </div>
    )
  }

  // Connected on supported chain
  return (
    <div className="space-y-6">
      <GalleryContent />
    </div>
  )
}

function GalleryHeader({ disconnected = false }: { disconnected?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-slate-100">
          My Explorers
        </h1>
        {disconnected && (
          <p className="text-sm text-slate-400 mt-1">
            Your personal collection of Loreum Explorer NFTs.
          </p>
        )}
      </div>
      <Link to="/" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to home
      </Link>
    </div>
  )
}

function GalleryContent() {
  const { data: myTokensData, isLoading: tokensLoading } = useMyTokens()
  const { data: allowanceData } = useMyAllowance()
  const tokens = myTokensData?.tokens
  const claimable = allowanceData?.claimable

  const heldCount = tokens?.length ?? 0

  return (
    <>
      <GalleryHeader />

      {/* Stats header */}
      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <span className="text-sm text-slate-400">Held</span>
          <span className="ml-2 font-semibold text-slate-100">
            {tokensLoading ? '—' : heldCount}
          </span>
        </div>
        <div>
          <span className="text-sm text-slate-400">Remaining claim</span>
          <span className="ml-2 font-semibold text-slate-100">
            {claimable !== undefined ? claimable.toString() : '—'}
          </span>
        </div>
        {claimable !== undefined && claimable > 0n && (
          <Link
            to="/"
            className="ml-auto text-sm text-accent-400 hover:text-accent-300 transition-colors"
          >
            Claim one →
          </Link>
        )}
      </Panel>

      {/* Loading state */}
      {tokensLoading && <SkeletonGrid />}

      {/* Empty state */}
      {!tokensLoading && tokens !== undefined && tokens.length === 0 && (
        <Callout variant="info" title="No Explorers in this wallet yet.">
          <span>Claim your first Explorer to get started. </span>
          <Link to="/" className="text-accent-300 hover:text-accent-200 underline">
            Claim one
          </Link>
        </Callout>
      )}

      {/* Token grid */}
      {!tokensLoading && tokens !== undefined && tokens.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tokens.map((tokenId) => (
            <TokenCardWithMetadata key={tokenId.toString()} tokenId={tokenId} />
          ))}
        </div>
      )}
    </>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden border border-slate-700/40 bg-slate-900/55">
          <Skeleton className="aspect-square" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TokenCardWithMetadata({ tokenId }: { tokenId: bigint }) {
  const { data: meta } = useTokenMetadata(tokenId)

  // Convert ipfs:// image URI to gateway URL for display
  const imageSrc = meta.image
    ? meta.image.startsWith('ipfs://')
      ? ipfsToGatewayUrl(meta.image)
      : meta.image
    : undefined

  // Build traits — only when metadata is resolved and attributes exist.
  // undefined traits (metadata unresolved) → TokenCard shows "Traits loading".
  let traits: TokenTrait[] | undefined
  if (meta.status === 'resolved' && meta.attributes !== undefined) {
    traits = meta.attributes
      .filter((a) => a.trait_type !== undefined && a.value !== undefined && a.value !== null)
      .map((a) => ({
        name: String(a.trait_type),
        value: String(a.value),
      }))
  }
  // When status is 'loading' or 'unresolved', traits stays undefined
  // → TokenCard renders the dashed "Traits loading" chip (never a guessed value)

  const displayName = meta.status === 'resolved' && meta.name
    ? meta.name
    : `Explorer #${tokenId.toString()}`

  return (
    <TokenCard
      name={displayName}
      tokenId={tokenId.toString()}
      image={imageSrc}
      traits={traits}
      href={`/token/${tokenId.toString()}`}
    />
  )
}
