import { Link } from 'react-router-dom'

/**
 * Home page — landing for the Explorers app.
 * Stub: no feature logic (that's #293).
 */
export function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold text-slate-100">
          Loreum Explorers
        </h1>
        <p className="max-w-2xl text-slate-400">
          Browse the Loreum NFT collection. View token gallery, inspect on-chain
          provenance, and verify metadata.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/gallery"
          className="panel p-6 transition-shadow duration-200 hover:shadow-card-hover"
        >
          <h2 className="font-heading text-lg font-semibold text-slate-100">
            Gallery
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Browse all Loreum Explorer NFTs.
          </p>
        </Link>
      </section>
    </div>
  )
}
