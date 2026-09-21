/**
 * Frame-07: skeleton shimmer only as motion (with prefers-reduced-motion
 * honoured in index.css). Base fill + the repo's .shimmer overlay utility.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`shimmer rounded-md bg-slate-800/60 ${className}`} />
}
