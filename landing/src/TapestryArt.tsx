import type { Scene } from './tapestry.ts';

/** A tapestry crop that fills its box, with a small scene caption. */
export function TapestryArt({ art }: { art: Scene }) {
  return (
    <figure className="relative h-full w-full overflow-hidden bg-[#d9cfbd]">
      <img
        src={art.src}
        alt={art.alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <figcaption className="absolute bottom-0 right-0 rounded-tl-md bg-ink-950/75 px-2 py-0.5 text-[10px] tracking-wide text-slate-300">
        Loreum Tapestry · panel {art.panel}
      </figcaption>
    </figure>
  );
}
