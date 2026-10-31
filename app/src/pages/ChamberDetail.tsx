import { useEffect, useMemo } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAccount, useBalance, useReadContract, useReadContracts, useChainId } from 'wagmi'
import { formatUnits, zeroAddress } from 'viem'
import { erc20Abi } from '@/contracts'
import { chamberAbi } from '@/contracts/abis'
import { FiAlertTriangle, FiCopy, FiExternalLink, FiStar } from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useChamberInfo,
  useChamberBalance,
  useBoardMembers,
  useMembershipTokenOwners,
  useDelegations,
  useSeatUpdate,
  useChambersByAsset,
  useParentChamber,
  useChildChambers,
  useNftImageMap,
  useChamberRegistryImplementationSync,
  useDirectorActionGate,
  useShareDecimals,
} from '@/hooks'
import BoardVisualization from '@/components/BoardVisualization'
import { DirectorCallerStatus } from '@/components/DirectorCallerStatus'
import TreasuryOverview from '@/components/TreasuryOverview'
import DelegationManager from '@/components/DelegationManager'
import SeatTheBoard, { SeatTheBoardLink } from '@/components/SeatTheBoard'
import ChamberAssetsAlchemy from '@/components/ChamberAssetsAlchemy'
import { NftRetryableImage } from '@/components/NftRetryableImage'
import { ChamberRouteGate } from '@/components/ChamberRouteGate'
import { ChamberHeader, type ChamberTab } from '@/components/ChamberHeader'
import { AddressChip, Banner, Section, Stat, StatRow } from '@/components/ui'
import { addRecentChamber } from '@/lib/recentChambers'
import { implMismatchBannerCopy } from '@/lib/implSource'
import { getBlockExplorerAddressUrl, shortenAddress } from '@/lib/utils'
import type { SeatUpdate } from '@/types'

type Tab = Exclude<ChamberTab, 'proposals'>

const validTabs: Tab[] = ['overview', 'board', 'vault', 'delegation']

export default function ChamberDetail() {
  const { address, tab } = useParams<{ address: string; tab?: string }>()
  // The Vault tab used to live at /staking; keep old links working.
  if (address && tab === 'staking') return <Navigate to={`/chamber/${address}/vault`} replace />
  return (
    <ChamberRouteGate address={address}>
      {(chamberAddress) => <ChamberDetailContent chamberAddress={chamberAddress} />}
    </ChamberRouteGate>
  )
}

function formatTokenAmount(value: bigint | undefined, decimals: number, maxFraction = 2): string {
  if (value === undefined) return '…'
  return parseFloat(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: maxFraction })
}

