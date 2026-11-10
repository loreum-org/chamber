import type { Scene } from './tapestry.ts';

/**
 * A tapestry crop that fills its frame, with a small scene caption.
 * The image is taken out of flow. In-flow, iOS sizes the card to the JPEG's
 * intrinsic width (1000px) and the card runs past the viewport.
 */
export function TapestryArt({ art }: { art: Scene }) {
  return (
    <figure className="absolute inset-0 overflow-hidden bg-[#d9cfbd]">
      <img
        src={art.src}
        alt={art.alt}
        loading="lazy"
        decoding="async"
        className="tapestry-art"
      />
      <figcaption className="absolute bottom-0 right-0 max-w-full truncate rounded-tl-md bg-ink-950/75 px-2 py-0.5 text-[10px] tracking-wide text-slate-300">
        Loreum Tapestry · panel {art.panel}
      </figcaption>
    </figure>
  );
}
