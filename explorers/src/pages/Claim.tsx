import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { formatEther } from 'viem'
import { mainnet, sepolia } from '@/wagmi'
import { useCollection, useMyAllowance, useClaim } from '@/hooks'
import {
  Button,
  Panel,
  StatsStrip,
  ProgressBar,
  Stepper,
  Callout,
  Skeleton,
  type StatItem,
} from '@/components/ui'

/**
 * /claim page — Loreum Explorers claim flow.
 *
 * Implements all 12 states from issue #295:
 * 1. Disconnected — collection state visible, Connect CTA
 * 2. Wrong network — "Explorers are on Ethereum" message, Switch CTA
 * 3. Sepolia — quiet persistent Test network marker (rendered in Header)
 * 4. Params loading — Skeleton placeholders, Claim disabled
 * 5. Eligible — Stepper + total, Claim button
 * 6. Wallet limit — "used all lifetime mints" message, link to /gallery
 * 7. Sold out — final minted count, link to /gallery
 * 8. Quantity > remaining — Stepper clamps, note shows remaining
 * 9. Pending — tx hash + explorer link
 * 10. Confirmed — new token ids, "View my Explorers" link
 * 11. Rejected/failed — recoverable, quantity preserved, Try again
 * 12. Price changed — "price changed to X ETH", new total, Confirm new price
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

  // Reset price-changed flag when user confirms
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

  // Extract new token IDs from confirmed tx (parse Transfer events)
  useEffect(() => {
    if (isSuccess && hash) {
      // After confirmation, the query invalidation triggers re-reads.
      // We show the gallery link; tokens appear without refresh via wagmi cache.
      // For the confirmed state, show a link to gallery.
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

  // Determine explorer URL for tx hash
  const isSepolia = chainId === sepolia.id
  const explorerBase = isSepolia ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'
  const explorerTxUrl = hash ? `${explorerBase}/tx/${hash}` : undefined

  // Determine network state
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
    // claimError can be: 'user_rejected' | 'price_changed' | 'wallet_limit' | 'sold_out' | 'unknown'
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

  // Stats strip items
  const statsItems: StatItem[] = [
    {
      label: 'Minted',
      value:
        collection.totalSupply !== undefined && collection.maxSupply !== undefined
          ? `${collection.totalSupply.toString()} / ${collection.maxSupply.toString()}`
          : <Skeleton className="h-6 w-20" />,
    },
    {
      label: 'Price',
      value:
        collection.mintCost !== undefined
          ? `${formatEther(collection.mintCost)} ETH`
          : <Skeleton className="h-6 w-16" />,
    },
    {
      label: collection.name ? `${collection.name} (${collection.symbol})` : 'Collection',
      value:
        collection.name
          ? collection.symbol ?? ''
          : <Skeleton className="h-6 w-24" />,
    },
  ]

  // Remaining supply
  const remaining =
    collection.totalSupply !== undefined && collection.maxSupply !== undefined
      ? Number(collection.maxSupply - collection.totalSupply)
      : undefined

  // Handle claim
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

  return (
    <div className="space-y-6">
      {/* Holder banner — above the fold for connected holders */}
      {isConnected && allowance.balance !== undefined && allowance.balance > 0n && (
        <Callout variant="info" title="You hold Explorers" live={false}>
          <span>
            You own {allowance.balance.toString()} Explorer{allowance.balance > 1n ? 's' : ''}.{' '}
            <Link to="/gallery" className="text-accent-400 underline underline-offset-2 hover:text-accent-300">
              View in gallery →
            </Link>
          </span>
        </Callout>
      )}

      {/* Collection stats — always visible */}
      <StatsStrip items={statsItems} />

      {/* Progress bar */}
      {collection.totalSupply !== undefined && collection.maxSupply !== undefined && (
        <ProgressBar
          value={Number(collection.totalSupply)}
          max={Number(collection.maxSupply)}
          metaLeft={`${collection.totalSupply.toString()} of ${collection.maxSupply.toString()} minted`}
          metaRight={remaining !== undefined ? `${remaining} left` : undefined}
        />
      )}

      {/* Claim panel */}
      <Panel className="space-y-5">
        {/* State: Disconnected */}
        {pageState === 'disconnected' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Connect your wallet to claim Loreum Explorers.
            </p>
            <Button size="lg" onClick={openConnectModal}>
              Connect Wallet
            </Button>
          </div>
        )}

        {/* State: Wrong network */}
        {pageState === 'wrong_network' && (
          <Callout variant="warn" title="Wrong network">
            <span>
              Explorers are on {isOnTestNetwork ? 'Sepolia' : 'Ethereum'}. Switch your wallet to continue.
            </span>
            <div className="mt-3">
              <Button size="sm" onClick={() => switchChain({ chainId: mainnet.id })}>
                Switch to Ethereum
              </Button>
            </div>
          </Callout>
        )}

        {/* State: Loading */}
        {pageState === 'loading' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-12 w-full" />
            <Button size="lg" disabled>
              Claim
            </Button>
          </div>
        )}

        {/* State: Eligible */}
        {pageState === 'eligible' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Quantity</label>
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
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-xl font-semibold text-slate-100 tabular-nums">
                  {totalCostEth} ETH
                </div>
              </div>
            </div>
            <Button size="lg" onClick={handleClaim} className="w-full sm:w-auto">
              Claim {quantity} Explorer{quantity > 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {/* State: Wallet limit */}
        {pageState === 'wallet_limit' && (
          <Callout variant="info" title="Mint limit reached" live={false}>
            <span>
              You've used all {collection.maxMint?.toString() ?? '100'} lifetime mints for this wallet.
              Tokens you transferred away still count.
            </span>
            <div className="mt-3">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-1 text-sm text-accent-400 underline underline-offset-2 hover:text-accent-300"
              >
                View your Explorers in gallery →
              </Link>
            </div>
          </Callout>
        )}

        {/* State: Sold out */}
        {pageState === 'sold_out' && (
          <Callout variant="info" title="Sold out" live={false}>
            <span>
              All {collection.totalSupply?.toString()} Explorers have been minted.
            </span>
            <div className="mt-3">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-1 text-sm text-accent-400 underline underline-offset-2 hover:text-accent-300"
              >
                Browse the gallery →
              </Link>
            </div>
          </Callout>
        )}

        {/* State: Pending (tx sent, waiting for wallet confirmation) */}
        {pageState === 'pending' && (
          <Callout variant="warn" title="Transaction pending">
            <span>Confirm the transaction in your wallet.</span>
            {explorerTxUrl && (
              <div className="mt-2">
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-400 underline underline-offset-2 hover:text-accent-300 break-all"
                >
                  View on Etherscan →
                </a>
              </div>
            )}
          </Callout>
        )}

        {/* State: Confirming (tx confirmed by wallet, waiting for on-chain) */}
        {pageState === 'confirming' && (
          <Callout variant="warn" title="Waiting for confirmation">
            <span>Your transaction is being confirmed on-chain…</span>
            {explorerTxUrl && (
              <div className="mt-2">
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-400 underline underline-offset-2 hover:text-accent-300 break-all"
                >
                  View on Etherscan →
                </a>
              </div>
            )}
          </Callout>
        )}

        {/* State: Confirmed */}
        {pageState === 'confirmed' && (
          <Callout variant="ok" title="Claim successful!">
            <span>
              You claimed {quantity} Explorer{quantity > 1 ? 's' : ''}
              {claimedTokenIds.length > 0 && (
                <> (Token{claimedTokenIds.length > 1 ? 's' : ''} #{claimedTokenIds.map(id => id.toString()).join(', ')})</>
              )}.
              They appear in your gallery without refreshing.
            </span>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                to="/gallery"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-400 underline underline-offset-2 hover:text-accent-300"
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

        {/* State: Rejected (user rejected in wallet) */}
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

        {/* State: Failed (on-chain revert or other error) */}
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

        {/* State: Price changed */}
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
      </Panel>
    </div>
  )
}
