import '@rainbow-me/rainbowkit/styles.css'
import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from './wagmi'
import { App } from './App'

const queryClient = new QueryClient()

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{
            appName: 'Loreum Explorers',
            learnMoreUrl: 'https://loreum.org',
          }}
          theme={darkTheme({
            accentColor: '#2563eb',
            accentColorForeground: '#ffffff',
            borderRadius: 'large',
            overlayBlur: 'small',
            fontStack: 'system',
          })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
