/**
 * Frame-07: square art, name, mono id, ≤3 traits, whole card is the link.
 * - `image` undefined/unresolved → neutral placeholder, never a guessed value.
 * - `traits` undefined (metadata pending) → dashed "Traits loading" chip.
 * - Traits hidden on cards ≤768px (frame 06 mobile rule).
 */
import type { ReactNode } from 'react'

export interface TokenTrait {
  name: string
  value: string
}

export interface TokenCardProps {
  name: ReactNode
  tokenId: string | number
  image?: string | null
  /** undefined = metadata unresolved (shows pending chip); [] = genuinely none */
  traits?: TokenTrait[]
  href?: string
  className?: string
}

const MAX_TRAITS = 3

export function TokenCard({ name, tokenId, image, traits, href, className = '' }: TokenCardProps) {
  const body = (
    <>
      <div className="aspect-square bg-slate-500/5 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-3">
        <div className="font-semibold text-slate-100 truncate">{name}</div>
        <div className="font-mono text-xs text-slate-500 mt-0.5">#{tokenId}</div>
        <div className="hidden md:flex flex-wrap gap-1.5 mt-2.5">
          {traits === undefined ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-slate-500/30 text-slate-500">
              Traits loading
            </span>
          ) : (
            traits.slice(0, MAX_TRAITS).map((t) => (
              <span
                key={t.name}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400"
              >
                {t.name} · {t.value}
              </span>
            ))
          )}
        </div>
      </div>
    </>
  )

  const cls = `block bg-slate-900/55 border border-slate-700/40 rounded-xl overflow-hidden transition-all duration-200 hover:border-accent-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ${className}`

  return href !== undefined ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}
