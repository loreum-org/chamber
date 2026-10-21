import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAccount, useChainId, useReadContracts, useSwitchChain } from 'wagmi'
import { isAddress } from 'viem'
import { useChainModal, useConnectModal } from '@rainbow-me/rainbowkit'
import { FiAlertTriangle, FiLoader, FiRefreshCw } from 'react-icons/fi'
import { useHasValidConfig, useMyChambers, useOrganizationsByNFT } from '@/hooks'
import { erc721Abi } from '@/contracts'
import { getNetworkName, getPreferredSupportedChainId, isMainnetConfigured } from '@/lib/wagmi'
import {
  readSimulatedChainId,
  showMainnetUnsupportedBanner,
  switchToSupportedChainLabel,
} from '@/lib/supportedChain'
import ChamberCard from '@/components/ChamberCard'
import { Banner, EmptyState, PageHeader, Segmented } from '@/components/ui'
import { shortenAddress } from '@/lib/utils'

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]'

export default function Dashboard() {
  const { isConnected } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()
  const chainId = useChainId()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const { openChainModal } = useChainModal()
  const { openConnectModal } = useConnectModal()
  const [viewMode, setViewMode] = useState<'mine' | 'organizations'>('mine')
  const [openAddress, setOpenAddress] = useState('')
  const [openError, setOpenError] = useState<string | null>(null)
  const preferredChainId = getPreferredSupportedChainId()
  const bannerChainId = readSimulatedChainId(location.search, import.meta.env.DEV) ?? chainId
  const showUnsupportedMainnet = showMainnetUnsupportedBanner(bannerChainId, isMainnetConfigured)
  const switchLabel = switchToSupportedChainLabel(preferredChainId)

  const {
    chambers: myChambers,
    isLoading,
    refetch: refetchMine,
    error: chambersError,
    discoveryIncomplete,
    recents,
    remember,
    factoryAddress,
    registryAddress,
  } = useMyChambers()
  const myAddresses = myChambers.map((entry) => entry.address)
  const { organizations, isLoading: orgsLoading } = useOrganizationsByNFT(myAddresses)
  const { isValid } = useHasValidConfig()

  useEffect(() => {
    if (location.pathname === '/') {
      refetchMine()
    }
  }, [location.pathname, refetchMine])

  const handleSwitchToSupportedChain = async () => {
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (preferredChainId && switchChainAsync) {
      try {
        await switchChainAsync({ chainId: preferredChainId })
        return
      } catch {
        openChainModal?.()
        return
      }
    }
    if (openChainModal) {
      openChainModal()
      return
    }
    openConnectModal?.()
  }

  const handleOpenAddress = (e: React.FormEvent) => {
    e.preventDefault()
    const value = openAddress.trim()
    if (!isAddress(value)) {
      setOpenError('Enter a valid chamber address')
      return
    }
    setOpenError(null)
    remember(value)
    navigate(`/chamber/${value}`)
  }

  return (
    <div className="space-y-6">
      {showUnsupportedMainnet && (
        <Banner
          tone="info"
          actions={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleSwitchToSupportedChain()}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <FiLoader className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <FiRefreshCw className="w-3.5 h-3.5" aria-hidden />
              )}
              {isSwitching ? 'Switching…' : switchLabel}
            </button>
          }
        >
          This deployment does not include Ethereum mainnet. Switch your wallet to Sepolia or another supported
          network.
        </Banner>
      )}

      {!isValid && !showUnsupportedMainnet && (
        <Banner tone="warn" title="Contract addresses not configured" icon={<FiAlertTriangle className="w-4 h-4 text-amber-400" aria-hidden />}>
          No Factory or Registry address is configured for {getNetworkName(chainId)} (chain {chainId}).
          {chainId === 31337 ? (
            <>
              {' '}Deploy contracts to Anvil and set <code className="font-mono">VITE_LOCALHOST_FACTORY</code> (or{' '}
              <code className="font-mono">VITE_LOCALHOST_REGISTRY</code>) in <code className="font-mono">.env</code>.
            </>
          ) : (
            <>
              {' '}Set <code className="font-mono">VITE_*_FACTORY</code> or <code className="font-mono">VITE_*_REGISTRY</code>{' '}
              in <code className="font-mono">.env</code>.
            </>
          )}
        </Banner>
      )}

      {import.meta.env.DEV && (chambersError || !isValid) && (
        <div className="panel p-3 text-xs font-mono text-slate-500 space-y-0.5">
          <div>chain {chainId} ({getNetworkName(chainId)})</div>
          <div>factory {factoryAddress || 'not set'}</div>
          <div>registry {registryAddress || 'not set'}</div>
          <div>config valid {isValid ? 'yes' : 'no'}</div>
          {chambersError && <div className="text-red-400">my chambers error: {chambersError.message}</div>}
          <div>my chambers {myChambers.length}</div>
        </div>
      )}

      <PageHeader
        title="My chambers"
        description="Chambers you created, direct, or hold shares in."
        actions={
          <Link to="/deploy" className="btn btn-primary" data-umami-event="cta-create-chamber">
            Deploy chamber
          </Link>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented
          ariaLabel="Chamber list"
          items={[
            { id: 'mine', label: 'Mine' },
            { id: 'organizations', label: 'Organizations' },
          ]}
          active={viewMode}
          onChange={setViewMode}
        />

        <form id="open-chamber-address" onSubmit={handleOpenAddress} className="flex items-start gap-2 md:w-[420px]">
          <div className="flex-1 min-w-0">
            <label htmlFor="open-chamber-address-input" className="sr-only">
              Open chamber by address
            </label>
            <input
              id="open-chamber-address-input"
              type="text"
              placeholder="Open by address: 0x…"
              className="input font-mono"
              value={openAddress}
              onChange={(e) => {
                setOpenAddress(e.target.value)
                if (openError) setOpenError(null)
              }}
            />
            {openError && <p className="text-red-400 text-xs mt-1.5">{openError}</p>}
          </div>
          <button type="submit" className="btn btn-secondary shrink-0">
            Open
          </button>
        </form>
      </div>

      {recents.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>Recent</span>
          {recents.map((addr) => (
            <Link key={addr} to={`/chamber/${addr}`} className="font-mono text-slate-400 hover:text-slate-100 transition-colors">
              {shortenAddress(addr, 6)}
            </Link>
          ))}
        </p>
      )}

      {isConnected && discoveryIncomplete && (
        <Banner tone="warn" title="This list may be incomplete" icon={<FiAlertTriangle className="w-4 h-4 text-amber-400" aria-hidden />}>
          Chamber lookup failed for part of the network. Open a chamber by address above, or pick one from Recent.
        </Banner>
      )}

      {viewMode === 'mine' ? (
        !isConnected ? (
          <EmptyChambers disconnected />
        ) : isLoading ? (
          <div className={GRID}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-surface-3 rounded w-1/3 mb-3" />
                <div className="h-3 bg-surface-3 rounded w-1/2 mb-5" />
                <div className="h-3 bg-surface-3 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : myChambers.length > 0 ? (
          <div className={GRID}>
            {myChambers.map((entry) => (
              <ChamberCard key={entry.address} address={entry.address} />
            ))}
          </div>
        ) : (
          <EmptyChambers />
        )
      ) : !isConnected ? (
        <EmptyChambers disconnected />
      ) : orgsLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 bg-surface-3 rounded w-48 animate-pulse" />
              <div className={GRID}>
                {[1, 2].map((j) => (
                  <div key={j} className="card h-28 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : organizations && organizations.length > 0 ? (
        <div className="space-y-8">
          {organizations.map((org) => (
            <OrganizationGroup key={org.nft} nftToken={org.nft} chambers={org.chambers} />
          ))}
        </div>
      ) : (
        <EmptyChambers />
      )}
    </div>
  )
}

