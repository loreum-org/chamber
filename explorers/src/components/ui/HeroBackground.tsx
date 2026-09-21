/**
 * Cinematic hero backdrop for the showcase redesign (#307). A decorative,
 * aria-hidden layer meant to sit behind hero content inside a `.bleed`
 * full-width wrapper: the signature aurora, a faint grid, and a soft animated
 * glow. Motion is disabled under prefers-reduced-motion (see index.css).
 */
export function HeroBackground({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Base aurora */}
      <div className="absolute inset-0 bg-aurora" />
      {/* Faint blueprint grid, fading toward the bottom */}
      <div className="absolute inset-0 bg-grid-faint bg-[size:44px_44px] opacity-[0.5] mask-fade-b" />
      {/* Drifting accent bloom */}
      <div className="absolute -top-1/3 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 rounded-full bg-accent-600/10 blur-3xl animate-aurora" />
      {/* Bottom seam into the page background */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-void" />
    </div>
  )
}
