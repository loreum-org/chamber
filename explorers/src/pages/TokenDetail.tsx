import { useParams } from 'react-router-dom'

/**
 * Token detail page — single NFT inspection.
 * Stub: no feature logic (that's #296).
 */
export function TokenDetail() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-slate-100">
        Token #{id}
      </h1>
      <p className="text-slate-400">
        Token detail view will appear here.
      </p>
    </div>
  )
}