function OrganizationGroup({ nftToken, chambers }: { nftToken: `0x${string}`; chambers: `0x${string}`[] }) {
  const { data } = useReadContracts({
    contracts: [
      { address: nftToken, abi: erc721Abi, functionName: 'symbol' as const },
      { address: nftToken, abi: erc721Abi, functionName: 'name' as const },
    ],
  })

  const nftSymbol = data?.[0]?.result as string | undefined
  const nftName = data?.[1]?.result as string | undefined

  if (!chambers || chambers.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="section-title">{nftName || 'Loading…'}</h2>
        {nftSymbol && <span className="text-slate-500 text-sm">{nftSymbol}</span>}
        <span className="font-mono text-xs text-slate-500">membership {shortenAddress(nftToken, 6)}</span>
      </div>
      <div className={GRID}>
        {chambers.map((address) => (
          <ChamberCard key={address} address={address} />
        ))}
      </div>
    </section>
  )
}

function EmptyChambers({ disconnected = false }: { disconnected?: boolean }) {
  return (
    <EmptyState
      title={disconnected ? 'Connect to see your chambers' : 'No chambers yet'}
      description={
        disconnected
          ? 'Connect a wallet to list chambers you created, direct, or hold. You can also open one by address.'
          : 'Deploy a chamber, or open one by address if it is not in this wallet’s list yet.'
      }
      action={
        <Link to="/deploy" className="btn btn-primary" data-umami-event="cta-create-chamber">
          Deploy a chamber
        </Link>
      }
    />
  )
}
