import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="font-heading text-4xl font-semibold text-slate-100">
        404
      </h1>
      <p className="mt-4 text-slate-400">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="btn btn-primary mt-6"
      >
        Back to home
      </Link>
    </div>
  )
}
