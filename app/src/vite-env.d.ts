/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_MAINNET_RPC_URL?: string
  readonly VITE_SEPOLIA_RPC_URL?: string
  readonly VITE_BASE_RPC_URL?: string
  readonly VITE_ARBITRUM_RPC_URL?: string
  readonly VITE_LOCALHOST_RPC_URL?: string
  readonly VITE_ALCHEMY_API_KEY?: string
  readonly VITE_MAINNET_REGISTRY?: string
  readonly VITE_SEPOLIA_REGISTRY?: string
  readonly VITE_SEPOLIA_CHAMBER_IMPL?: string
  readonly VITE_SEPOLIA_MOCK_ERC20?: string
  readonly VITE_SEPOLIA_MOCK_ERC721?: string
  readonly VITE_MAINNET_CHAMBER_IMPL?: string
  readonly VITE_BASE_REGISTRY?: string
  readonly VITE_BASE_CHAMBER_IMPL?: string
  readonly VITE_ARBITRUM_REGISTRY?: string
  readonly VITE_ARBITRUM_CHAMBER_IMPL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
