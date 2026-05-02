import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react'

const MAX_IMAGE_RETRIES = 5
/** Backoff between <img> retries: 3s, 6s, 9s, 12s, 15s after prior failure. */
const IMAGE_RETRY_DELAY_MS = 3000

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string | undefined
  /** Invoked after all load attempts fail (metadata URL or gateway flake). */
  onLoadFailed?: () => void
}

/**
 * NFT / IPFS artwork: retries failed <img> loads with delay + cache-bust query param.
 */
export function NftRetryableImage({ src, onLoadFailed, ...rest }: Props) {
  const [retryIdx, setRetryIdx] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRetryIdx(0)
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
    const sep = s.includes('?') ? '&' : '?'
    return `${s}${sep}ch_retry=${retryIdx}`
  }, [src, retryIdx])

  if (!displaySrc) return null

  const handleError = () => {
    setRetryIdx((i) => {
      if (i < MAX_IMAGE_RETRIES) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          setRetryIdx(i + 1)
        }, IMAGE_RETRY_DELAY_MS * (i + 1))
        return i
      }
      onLoadFailed?.()
      return i
    })
  }

  return <img key={displaySrc} {...rest} src={displaySrc} onError={handleError} />
}
