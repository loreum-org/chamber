/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_MAINNET_RPC_URL: string
  readonly VITE_SEPOLIA_RPC_URL: string
  readonly VITE_LOREUM_NFT_MAINNET: string
  readonly VITE_LOREUM_NFT_SEPOLIA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
