import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App'
import { AccountModalChainLabel } from '@/components/AccountModalChainLabel'
import { chamberWalletTheme, noWalletAvatar } from '@/lib/rainbowTheme'
import { config } from './lib/wagmi'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          avatar={noWalletAvatar}
          theme={chamberWalletTheme}
          appInfo={{
            appName: 'Chamber',
            learnMoreUrl: 'https://github.com/loreum-org/chamber',
          }}
        >
          <AccountModalChainLabel />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
