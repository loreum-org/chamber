/**
 * Cinematic hero backdrop — dark stellar orb cloud.
 * Multiple soft, almost-transparent dark orbs with heavy blur create a
 * nebula-like depth effect. No grid, no bright aurora — just subtle cosmic
 * atmosphere. Motion is disabled under prefers-reduced-motion (see index.css).
 */
export function HeroBackground({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-void to-void" />

      {/* Stellar orb cluster — large, soft, almost-transparent dark orbs */}
      <div className="absolute -top-1/4 -left-1/4 h-[80vh] w-[80vh] rounded-full bg-slate-900/40 blur-[120px] animate-aurora" />
      <div className="absolute top-1/3 -right-1/4 h-[70vh] w-[70vh] rounded-full bg-slate-800/30 blur-[100px] animate-aurora [animation-delay:-6s]" />
      <div className="absolute -bottom-1/4 left-1/3 h-[60vh] w-[60vh] rounded-full bg-slate-900/35 blur-[110px] animate-aurora [animation-delay:-12s]" />

      {/* Subtle accent hint — very faint blue orb for depth */}
      <div className="absolute top-1/2 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-950/20 blur-[100px]" />

      {/* Bottom seam into the page background */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-void" />
    </div>
  )
}
