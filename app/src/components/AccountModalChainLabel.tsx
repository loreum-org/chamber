import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccountModal } from '@rainbow-me/rainbowkit'
import { useChainId } from 'wagmi'
import { config } from '@/lib/wagmi'

/**
 * RainbowKit’s account modal leaves empty space where the avatar was. Show the active
 * network name just above the truncated address (anchors to `#rk_profile_title`).
 */
export function AccountModalChainLabel() {
  const { accountModalOpen } = useAccountModal()
  const chainId = useChainId()
  const chain = config.chains.find((c) => c.id === chainId)
  const networkName =
    chain?.name ?? (typeof chainId === 'number' ? `Chain ${chainId}` : '')

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!accountModalOpen || !networkName) {
      setCoords(null)
      return
    }

    let alive = true
    const measure = () => {
      if (!alive) return
      const el = document.getElementById('rk_profile_title')
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords({ top: r.top, left: r.left + r.width / 2 })
    }

    measure()
    const iv = window.setInterval(measure, 48)
    const stopIv = window.setTimeout(() => clearInterval(iv), 2000)
    window.addEventListener('resize', measure)

    return () => {
      alive = false
      clearInterval(iv)
      clearTimeout(stopIv)
      window.removeEventListener('resize', measure)
    }
  }, [accountModalOpen, networkName, chainId])

  if (!accountModalOpen || !networkName || !coords) return null

  return createPortal(
    <p
      className="pointer-events-none fixed z-[2147483647] max-w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-full truncate px-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
      style={{ top: coords.top - 6, left: coords.left }}
    >
      {networkName}
    </p>,
    document.body,
  )
}
