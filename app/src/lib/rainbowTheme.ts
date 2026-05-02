import { darkTheme } from '@rainbow-me/rainbowkit'
import type { Theme, AvatarComponent } from '@rainbow-me/rainbowkit'

/** No ENS / generated avatar in the account modal or connect button (see ConnectButton `accountStatus`). */
export const noWalletAvatar: AvatarComponent = () => null

/**
 * RainbowKit theme aligned with Chamber UI:
 * navy surfaces (#0b0f17 family), slate borders, accent blue (#2563eb), IBM Plex + Inter.
 */
export const chamberWalletTheme: Theme = (() => {
  const base = darkTheme({
    accentColor: '#2563eb',
    accentColorForeground: '#ffffff',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'large',
  })

  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: '#121a28',
      modalBackdrop: 'rgba(11, 15, 23, 0.82)',
      modalBorder: 'rgba(148, 163, 184, 0.18)',
      modalText: '#e2e8f0',
      modalTextSecondary: '#94a3b8',
      modalTextDim: '#64748b',
      connectButtonBackground: '#0c111d',
      connectButtonInnerBackground: '#161f30',
      connectButtonText: '#f1f5f9',
      generalBorder: 'rgba(148, 163, 184, 0.14)',
      generalBorderDim: 'rgba(148, 163, 184, 0.09)',
      actionButtonSecondaryBackground: 'rgba(18, 26, 40, 0.92)',
      actionButtonBorder: 'rgba(148, 163, 184, 0.14)',
      actionButtonBorderMobile: 'rgba(148, 163, 184, 0.12)',
      menuItemBackground: 'rgba(37, 99, 235, 0.12)',
      profileForeground: '#0d1320',
      profileAction: '#1a2236',
      profileActionHover: '#232f47',
      closeButton: '#94a3b8',
      closeButtonBackground: 'rgba(15, 23, 42, 0.72)',
      selectedOptionBorder: 'rgba(59, 130, 246, 0.42)',
      downloadTopCardBackground: '#161f30',
      downloadBottomCardBackground: '#121a28',
      standby: '#64748b',
    },
    fonts: {
      ...base.fonts,
      body: '"IBM Plex Sans", Inter, system-ui, sans-serif',
    },
    shadows: {
      ...base.shadows,
      connectButton: '0 1px 2px rgba(0, 0, 0, 0.4)',
      dialog: '0 16px 56px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.08)',
      selectedWallet:
        '0 6px 24px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(59, 130, 246, 0.14)',
    },
  }
})()
