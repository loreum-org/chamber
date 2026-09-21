import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatEther } from 'viem'
import { useCollection } from '@/hooks/useCollection'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { ipfsToGatewayUrl } from '@/lib/ipfs'
import {
  ArtFrame,
  HeroBackground,
  SectionHeading,
  StatTile,
  StatRow,
  buttonClass,
} from '@/components/ui'

/**
 * Home — the public collection landing (#308).
 *
 * Art-forward, bold showcase (per epic #306): a full-bleed cinematic hero with
 * the live on-chain collection name + stats, a featured wall of recent mints,
 * a short honest collection story, and a closing claim CTA. All numbers read
 * live via useCollection — nothing (price / supply / name) is hardcoded.
 */

const FEATURED_COUNT = 8

/** Recent-mint token ids, newest first (ids are sequential from 1). */
function recentTokenIds(totalSupply: bigint | undefined): bigint[] {
  if (totalSupply === undefined || totalSupply <= 0n) return []
  const total = Number(totalSupply)
  const n = Math.min(FEATURED_COUNT, total)
  return Array.from({ length: n }, (_, i) => BigInt(total - i))
}

function formatPrice(mintCost: bigint | undefined): string | undefined {
  if (mintCost === undefined) return undefined
  return `${formatEther(mintCost)} ETH`
}

export function Home() {
  const { data: collection, isLoading } = useCollection()
  const { name, symbol, totalSupply, maxSupply, mintCost } = collection

  const featured = recentTokenIds(totalSupply)
  const heroTokenId = featured[0]

  const mintedLabel =
    totalSupply !== undefined && maxSupply !== undefined
      ? `${Number(totalSupply).toLocaleString()} / ${Number(maxSupply).toLocaleString()}`
      : undefined

  return (
    <div className="space-y-24">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bleed relative -mt-8 overflow-hidden pb-4 pt-8">
        <HeroBackground />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-20">
          {/* Copy */}
          <div className="animate-fade-up">
            <div className="eyebrow mb-5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              On-chain collection · Ethereum
            </div>

            <h1 className="font-display text-display font-semibold text-slate-50">
              {name ? (
                <span className="display-gradient">{name}</span>
              ) : (
                <span className="shimmer inline-block h-[1em] w-[7ch] rounded-lg bg-slate-800/60 align-middle" />
              )}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              A public NFT collection by Loreum. Every Explorer is minted straight
              from the contract, with art stored on IPFS and provenance you can
              verify on-chain.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/claim" className={buttonClass('primary', 'lg', 'px-7')}>
                Claim an Explorer
              </Link>
              <Link to="/gallery" className={buttonClass('ghost', 'lg', 'px-5')}>
                My Explorers
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Live stats */}
            <StatRow className="mt-10 max-w-lg">
              <StatTile label="Minted" value={mintedLabel} loading={isLoading || mintedLabel === undefined} />
              <StatTile
                label="Mint price"
                value={formatPrice(mintCost)}
                loading={isLoading || mintCost === undefined}
              />
              <StatTile
                label="Symbol"
                value={symbol ? `$${symbol}` : undefined}
                loading={isLoading || symbol === undefined}
              />
            </StatRow>
          </div>

          {/* Hero art */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="mx-auto w-full max-w-sm lg:max-w-none">
              {heroTokenId !== undefined ? (
                <HeroArt tokenId={heroTokenId} />
              ) : (
                <ArtFrame aspect="square" className="shadow-glow">
                  <div className="absolute inset-0 bg-aurora opacity-80" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                    <span className="font-display text-2xl font-semibold text-white">
                      No Explorers yet
                    </span>
                    <span className="text-sm text-slate-300">Be the first to claim.</span>
                  </div>
                </ArtFrame>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured wall ────────────────────────────────────── */}
      {featured.length > 0 && (
        <section>
          <SectionHeading
            eyebrow="From the collection"
            title="Recently minted"
            description="The latest Explorers to come on-chain."
            action={
              <Link
                to="/gallery"
                className="text-sm font-medium text-accent-300 transition-colors hover:text-accent-200"
              >
                My Explorers →
              </Link>
            }
          />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((id) => (
              <FeaturedCard key={id.toString()} tokenId={id} />
            ))}
          </div>
        </section>
      )}

      {/* ── Collection story ─────────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="What you're collecting"
          title="An on-chain collectible, not a promise"
          align="center"
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STORY.map((f) => (
            <div key={f.title} className="glass p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-600/15 text-accent-300">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-slate-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] px-6 py-14 text-center sm:py-20">
        <div aria-hidden className="absolute inset-0 bg-aurora opacity-90" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Claim your Explorer
          </h2>
          <p className="mt-3 text-slate-300">
            Mint directly from the contract — {formatPrice(mintCost) ?? 'a fixed price'} each.
          </p>
          <div className="mt-8">
            <Link to="/claim" className={buttonClass('primary', 'lg', 'px-8')}>
              Claim an Explorer
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Large hero art for the newest token. */
function HeroArt({ tokenId }: { tokenId: bigint }) {
  const { data } = useTokenMetadata(tokenId)
  const image = data.image ? ipfsToGatewayUrl(data.image) : null
  return (
    <ArtFrame
      src={image}
      alt={data.name ?? `Explorer #${tokenId}`}
      aspect="square"
      eager
      className="shadow-glow"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        <div className="font-display text-lg font-semibold text-white">
          {data.name ?? `Explorer #${tokenId.toString()}`}
        </div>
        <div className="font-mono text-xs text-slate-300">#{tokenId.toString()}</div>
      </div>
    </ArtFrame>
  )
}

/** Featured-wall card — links to the token detail. */
function FeaturedCard({ tokenId }: { tokenId: bigint }) {
  const { data } = useTokenMetadata(tokenId)
  const image = data.image ? ipfsToGatewayUrl(data.image) : null
  return (
    <Link
      to={`/token/${tokenId.toString()}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
    >
      <ArtFrame src={image} alt={data.name ?? `Explorer #${tokenId}`} aspect="square" hover>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="truncate text-sm font-semibold text-white">
            {data.name ?? `Explorer #${tokenId.toString()}`}
          </span>
          <span className="font-mono text-[11px] text-slate-300">#{tokenId.toString()}</span>
        </div>
      </ArtFrame>
    </Link>
  )
}

const STORY: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Minted on-chain',
    body: 'Claim calls the contract directly — no marketplace middleman. Your Explorer is yours the moment the transaction confirms.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
        <path d="M12 2 4 6v6c0 5 3.5 7.5 8 10 4.5-2.5 8-5 8-10V6l-8-4Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Art on IPFS',
    body: 'Every token’s image and traits live on IPFS and are fetched from the token URI — content-addressed, not served from us.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Verifiable provenance',
    body: 'Open any token to see its owner, traits, and links to Etherscan and the raw metadata. Nothing is synthesized.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
  },
]
