import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { mainnet, sepolia } from '@/wagmi'
import { NetworkChip, type NetworkChipState } from '../ui'

function getNetworkChipProps(chainId: number, chainName: string): { state: NetworkChipState; label: string } {
  if (chainId === mainnet.id) {
    return { state: 'supported', label: chainName }
  }
  if (chainId === sepolia.id) {
    return { state: 'test', label: `Test network · ${chainName}` }
  }
  return { state: 'unsupported', label: chainName }
}

export function Header() {
  const { chain } = useAccount()
  const chainId = chain?.id ?? mainnet.id
  const chainName = chain?.name ?? 'Ethereum'
  const { state, label } = getNetworkChipProps(chainId, chainName)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <a href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg font-semibold tracking-tight text-slate-100">
            LOREUM
          </span>
          <span className="text-sm font-light text-slate-400">Explorers</span>
        </a>

        {/* Right side: network chip + wallet connect */}
        <div className="flex items-center gap-3">
          <NetworkChip state={state} label={label} />
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>
    </header>
  )
}
