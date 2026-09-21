import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { formatEther } from 'viem'
import { mainnet, sepolia } from '@/wagmi'
import { useCollection, useMyAllowance, useClaim } from '@/hooks'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { ipfsToGatewayUrl } from '@/lib/ipfs'
import {
  ArtFrame,
  HeroBackground,
  ProgressBar,
  Stepper,
  Callout,
  Skeleton,
  StatTile,
  StatRow,
  Button,
} from '@/components/ui'

/**
 * /claim — premium mint experience (#309).
 *
 * Two-column hero: left = featured art + collection identity + supply;
 * right = glass mint widget with Stepper, total, primary CTA, and all 12
 * state panels rendered as designed states (never toasts).
 *
 * All data-layer hooks (useCollection, useMyAllowance, useClaim) are reused
 * unchanged — no contract reads are modified.
 */
export function Claim() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain } = useSwitchChain()

  const { data: collection, isLoading: collectionLoading } = useCollection()
  const { data: allowance, isLoading: allowanceLoading } = useMyAllowance()
  const {
    hash,
    claim,
    claimError,
    isPending: writePending,
    isConfirming,
    isSuccess,
  } = useClaim()

  const [quantity, setQuantity] = useState(1)
  const [lastMintCost, setLastMintCost] = useState<bigint | undefined>(undefined)
  const [priceChanged, setPriceChanged] = useState(false)
  const [claimedTokenIds, setClaimedTokenIds] = useState<bigint[]>([])

  // Track mintCost changes for price-changed detection
  useEffect(() => {
    if (collection.mintCost !== undefined) {
      if (lastMintCost !== undefined && lastMintCost !== collection.mintCost) {
        setPriceChanged(true)
      }
      setLastMintCost(collection.mintCost)
    }
  }, [collection.mintCost, lastMintCost])

  const dismissPriceChanged = useCallback(() => {
    setPriceChanged(false)
  }, [])

  // Clamp quantity to claimable when it changes
  const claimable = allowance.claimable !== undefined ? Number(allowance.claimable) : 0
  useEffect(() => {
    if (claimable > 0 && quantity > claimable) {
      setQuantity(claimable)
    }
  }, [claimable, quantity])

  // Extract new token IDs from confirmed tx
  useEffect(() => {
    if (isSuccess && hash) {
      const prevSupply = collection.totalSupply
      if (prevSupply !== undefined) {
        const newIds = Array.from({ length: quantity }, (_, i) => prevSupply + BigInt(i) + 1n)
        setClaimedTokenIds(newIds)
      }
    }
  }, [isSuccess, hash, quantity, collection.totalSupply])

  // Compute total cost
  const mintCost = collection.mintCost ?? 0n
  const totalCost = mintCost * BigInt(quantity)
  const totalCostEth = formatEther(totalCost)

  // Explorer URL for tx hash
  const isSepolia = chainId === sepolia.id
  const explorerBase = isSepolia ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'
  const explorerTxUrl = hash ? `${explorerBase}/tx/${hash}` : undefined

  // Network state
  const isWrongNetwork = isConnected && chainId !== mainnet.id && chainId !== sepolia.id
  const isOnTestNetwork = chainId === sepolia.id

  // Loading state
  const isLoading = collectionLoading || (isConnected && allowanceLoading)

  // Derive the current state
  type PageState =
    | 'disconnected'
    | 'wrong_network'
    | 'loading'
    | 'eligible'
    | 'wallet_limit'
    | 'sold_out'
    | 'pending'
    | 'confirming'
    | 'confirmed'
    | 'rejected'
    | 'failed'
    | 'price_changed'

  let pageState: PageState

  if (!isConnected) {
    pageState = 'disconnected'
  } else if (isWrongNetwork) {
    pageState = 'wrong_network'
  } else if (isSuccess && claimedTokenIds.length > 0) {
    pageState = 'confirmed'
  } else if (isConfirming) {
    pageState = 'confirming'
  } else if (writePending) {
    pageState = 'pending'
  } else if (priceChanged) {
    pageState = 'price_changed'
  } else if (claimError) {
    if (claimError === 'user_rejected') {
      pageState = 'rejected'
    } else {
      pageState = 'failed'
    }
  } else if (isLoading) {
    pageState = 'loading'
  } else if (allowance.reason === 'sold_out') {
    pageState = 'sold_out'
  } else if (allowance.reason === 'wallet_limit') {
    pageState = 'wallet_limit'
  } else {
    pageState = 'eligible'
  }

  // Remaining supply
  const remaining =
    collection.totalSupply !== undefined && collection.maxSupply !== undefined
      ? Number(collection.maxSupply - collection.totalSupply)
      : undefined

  const mintedLabel =
    collection.totalSupply !== undefined && collection.maxSupply !== undefined
      ? `${Number(collection.totalSupply).toLocaleString()} / ${Number(collection.maxSupply).toLocaleString()}`
      : undefined

  const handleClaim = async () => {
    try {
      await claim(quantity)
    } catch {
      // Error is captured in claimError state
    }
  }

  const handleTryAgain = () => {
    // Quantity is preserved; user just clicks Claim again
  }

  // Featured token for art preview (latest minted)
  const featuredTokenId =
    collection.totalSupply !== undefined && collection.totalSupply > 0n
      ? collection.totalSupply
      : undefined

  // Is the mint widget "active" (user can interact)?
  const isActionable = pageState === 'eligible' || pageState === 'price_changed'

  return (
    <div className="space-y-16">
      {/* ── Hero: art + mint widget ─────────────────────────────── */}
      <section className="bleed relative -mt-8 overflow-hidden pb-4 pt-8">
        <HeroBackground />
        <div className="relative mx-auto grid max-w-7xl items-start gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-16">
          {/* ── Left: art + collection identity ─────────────────── */}
          <div className="animate-fade-up">
            <div className="eyebrow mb-5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isOnTestNetwork ? 'Sepolia test network' : 'On-chain collection · Ethereum'}
            </div>

            <h1 className="font-display text-display-sm font-semibold text-slate-50 sm:text-display">
              {collection.name ? (
                <span className="display-gradient">{collection.name}</span>
              ) : (
                <span className="shimmer inline-block h-[1em] w-[7ch] rounded-lg bg-slate-800/60 align-middle" />
              )}
            </h1>

            {collection.symbol && (
              <span className="chip mt-3 font-mono text-[11px]">${collection.symbol}</span>
            )}

            {/* Art preview */}
            <div className="mt-8">
              {collectionLoading || collection.totalSupply === undefined ? (
                <ArtFrame aspect="square" className="shadow-glow max-w-md">
                  <div aria-hidden className="shimmer absolute inset-0 bg-slate-800/50" />
                </ArtFrame>
              ) : featuredTokenId !== undefined ? (
                <ClaimHeroArt tokenId={featuredTokenId} />
              ) : (
                <ArtFrame aspect="square" className="shadow-glow max-w-md">
                  <div className="absolute inset-0 bg-aurora opacity-80" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                    <span className="font-display text-2xl font-semibold text-white">
                      No Explorers yet
                    </span>
                    <span className="text-sm text-slate-300">Be the first to claim one.</span>
                  </div>
                </ArtFrame>
              )}
            </div>

            {/* Supply progress + stats */}
            <div className="mt-8 max-w-md space-y-4">
              {collection.totalSupply !== undefined && collection.maxSupply !== undefined ? (
                <ProgressBar
                  value={Number(collection.totalSupply)}
                  max={Number(collection.maxSupply)}
                  metaLeft={`${collection.totalSupply.toString()} of ${collection.maxSupply.toString()} minted`}
                  metaRight={remaining !== undefined ? `${remaining} left` : undefined}
                />
              ) : (
                <Skeleton className="h-8 w-full rounded-lg" />
              )}

              <StatRow className="max-w-sm">
                <StatTile
                  label="Mint price"
                  value={collection.mintCost !== undefined ? `${formatEther(collection.mintCost)} ETH` : undefined}
                  loading={collectionLoading || collection.mintCost === undefined}
                />
                <StatTile
                  label="Minted"
                  value={mintedLabel}
                  loading={collectionLoading || mintedLabel === undefined}
                />
              </StatRow>
            </div>
          </div>

          {/* ── Right: mint widget ──────────────────────────────── */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="glass sticky top-24 p-6 sm:p-8">
              <h2 className="font-display text-xl font-semibold text-slate-100">
                Claim an Explorer
              </h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Mint directly from the contract. Your Explorer is yours the moment the transaction confirms.
              </p>

              {/* Holder banner — connected holders with existing tokens */}
              {isConnected && allowance.balance !== undefined && allowance.balance > 0n && (
                <div className="mt-5 rounded-lg border border-accent-700/25 bg-accent-950/30 px-3.5 py-2.5 text-[13px] text-slate-300">
                  You hold {allowance.balance.toString()} Explorer{allowance.balance > 1n ? 's' : ''}.{' '}
                  <Link to="/gallery" className="text-accent-300 underline underline-offset-2 hover:text-accent-200">
                    View in gallery →
                  </Link>
                </div>
              )}

              {/* ── State panels ─────────────────────────────── */}
              <div className="mt-6 space-y-5">
                {/* Disconnected */}
                {pageState === 'disconnected' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      Connect your wallet to claim Loreum Explorers.
                    </p>
                    <Button size="lg" onClick={openConnectModal} className="w-full">
                      Connect Wallet
                    </Button>
                  </div>
                )}

                {/* Wrong network */}
                {pageState === 'wrong_network' && (
                  <Callout variant="warn" title="Wrong network">
                    <span>
                      Explorers are on Ethereum. Switch your wallet to continue.
                    </span>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => switchChain({ chainId: mainnet.id })}>
                        Switch to Ethereum
                      </Button>
                    </div>
                  </Callout>
                )}

                {/* Loading */}
                {pageState === 'loading' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-40" />
                    </div>
                    <Skeleton className="h-12 w-full" />
                    <Button size="lg" disabled className="w-full">
                      Claim
                    </Button>
                  </div>
                )}

                {/* Eligible — the primary interaction state */}
                {pageState === 'eligible' && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Quantity
                        </label>
                        <Stepper
                          value={quantity}
                          onChange={setQuantity}
                          min={1}
                          max={claimable > 0 ? claimable : 1}
                          ariaLabel="Claim quantity"
                        />
                        {remaining !== undefined && quantity >= remaining && (
                          <p className="mt-1.5 text-xs text-amber-400">
                            Only {remaining} remaining in collection
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-slate-500">
                          Total
                        </div>
                        <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-slate-100">
                          {totalCostEth} ETH
                        </div>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      onClick={handleClaim}
                      className="w-full"
                      disabled={!isActionable}
                    >
                      Claim {quantity} Explorer{quantity > 1 ? 's' : ''}
                    </Button>
                  </div>
                )}

                {/* Wallet limit */}
                {pageState === 'wallet_limit' && (
                  <Callout variant="info" title="Mint limit reached" live={false}>
                    <span>
                      You've used all {collection.maxMint?.toString() ?? '100'} lifetime mints for this wallet.
                      Tokens you transferred away still count.
                    </span>
                    <div className="mt-3">
                      <Link
                        to="/gallery"
                        className="inline-flex items-center gap-1 text-sm text-accent-300 underline underline-offset-2 hover:text-accent-200"
                      >
                        View your Explorers in gallery →
                      </Link>
                    </div>
                  </Callout>
                )}

                {/* Sold out */}
                {pageState === 'sold_out' && (
                  <Callout variant="info" title="Sold out" live={false}>
                    <span>
                      All {collection.totalSupply?.toString()} Explorers have been minted.
                    </span>
                    <div className="mt-3">
                      <Link
                        to="/gallery"
                        className="inline-flex items-center gap-1 text-sm text-accent-300 underline underline-offset-2 hover:text-accent-200"
                      >
                        Browse the gallery →
                      </Link>
                    </div>
                  </Callout>
                )}

                {/* Pending */}
                {pageState === 'pending' && (
                  <Callout variant="warn" title="Transaction pending">
                    <span>Confirm the transaction in your wallet.</span>
                    {explorerTxUrl && (
                      <div className="mt-2">
                        <a
                          href={explorerTxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent-300 underline underline-offset-2 hover:text-accent-200 break-all"
                        >
                          View on Etherscan →
                        </a>
                      </div>
                    )}
                  </Callout>
                )}

                {/* Confirming */}
                {pageState === 'confirming' && (
                  <Callout variant="warn" title="Waiting for confirmation">
                    <span>Your transaction is being confirmed on-chain…</span>
                    {explorerTxUrl && (
                      <div className="mt-2">
                        <a
                          href={explorerTxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent-300 underline underline-offset-2 hover:text-accent-200 break-all"
                        >
                          View on Etherscan →
                        </a>
                      </div>
                    )}
                  </Callout>
                )}

                {/* Confirmed */}
                {pageState === 'confirmed' && (
                  <Callout variant="ok" title="Claim successful!">
                    <span>
                      You claimed {quantity} Explorer{quantity > 1 ? 's' : ''}
                      {claimedTokenIds.length > 0 && (
                        <> (Token{claimedTokenIds.length > 1 ? 's' : ''} #{claimedTokenIds.map(id => id.toString()).join(', ')})</>
                      )}
                      . They appear in your gallery without refreshing.
                    </span>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Link
                        to="/gallery"
                        className="inline-flex items-center gap-1 text-sm font-medium text-accent-300 underline underline-offset-2 hover:text-accent-200"
                      >
                        View my Explorers →
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClaimedTokenIds([])
                          setQuantity(1)
                        }}
                      >
                        Claim more
                      </Button>
                    </div>
                  </Callout>
                )}

                {/* Rejected */}
                {pageState === 'rejected' && (
                  <Callout variant="bad" title="Transaction rejected">
                    <span>
                      You rejected the transaction. Your quantity selection is preserved.
                    </span>
                    <div className="mt-3">
                      <Button size="sm" onClick={handleTryAgain}>
                        Try again
                      </Button>
                    </div>
                  </Callout>
                )}

                {/* Failed */}
                {pageState === 'failed' && (
                  <Callout variant="bad" title="Transaction failed">
                    <span>
                      The transaction failed. Your quantity selection is preserved — you can try again.
                    </span>
                    <div className="mt-3">
                      <Button size="sm" onClick={handleTryAgain}>
                        Try again
                      </Button>
                    </div>
                  </Callout>
                )}

                {/* Price changed */}
                {pageState === 'price_changed' && (
                  <Callout variant="warn" title="Price updated">
                    <span>
                      The price changed to {formatEther(mintCost)} ETH. Your new total is {totalCostEth} ETH.
                    </span>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button size="sm" onClick={handleClaim}>
                        Confirm new price
                      </Button>
                      <Button variant="ghost" size="sm" onClick={dismissPriceChanged}>
                        Dismiss
                      </Button>
                    </div>
                  </Callout>
                )}
              </div>

              {/* Footer note — contract trust signal */}
              <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-500">
                Calls the {collection.name ?? 'LoreumNFT'} contract directly.{' '}
                {collection.maxMint !== undefined && collection.maxMint > 0n && (
                  <>Max {collection.maxMint.toString()} mints per wallet. </>
                )}
                Art and metadata stored on IPFS.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Featured art for the claim hero — latest minted token. */
function ClaimHeroArt({ tokenId }: { tokenId: bigint }) {
  const { data } = useTokenMetadata(tokenId)
  const image = data.image ? ipfsToGatewayUrl(data.image) : null
  return (
    <ArtFrame
      src={image}
      alt={data.name ?? `Explorer #${tokenId}`}
      aspect="square"
      eager
      className="shadow-glow max-w-md"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        <div className="font-display text-lg font-semibold text-white">
          {data.name ?? `Explorer #${tokenId.toString()}`}
        </div>
        <div className="font-mono text-xs text-slate-300">#{tokenId.toString()}</div>
      </div>
    </ArtFrame>
  )
}