function ChamberDetailContent({ chamberAddress }: { chamberAddress: `0x${string}` }) {
  const { tab } = useParams<{ address: string; tab?: string }>()
  const { address: userAddress } = useAccount()
  const chainId = useChainId()

  useEffect(() => {
    addRecentChamber(chainId, chamberAddress)
  }, [chainId, chamberAddress])

  const activeTab: Tab = tab && validTabs.includes(tab as Tab) ? (tab as Tab) : 'overview'

  const chamberInfo = useChamberInfo(chamberAddress)
  const implSync = useChamberRegistryImplementationSync(chamberAddress)
  const { balance: userBalance } = useChamberBalance(chamberAddress, userAddress)
  const {
    members: boardMembersRaw,
    refetch: refetchBoard,
    isPending: boardMembersPending,
    isFetched: boardMembersFetched,
  } = useBoardMembers(chamberAddress, 20)
  const membershipTokenIds = useMemo(() => boardMembersRaw.map((m) => m.tokenId), [boardMembersRaw])
  const {
    owners: membershipOwners,
    refetch: refetchMembershipOwners,
    isPending: membershipOwnersPending,
  } = useMembershipTokenOwners(chamberInfo.nftToken, membershipTokenIds)
  const members = useMemo(
    () =>
      boardMembersRaw.map((m, i) => ({
        ...m,
        owner: membershipOwners[i],
      })),
    [boardMembersRaw, membershipOwners],
  )
  const { delegations } = useDelegations(chamberAddress, userAddress)
  const directorGate = useDirectorActionGate(chamberAddress, userAddress, chamberInfo.directors, members)
  const transactionIds = useMemo(
    () => Array.from({ length: chamberInfo.transactionCount || 0 }, (_, i) => i),
    [chamberInfo.transactionCount],
  )

  const { data: headerTransactionsData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getTransaction'; args: [bigint] }[],
    query: { enabled: transactionIds.length > 0 },
  })

  const { data: headerCancelledData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getCancelled',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getCancelled'; args: [bigint] }[],
    query: { enabled: transactionIds.length > 0 },
  })

  const queuedTransactionCount = useMemo(() => {
    if (!headerTransactionsData) return 0
    return headerTransactionsData.reduce((count, result, index) => {
      if (result.status !== 'success' || !result.result) return count
      const [executed] = result.result as [boolean, number, `0x${string}`, bigint, `0x${string}`]
      const cancelledResult = headerCancelledData?.[index]
      const cancelled = cancelledResult?.status === 'success' && cancelledResult.result === true
      return !executed && !cancelled ? count + 1 : count
    }, 0)
  }, [headerTransactionsData, headerCancelledData])

  const refreshBoardViews = () => {
    void refetchBoard()
    void refetchMembershipOwners()
  }

  const { data: assetSymbol } = useReadContract({
    address: chamberInfo.assetToken,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: !!chamberInfo.assetToken },
  })

  const { data: ethBalance } = useBalance({ address: chamberAddress })

  const totalDelegated = members.reduce((sum, m) => sum + m.amount, 0n)
  const boardEmpty = boardMembersFetched && !boardMembersPending && members.length === 0

  const chamberImplVersion = chamberInfo.version ?? implSync.chamberVersionLabel ?? undefined
  const chamberVersionTag =
    chamberImplVersion == null || chamberImplVersion === ''
      ? '…'
      : chamberImplVersion.startsWith('v')
        ? chamberImplVersion
        : `v${chamberImplVersion}`

  const upgradeProposalHref = `/chamber/${chamberAddress}/transactions?proposal=upgrade`

  const copyUpgradeProposalLink = () => {
    const url = new URL(upgradeProposalHref, window.location.origin).href
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Upgrade proposal link copied'),
      () => toast.error('Could not copy link'),
    )
  }

  const registryImplementation = implSync.registryImplementation
  const implSourceLabel = implSync.implSourceLabel
  const implBannerCopy = implSourceLabel ? implMismatchBannerCopy(implSourceLabel) : undefined
  const showImplMismatch =
    implSync.implMismatch && !implSync.isLoading && !!registryImplementation && !!implBannerCopy

  const nftForImages =
    chamberInfo.nftToken && chamberInfo.nftToken !== zeroAddress ? (chamberInfo.nftToken as `0x${string}`) : undefined

  return (
    <div className="space-y-6">
      <ChamberHeader
        chamberAddress={chamberAddress}
        chainId={chainId}
        name={chamberInfo.name}
        symbol={chamberInfo.symbol}
        versionTag={chamberVersionTag}
        seats={chamberInfo.seats}
        quorum={chamberInfo.quorum}
        activeTab={activeTab}
        proposalCount={queuedTransactionCount}
        actions={
          <Link to={`/chamber/${chamberAddress}/transactions`} className="btn btn-secondary">
            Open transactions
          </Link>
        }
      >
        <DirectorCallerStatus
          role={directorGate.role}
          tokenId={directorGate.tokenId}
        />
      </ChamberHeader>

      {chamberInfo.paused && (
        <Banner tone="danger" title="Chamber paused" icon={<FiAlertTriangle className="w-4 h-4 text-red-400" aria-hidden />}>
          Deposits, withdrawals, and wallet execute are halted. Directors can still submit and confirm an unpause
          proposal.{' '}
          <Link to="/docs/protocol/governance" className="text-accent-300 hover:text-accent-200 font-semibold">
            How governance works →
          </Link>
        </Banner>
      )}

      {showImplMismatch && registryImplementation && implBannerCopy && (
        <Banner
          tone="warn"
          title={implBannerCopy.title}
          icon={<FiAlertTriangle className="w-4 h-4 text-amber-400" aria-hidden />}
          actions={
            directorGate.canAct ? (
              <Link to={upgradeProposalHref} className="btn btn-primary btn-sm">
                Propose upgrade
              </Link>
            ) : directorGate.seatingPending ? null : (
              <button type="button" onClick={copyUpgradeProposalLink} className="btn btn-secondary btn-sm">
                <FiCopy className="w-3.5 h-3.5" aria-hidden />
                Copy link for a director
              </button>
            )
          }
        >
          <p>
            {implBannerCopy.defaultImplLead}{' '}
            <span className="font-mono tabular-nums">v{implSync.registryImplementationVersionLabel ?? '—'}</span> (
            {shortenAddress(registryImplementation, 6)}). This chamber proxy still uses{' '}
            <span className="font-mono tabular-nums">{chamberVersionTag === '…' ? '—' : chamberVersionTag}</span>.
            Directors can upgrade this proxy via the Chamber’s upgrade flow so it {implBannerCopy.alignClause}.
          </p>
          {directorGate.seatingPending && (
            <p className="mt-1">
              You hold a live board seat, but director actions unlock at block {directorGate.seatedAt?.toString() ?? '…'}.
            </p>
          )}
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/docs/protocol/architecture" className="text-accent-300 hover:text-accent-200 font-semibold">
              How Chamber upgrades work →
            </Link>
            {implSync.registryAddress && chainId !== 31337 && (
              <a
                href={getBlockExplorerAddressUrl(implSync.registryAddress, chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-300 hover:text-accent-200 font-semibold"
              >
                {implBannerCopy.viewLabel} <FiExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
          </p>
        </Banner>
      )}

      {activeTab === 'overview' && (
        <OverviewTab
          chamberAddress={chamberAddress}
          chamberInfo={chamberInfo}
          assetSymbol={assetSymbol as string | undefined}
          ethBalance={ethBalance}
          members={members}
          totalDelegated={totalDelegated}
          userBalance={userBalance}
          boardEmpty={boardEmpty}
          nftForImages={nftForImages}
        />
      )}

      {activeTab === 'board' && (
        <div className="space-y-6">
          <BoardVisualization
            chamberAddress={chamberAddress}
            nftToken={nftForImages}
            members={members}
            seats={chamberInfo.seats || 5}
            totalDelegated={totalDelegated}
            ownersLoading={membershipTokenIds.length > 0 && membershipOwnersPending}
            delegations={delegations}
            boardMembersFetched={boardMembersFetched}
            boardMembersPending={boardMembersPending}
            onRefreshBoard={refreshBoardViews}
          />
          <p className="text-xs text-slate-500">
            Directors act as the membership NFT owner. To let an agent act for a seat, give it a
            session key on the owner wallet (for example a Safe module or smart-account session key).
          </p>
        </div>
      )}

      {activeTab === 'vault' && (
        <TreasuryOverview
          chamberAddress={chamberAddress}
          chamberInfo={chamberInfo}
          userBalance={userBalance}
          totalDelegated={totalDelegated}
        />
      )}

      {activeTab === 'delegation' && (
        <DelegationManager
          chamberAddress={chamberAddress}
          userBalance={userBalance}
          delegations={delegations}
          members={members}
          vaultSymbol={chamberInfo.symbol}
          nftToken={nftForImages}
          seats={chamberInfo.seats}
        />
      )}
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  chamberAddress: `0x${string}`
  chamberInfo: ReturnType<typeof useChamberInfo>
  assetSymbol?: string
  ethBalance?: { value: bigint; decimals: number; symbol: string }
  members: ReturnType<typeof useBoardMembers>['members']
  totalDelegated: bigint
  userBalance: bigint | undefined
  boardEmpty: boolean
  nftForImages?: `0x${string}`
}

function OverviewTab({
  chamberAddress,
  chamberInfo,
  assetSymbol,
  ethBalance,
  members,
  totalDelegated,
  userBalance,
  boardEmpty,
  nftForImages,
}: OverviewTabProps) {
  const chainId = useChainId()
  const shareDecimals = useShareDecimals(chamberAddress)
  const { chambers: relatedChambers } = useChambersByAsset(chamberInfo.assetToken as `0x${string}`)
  const { parentChamber, isLoading: isLoadingParent } = useParentChamber(chamberAddress)
  const { childChambers, isLoading: isLoadingChildren } = useChildChambers(chamberAddress)

  const filteredRelated = relatedChambers?.filter((addr) => addr.toLowerCase() !== chamberAddress.toLowerCase()) || []
  const otherRelated = filteredRelated.filter(
    (addr) =>
      addr.toLowerCase() !== parentChamber?.toLowerCase() &&
      !childChambers?.some((c) => c.toLowerCase() === addr.toLowerCase()),
  )
  const hasParent = !!parentChamber && parentChamber !== zeroAddress
  const hasChildren = !!childChambers && childChambers.length > 0
  const showOrganization = isLoadingParent || isLoadingChildren || hasParent || hasChildren || otherRelated.length > 0

  const directorSlice = useMemo(() => members.slice(0, chamberInfo.seats || 5), [members, chamberInfo.seats])
  const directorTokenIds = useMemo(() => directorSlice.map((m) => m.tokenId), [directorSlice])
  const { data: directorImages, resolvingImages: directorImagesResolving } = useNftImageMap(
    nftForImages,
    directorTokenIds,
    { chamberAddress },
  )

  return (
    <div className="space-y-6">
      <StatRow>
        <Stat
          label="Total assets"
          value={formatTokenAmount(chamberInfo.totalAssets, 18)}
          unit={assetSymbol}
          hint="ERC-4626 vault balance"
        />
        <Stat
          label="ETH balance"
          value={ethBalance ? parseFloat(formatUnits(ethBalance.value, ethBalance.decimals)).toFixed(4) : '…'}
          unit="ETH"
          hint="Held by the chamber wallet"
        />
        <Stat label="Board seats" value={chamberInfo.seats ?? '…'} hint={`${directorSlice.length} seated`} />
        <Stat
          label="Quorum"
          value={chamberInfo.quorum ?? '…'}
          unit={chamberInfo.seats !== undefined ? `of ${chamberInfo.seats}` : undefined}
          hint="Directors who must confirm"
        />
      </StatRow>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-6 min-w-0">
          {boardEmpty ? (
            <SeatTheBoard chamberAddress={chamberAddress} nftToken={nftForImages} />
          ) : (
            <RecentProposals
              chamberAddress={chamberAddress}
              currentSeats={chamberInfo.seats ?? 0}
              transactionCount={chamberInfo.transactionCount || 0}
              quorum={chamberInfo.quorum || 1}
            />
          )}

          <ChamberAssetsAlchemy
            chamberAddress={chamberAddress}
            chainId={chainId}
            chamberInfo={{ assetToken: chamberInfo.assetToken, nftToken: chamberInfo.nftToken }}
          />
        </div>

        <div className="space-y-6 min-w-0">
          <Section
            title="Directors"
            description={`Top ${chamberInfo.seats ?? '…'} members by delegated weight`}
            actions={
              <Link to={`/chamber/${chamberAddress}/board`} className="text-xs text-accent-300 hover:text-accent-200">
                Board →
              </Link>
            }
            flush
          >
            {directorSlice.length > 0 ? (
              <ul className="divide-y divide-line">
                {directorSlice.map((m, index) => {
                  const image = directorImages?.get(m.tokenId.toString())
                  return (
                    <li key={m.tokenId.toString()}>
                      <Link
                        to={`/chamber/${chamberAddress}/director/${m.tokenId.toString()}`}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-surface-3 border border-line flex items-center justify-center">
                          {directorImagesResolving && !image ? (
                            <div className="w-full h-full animate-pulse bg-surface-4" aria-hidden />
                          ) : image ? (
                            <NftRetryableImage src={image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-400 tabular-nums">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            Member #{m.tokenId.toString()}
                            {index === 0 && <FiStar className="w-3 h-3 text-accent-400" aria-label="Top ranked" />}
                          </div>
                          <div className="font-mono text-sm text-slate-200 truncate">
                            {m.owner && m.owner !== zeroAddress ? shortenAddress(m.owner, 6) : 'Unknown owner'}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
                          {formatTokenAmount(m.amount, shareDecimals)} {chamberInfo.symbol}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center space-y-3">
                <p className="text-slate-300 text-sm">No directors seated</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Hold a membership token, deposit shares, and delegate to that token. Director actions unlock after
                  one block.
                </p>
                <SeatTheBoardLink chamberAddress={chamberAddress} nftToken={chamberInfo.nftToken} className="btn btn-secondary btn-sm">
                  Seat the board
                </SeatTheBoardLink>
              </div>
            )}
          </Section>

          {userBalance !== undefined && userBalance > 0n && (
            <Section title="Your position">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate-400">Shares</span>
                <span className="font-heading text-xl font-light tabular-nums text-slate-100">
                  {formatTokenAmount(userBalance, shareDecimals, 4)}{' '}
                  <span className="text-sm text-slate-400">{chamberInfo.symbol}</span>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/chamber/${chamberAddress}/vault`} className="btn btn-secondary btn-sm">
                  Deposit or withdraw
                </Link>
                <Link to={`/chamber/${chamberAddress}/delegation`} className="btn btn-secondary btn-sm">
                  Delegate
                </Link>
              </div>
            </Section>
          )}

          <Section title="Details">
            <dl className="kv">
              <dt>Chamber</dt>
              <dd>
                <AddressChip address={chamberAddress} chainId={chainId} chars={6} label="chamber address" />
              </dd>
              {chamberInfo.assetToken && (
                <>
                  <dt>Asset token</dt>
                  <dd>
                    <AddressChip address={chamberInfo.assetToken} chainId={chainId} chars={6} label="asset token" />
                  </dd>
                </>
              )}
              {chamberInfo.nftToken && chamberInfo.nftToken !== zeroAddress && (
                <>
                  <dt>Membership</dt>
                  <dd>
                    <AddressChip address={chamberInfo.nftToken} chainId={chainId} chars={6} label="membership collection" />
                  </dd>
                </>
              )}
              <dt>Share supply</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatTokenAmount(chamberInfo.totalSupply, shareDecimals)} {chamberInfo.symbol}
              </dd>
              <dt>Delegated</dt>
              <dd className="font-mono text-xs tabular-nums">
                {formatTokenAmount(totalDelegated, shareDecimals)} {chamberInfo.symbol}
              </dd>
            </dl>
          </Section>

          {showOrganization && (
            <OrganizationCard
              chamberAddress={chamberAddress}
              nftToken={nftForImages}
              isLoadingParent={isLoadingParent}
              parentChamber={hasParent ? parentChamber : undefined}
              isLoadingChildren={isLoadingChildren}
              childChambers={childChambers}
              otherRelated={otherRelated}
            />
          )}
          {!showOrganization && nftForImages && (
            <p className="text-xs text-slate-500 px-1">
              <Link
                to={`/deploy?erc20=${chamberAddress}&erc721=${nftForImages}`}
                className="text-accent-300 hover:text-accent-200"
              >
                Create a sub-chamber →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ChamberLinkRow({ address, role }: { address: `0x${string}`; role: string }) {
  return (
    <li>
      <Link
        to={`/chamber/${address}`}
        className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
      >
        <span className="font-mono text-sm text-slate-200">{shortenAddress(address, 6)}</span>
        <span className="text-xs text-slate-500">{role}</span>
      </Link>
    </li>
  )
}

function OrganizationCard({
  chamberAddress,
  nftToken,
  isLoadingParent,
  parentChamber,
  isLoadingChildren,
  childChambers,
  otherRelated,
}: {
  chamberAddress: `0x${string}`
  nftToken?: `0x${string}`
  isLoadingParent: boolean
  parentChamber: `0x${string}` | undefined
  isLoadingChildren: boolean
  childChambers: `0x${string}`[] | undefined
  otherRelated: `0x${string}`[]
}) {
  const loading = isLoadingParent || isLoadingChildren
  return (
    <Section
      title="Organization"
      description="Parent, sub-chambers, and siblings"
      actions={
        nftToken && (
          <Link
            to={`/deploy?erc20=${chamberAddress}&erc721=${nftToken}`}
            className="text-xs text-accent-300 hover:text-accent-200"
          >
            New sub-chamber →
          </Link>
        )
      }
      flush
    >
      {loading ? (
        <div className="p-5 space-y-2">
          <div className="h-4 bg-surface-3 rounded animate-pulse" />
          <div className="h-4 bg-surface-3 rounded animate-pulse w-2/3" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {parentChamber && <ChamberLinkRow address={parentChamber} role="Parent" />}
          {childChambers?.map((addr) => <ChamberLinkRow key={addr} address={addr} role="Sub-chamber" />)}
          {otherRelated.map((addr) => (
            <ChamberLinkRow key={addr} address={addr} role="Sibling" />
          ))}
          {!parentChamber && !childChambers?.length && otherRelated.length === 0 && (
            <li className="px-5 py-4 text-xs text-slate-500">This is a main chamber with no sub-chambers yet.</li>
          )}
        </ul>
      )}
    </Section>
  )
}

// ─── Recent proposals ────────────────────────────────────────────────────────

const SEAT_TIMELOCK_SEC = 7n * 24n * 60n * 60n

function boardProposalStatus(seatUpdate: SeatUpdate): 'Pending' | 'Ready' {
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const timelockEnd = seatUpdate.timestamp + SEAT_TIMELOCK_SEC
  const timelockExpired = nowSec >= timelockEnd
  const supporterCount = seatUpdate.supporters.length
  const requiredQuorum = Number(seatUpdate.requiredQuorum)
  const quorumReached = supporterCount >= requiredQuorum
  return quorumReached && timelockExpired ? 'Ready' : 'Pending'
}

function statusBadge(status: 'Executed' | 'Ready' | 'Pending') {
  const cls = status === 'Executed' ? 'badge-success' : status === 'Ready' ? 'badge-success' : 'badge-pending'
  return <span className={`badge ${cls}`}>{status}</span>
}

function RecentProposals({
  chamberAddress,
  currentSeats,
  transactionCount,
  quorum,
}: {
  chamberAddress: `0x${string}`
  currentSeats: number
  transactionCount: number
  quorum: number
}) {
  const latestIds = useMemo(
    () => Array.from({ length: Math.min(transactionCount, 6) }, (_, i) => transactionCount - 1 - i),
    [transactionCount],
  )

  const { seatUpdate, isFetched: seatFetched } = useSeatUpdate(chamberAddress)

  const { data: txData, isLoading: isLoadingTransactions } = useReadContracts({
    contracts: latestIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction',
      args: [BigInt(id)],
    })) as readonly {
      address: `0x${string}`
      abi: typeof chamberAbi
      functionName: 'getTransaction'
      args: [bigint]
    }[],
    query: { enabled: latestIds.length > 0 },
  })

  const transactions = latestIds
    .map((id, index) => {
      const result = txData?.[index]
      if (!result || result.status !== 'success') return null
      const [executed, confirmations, target, value] = result.result as [boolean, number, `0x${string}`, bigint, `0x${string}`]
      return {
        id,
        executed,
        confirmations,
        target,
        value,
        status: (executed ? 'Executed' : confirmations >= quorum ? 'Ready' : 'Pending') as 'Executed' | 'Ready' | 'Pending',
      }
    })
    .filter((tx): tx is NonNullable<typeof tx> => tx !== null)

  const activeBoardProposal = seatUpdate && seatUpdate.timestamp > 0n ? seatUpdate : undefined
  const listLoading =
    (latestIds.length > 0 && isLoadingTransactions) ||
    (!activeBoardProposal && transactions.length === 0 && !seatFetched)
  const queueHref = `/chamber/${chamberAddress}/transactions`

  return (
    <Section
      title="Recent transactions"
      description="Vault transactions and board changes"
      actions={
        <Link to={queueHref} className="text-xs text-accent-300 hover:text-accent-200">
          All transactions →
        </Link>
      }
      flush
    >
      {listLoading ? (
        <div className="p-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-surface-3 animate-pulse" />
          ))}
        </div>
      ) : activeBoardProposal || transactions.length > 0 ? (
        <ul className="divide-y divide-line">
          {activeBoardProposal && (
            <li>
              <Link to={queueHref} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">
                    Board size {currentSeats} → {Number(activeBoardProposal.proposedSeats)} seats
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                    {activeBoardProposal.supporters.length} of {Number(activeBoardProposal.requiredQuorum)} supporters
                  </div>
                </div>
                {statusBadge(boardProposalStatus(activeBoardProposal))}
              </Link>
            </li>
          )}
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link to={queueHref} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">
                    Proposal <span className="font-mono tabular-nums">#{tx.id}</span>
                    <span className="text-slate-500"> · to </span>
                    <span className="font-mono text-slate-400">{shortenAddress(tx.target, 4)}</span>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                    {tx.confirmations} of {quorum} confirmations · {parseFloat(formatUnits(tx.value, 18)).toFixed(4)} ETH
                  </div>
                </div>
                {statusBadge(tx.status)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-slate-300 text-sm">No transactions yet</p>
          <p className="text-slate-500 text-xs mt-1">Vault transactions and board changes appear here.</p>
          <Link to={queueHref} className="btn btn-secondary btn-sm mt-4">
            Open transactions
          </Link>
        </div>
      )}
    </Section>
  )
}
