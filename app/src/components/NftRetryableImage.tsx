import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'
import { cn } from '@/lib/utils'

const MAX_IMAGE_RETRIES = 5
/** Backoff between <img> retries: 3s, 6s, 9s, 12s, 15s after prior failure. */
const IMAGE_RETRY_DELAY_MS = 3000

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string | undefined
  /** Invoked after all load attempts fail (metadata URL or gateway flake). */
  onLoadFailed?: () => void
}

/** Loreum IPFS gateway returns Content-Length that does not match the body when a query string is appended. */
function shouldAvoidQueryCacheBust(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'ipfs.loreum.org'
  } catch {
    return false
  }
}

/**
 * NFT / IPFS artwork: retries failed <img> loads with delay + cache-bust query param (when safe).
 * Tracks decode completion so opacity can update when pixels are ready (incl. cached images),
 * and hides the broken-image state while waiting to retry.
 */
export function NftRetryableImage({ src, onLoadFailed, onLoad, className, ...rest }: Props) {
  const [retryIdx, setRetryIdx] = useState(0)
  const [betweenRetry, setBetweenRetry] = useState(false)
  const [pixelLoaded, setPixelLoaded] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const retryIdxRef = useRef(0)

  useEffect(() => {
    retryIdxRef.current = retryIdx
  }, [retryIdx])

  useEffect(() => {
    setRetryIdx(0)
    setBetweenRetry(false)
    setPixelLoaded(false)
  }, [src])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const displaySrc = useMemo(() => {
    if (!src?.trim()) return undefined
    const s = src.trim()
    if (s.toLowerCase().startsWith('data:')) return s
    if (retryIdx === 0) return s
    if (shouldAvoidQueryCacheBust(s)) return s
    const sep = s.includes('?') ? '&' : '?'
    return `${s}${sep}ch_retry=${retryIdx}`
  }, [src, retryIdx])

  const imgMountKey = `${displaySrc ?? ''}::r${retryIdx}`

  useLayoutEffect(() => {
    if (!displaySrc || betweenRetry) return
    const el = imgRef.current
    if (el?.complete && el.naturalHeight > 0) {
      setPixelLoaded(true)
    }
  }, [displaySrc, betweenRetry])

  if (!displaySrc) return null

  if (betweenRetry) {
    return (
      <div
        aria-hidden
        className={cn(className, 'w-full h-full min-h-0 min-w-0 animate-pulse bg-slate-600/40')}
      />
    )
  }

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    setPixelLoaded(true)
    onLoad?.(e)
  }

  const handleError = () => {
    setPixelLoaded(false)
    const i = retryIdxRef.current
    if (i >= MAX_IMAGE_RETRIES) {
      onLoadFailed?.()
      return
    }
    setBetweenRetry(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setBetweenRetry(false)
      setRetryIdx(i + 1)
    }, IMAGE_RETRY_DELAY_MS * (i + 1))
  }

  return (
    <img
      ref={imgRef}
      key={imgMountKey}
      {...rest}
      src={displaySrc}
      className={cn(className, 'transition-opacity duration-200', pixelLoaded ? 'opacity-100' : 'opacity-0')}
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}
