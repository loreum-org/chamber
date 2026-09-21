import { useState, type ReactNode } from 'react'

/**
 * Reusable NFT art container for the showcase redesign (#307).
 *
 * Handles the three honest states art can be in:
 *  - `src` still loading        → shimmer skeleton
 *  - `src` present + loaded      → the image (object-cover)
 *  - `src` null/undefined/errored → neutral "Art unavailable" well
 *
 * Never invents or guesses an image. Callers pass the resolved gateway URL (or
 * null when metadata is unresolved). Traits/overlays render on top via
 * `children` so cards and the detail page can share the same frame.
 */

type Aspect = 'square' | 'portrait' | 'video'

const aspectClass: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  video: 'aspect-video',
}

export interface ArtFrameProps {
  src?: string | null
  alt?: string
  aspect?: Aspect
  /** Enable the accent hover glow (for clickable cards). */
  hover?: boolean
  /** Priority images (hero) load eagerly; everything else lazy. */
  eager?: boolean
  className?: string
  /** Overlay content rendered above the art (badges, gradient, actions). */
  children?: ReactNode
}

export function ArtFrame({
  src,
  alt = '',
  aspect = 'square',
  hover = false,
  eager = false,
  className = '',
  children,
}: ArtFrameProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const showImage = Boolean(src) && !errored

  return (
    <div
      className={`art-frame ${hover ? 'art-frame-hover' : ''} ${aspectClass[aspect]} ${className}`}
    >
      {/* Loading shimmer sits under the image until it decodes. */}
      {showImage && !loaded && (
        <div aria-hidden className="shimmer absolute inset-0 bg-slate-800/50" />
      )}

      {showImage ? (
        <img
          src={src as string}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            className="h-8 w-8"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span className="text-xs">Art unavailable</span>
        </div>
      )}

      {children}
    </div>
  )
}
