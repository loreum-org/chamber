import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { FiMenu, FiX } from 'react-icons/fi'
import { useAccount, useWriteContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { simulateContract } from 'wagmi/actions'
import { zeroAddress, parseEther } from 'viem'
import { config, getContractAddresses, LOCAL_CHAIN_ID } from '@/lib/wagmi'
import { erc721Abi, erc20Abi } from '@/contracts'
import { formatLocalTestMintToast, formatWalletSendError } from '@/lib/utils'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/', label: 'My Chambers' },
  { path: '/deploy', label: 'Deploy Chamber' },
  { path: '/compliance', label: 'Compliance' },
  { path: '/docs', label: 'Docs' },
]

/** Default test mint size for MockERC20 (“Mint test ERC-20”). */
const TEST_ERC20_MINT_AMOUNT = parseEther('10000')

function isNavActive(itemPath: string, locationPath: string): boolean {
  if (itemPath === '/') return locationPath === '/' || locationPath.startsWith('/chamber')
  return locationPath.startsWith(itemPath)
}

export default function Layout() {
  const location = useLocation()
  const { chainId, address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [minting, setMinting] = useState<'none' | 'nft' | 'erc20'>('none')

  const onLocalRpc = typeof chainId === 'number' && chainId === LOCAL_CHAIN_ID
  const onSepolia = chainId === sepolia.id
  const canMintTestTokens = onLocalRpc || onSepolia
  const mintTargets = canMintTestTokens ? getContractAddresses(chainId) : undefined
  const mintNftAddr = mintTargets?.mockERC721
  const mintErc20Addr = mintTargets?.mockERC20
  const canShowMintNftBtn =
    canMintTestTokens && !!address && !!mintNftAddr && mintNftAddr !== zeroAddress
  const canShowMintErc20Btn =
    canMintTestTokens && !!address && !!mintErc20Addr && mintErc20Addr !== zeroAddress
  const showTestTools = canShowMintNftBtn || canShowMintErc20Btn

  const handleMintTestNft = async () => {
    if (!address || !canMintTestTokens || !mintNftAddr || mintNftAddr === zeroAddress) {
      if (!mintNftAddr || mintNftAddr === zeroAddress) {
        toast.error(
          onSepolia
            ? 'Sepolia demo NFT is missing from deployments/sepolia.txt (MockERC721).'
            : 'Mock ERC-721 address is missing. With Anvil running, run make setup-local in contracts/',
        )
      }
      return
    }

    setMinting('nft')
    try {
      const { request } = await simulateContract(config, {
        address: mintNftAddr,
        abi: erc721Abi,
        functionName: 'mint',
        args: [address],
        chainId,
        account: address,
      })
      await writeContractAsync(request)
      toast.success('Test member token minted successfully!')
    } catch (e: unknown) {
      toast.error(
        onLocalRpc ? formatLocalTestMintToast(e) : formatWalletSendError(e, 'Mint failed'),
      )
    } finally {
      setMinting('none')
    }
  }

  const handleMintTestErc20 = async () => {
    if (!address || !canMintTestTokens || !mintErc20Addr || mintErc20Addr === zeroAddress) {
      if (!mintErc20Addr || mintErc20Addr === zeroAddress) {
        toast.error(
          onSepolia
            ? 'Sepolia demo ERC-20 is missing from deployments/sepolia.txt (MockERC20).'
            : 'Mock ERC-20 address is missing. With Anvil running, run make setup-local in contracts/',
        )
      }
      return
    }

    setMinting('erc20')
    try {
      const { request } = await simulateContract(config, {
        address: mintErc20Addr,
        abi: erc20Abi,
        functionName: 'mint',
        args: [address, TEST_ERC20_MINT_AMOUNT],
        chainId,
        account: address,
      })
      await writeContractAsync(request)
      toast.success('Test ERC-20 tokens minted to your wallet!')
    } catch (e: unknown) {
      toast.error(
        onLocalRpc ? formatLocalTestMintToast(e) : formatWalletSendError(e, 'Mint failed'),
      )
    } finally {
      setMinting('none')
    }
  }

  const testTools = showTestTools ? (
    <details className="relative group">
      <summary className="btn btn-ghost btn-sm list-none cursor-pointer select-none text-slate-400">
        Test tokens
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-1.5 w-52 panel-raised p-1 z-50 flex flex-col">
        {canShowMintErc20Btn && (
          <button
            type="button"
            onClick={handleMintTestErc20}
            disabled={minting !== 'none'}
            className="text-left text-sm px-3 py-2 rounded-[5px] text-slate-200 hover:bg-surface-3 disabled:opacity-50"
          >
            {minting === 'erc20' ? 'Minting…' : 'Mint test ERC-20'}
          </button>
        )}
        {canShowMintNftBtn && (
          <button
            type="button"
            onClick={handleMintTestNft}
            disabled={minting !== 'none'}
            className="text-left text-sm px-3 py-2 rounded-[5px] text-slate-200 hover:bg-surface-3 disabled:opacity-50"
          >
            {minting === 'nft' ? 'Minting…' : 'Mint test membership NFT'}
          </button>
        )}
        <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500">
          Demo tokens on {onSepolia ? 'Sepolia' : 'the local chain'} only.
        </p>
      </div>
    </details>
  ) : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface-0/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="https://cdn.loreum.org/logos/white.svg" alt="" className="w-7 h-7 object-contain" />
              <span className="font-heading font-semibold text-slate-100 tracking-[0.02em]">Loreum</span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5" aria-label="Main">
              {navItems.map((item) => {
                const isActive = isNavActive(item.path, location.pathname)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                      isActive
                        ? 'text-slate-100 bg-surface-2'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-surface-2'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">{testTools}</div>
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-surface-2 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-line bg-surface-1 px-4 py-3 space-y-1" aria-label="Main">
            {navItems.map((item) => {
              const isActive = isNavActive(item.path, location.pathname)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm ${
                    isActive ? 'text-slate-100 bg-surface-2' : 'text-slate-400 hover:text-slate-100 hover:bg-surface-2'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
            {canShowMintErc20Btn && (
              <button
                type="button"
                onClick={() => {
                  void handleMintTestErc20()
                  setMobileMenuOpen(false)
                }}
                disabled={minting !== 'none'}
                className="block w-full text-left px-3 py-2.5 rounded-md text-sm text-accent-300 hover:bg-surface-2 disabled:opacity-50"
              >
                {minting === 'erc20' ? 'Minting…' : 'Mint test ERC-20'}
              </button>
            )}
            {canShowMintNftBtn && (
              <button
                type="button"
                onClick={() => {
                  void handleMintTestNft()
                  setMobileMenuOpen(false)
                }}
                disabled={minting !== 'none'}
                className="block w-full text-left px-3 py-2.5 rounded-md text-sm text-accent-300 hover:bg-surface-2 disabled:opacity-50"
              >
                {minting === 'nft' ? 'Minting…' : 'Mint test membership NFT'}
              </button>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Loreum</span>
            <a
              href="https://github.com/loreum-org/chamber"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              GitHub
            </a>
            <Link to="/docs" className="hover:text-slate-200 transition-colors">
              Docs
            </Link>
          </div>
          <p className="max-w-2xl leading-relaxed text-slate-600">
            Loreum is non-custodial governance software, not legal, tax, investment, broker, dealer, exchange, or custodial advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
