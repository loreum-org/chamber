import React, { useId } from 'react';

/*
 * Medieval and Roman scene illustrations for the landing page cards.
 * Each scene is a 320×160 inline SVG that fills its box (cropping the sides
 * when the box is narrow), drawn in the site's purple with warm gold accents.
 */

const LINE = '#c3a8ff';
const PALE = '#dcd5ee';
const INK = '#0b0f17';
const DEEP = '#2a1a55';
const WARM = '#f3c969';

const outline = {
  stroke: LINE,
  strokeWidth: 1.2,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

type Paint = {
  sky: string;
  glow: string;
  body: string;
  marble: string;
  stone: string;
  gold: string;
  ground: string;
  fire: string;
};

const STARS: [number, number, number][] = [
  [18, 14, 0.9], [44, 52, 0.5], [70, 22, 0.7], [96, 8, 0.5], [128, 26, 0.4], [196, 12, 0.6],
  [226, 30, 0.4], [252, 10, 0.8], [282, 40, 0.5], [304, 18, 0.7], [12, 70, 0.4], [308, 76, 0.4],
];

function Scene({
  label,
  glow = [160, 84],
  children,
}: {
  label: string;
  glow?: [number, number];
  children: (p: Paint) => React.ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const ref = (n: string) => `${id}-${n}`;
  const url = (n: string) => `url(#${ref(n)})`;
  const p: Paint = {
    sky: url('sky'),
    glow: url('glow'),
    body: url('body'),
    marble: url('marble'),
    stone: url('stone'),
    gold: url('gold'),
    ground: url('ground'),
    fire: url('fire'),
  };
  return (
    <svg
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      className="block w-full h-full"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={ref('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1d57" />
          <stop offset="0.65" stopColor="#151b28" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <radialGradient id={ref('glow')}>
          <stop offset="0" stopColor="#a685f5" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7c5cd6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a685f5" />
          <stop offset="1" stopColor="#3b2473" />
        </linearGradient>
        <linearGradient id={ref('marble')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e2f7" />
          <stop offset="1" stopColor="#8f78c9" />
        </linearGradient>
        <linearGradient id={ref('stone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3f78" />
          <stop offset="1" stopColor="#1b2232" />
        </linearGradient>
        <linearGradient id={ref('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbeab4" />
          <stop offset="1" stopColor="#c79a3a" />
        </linearGradient>
        <linearGradient id={ref('ground')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2232" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <radialGradient id={ref('fire')}>
          <stop offset="0" stopColor={WARM} stopOpacity="0.55" />
          <stop offset="1" stopColor={WARM} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="160" fill={p.sky} />
      {STARS.map(([x, y, o]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={o > 0.6 ? 1.1 : 0.8} fill={PALE} opacity={o} />
      ))}
      <ellipse cx={glow[0]} cy={glow[1]} rx="120" ry="74" fill={p.glow} />
      {children(p)}
    </svg>
  );
}

const Ground = ({ p, y = 132 }: { p: Paint; y?: number }) => (
  <path d={`M0 ${y}Q80 ${y - 7} 160 ${y - 1}T320 ${y - 3}V160H0z`} fill={p.ground} />
);

const Flame = ({ x, y, p }: { x: number; y: number; p: Paint }) => (
  <g>
    <circle cx={x} cy={y} r="16" fill={p.fire} />
    <path d={`M${x} ${y - 9}c4 5 5 8 3 11a4 4 0 0 1-6 0c-2-3-1-6 3-11z`} fill={p.gold} stroke={WARM} strokeWidth="0.8" />
  </g>
);

const Torch = ({ x, top, bottom, p }: { x: number; top: number; bottom: number; p: Paint }) => (
  <g>
    <path d={`M${x} ${top + 6}V${bottom}`} {...outline} strokeWidth={2} />
    <path d={`M${x - 6} ${top}h12l-3 6h-6z`} fill={p.stone} {...outline} />
    <Flame x={x} y={top - 4} p={p} />
  </g>
);

const Sparkle = ({ x, y, s = 4 }: { x: number; y: number; s?: number }) => (
  <path d={`M${x} ${y - s}L${x + s / 4} ${y - s / 4}L${x + s} ${y}L${x + s / 4} ${y + s / 4}L${x} ${y + s}L${x - s / 4} ${y + s / 4}L${x - s} ${y}L${x - s / 4} ${y - s / 4}z`} fill={PALE} opacity="0.85" />
);

const Figure = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="0" cy="-12" r="2.6" fill={INK} stroke="#a685f5" strokeWidth="0.8" />
    <path d="M-4.5 0v-5a4.5 4.5 0 0 1 9 0v5z" fill={INK} stroke="#a685f5" strokeWidth="0.8" />
  </g>
);

/* ── Problem cards ───────────────────────────────────────────────────────── */

/** A shut gatehouse: the signer list is whoever was let in. */
export const GatehouseScene = () => (
  <Scene label="A castle gatehouse with its portcullis lowered">
    {(p) => (
      <>
        <circle cx="52" cy="34" r="12" fill={PALE} opacity="0.85" />
        <circle cx="58" cy="30" r="11" fill="#2b1d57" />
        <Ground p={p} />
        <rect x="0" y="136" width="320" height="10" fill={DEEP} opacity="0.7" />
        <path d="M60 141h40M140 143h50M220 140h44" stroke={LINE} strokeOpacity="0.3" strokeWidth="1" />
        {/* towers */}
        <path d="M100 136V40h6v-6h7v6h7v-6h6v6h6v96z" fill={p.stone} {...outline} />
        <path d="M188 136V40h6v-6h7v6h7v-6h6v6h6v96z" fill={p.stone} {...outline} />
        {/* curtain wall */}
        <path d="M132 136V62h4v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h4v74z" fill={p.stone} {...outline} />
        <path d="M100 76h32M188 76h32M132 88h56M100 112h32M188 112h32" stroke={LINE} strokeOpacity="0.18" />
        {/* lit windows */}
        <g fill={WARM} opacity="0.85">
          <rect x="114" y="54" width="4" height="10" rx="2" />
          <rect x="202" y="54" width="4" height="10" rx="2" />
          <rect x="114" y="92" width="4" height="9" rx="2" />
          <rect x="202" y="92" width="4" height="9" rx="2" />
        </g>
        {/* gate and portcullis */}
        <path d="M146 136V104a14 14 0 0 1 28 0v32z" fill={INK} {...outline} />
        <path d="M151 93.3V136M156 90.6V136M160 90V136M164 90.6V136M169 93.3V136M146 104h28M146 114h28M146 124h28" stroke="#a685f5" strokeWidth="1.1" />
        {/* banners */}
        <path d="M116 34V12M204 34V12" {...outline} />
        <path d="M116 12h20l-5 5 5 5h-20z" fill={p.body} {...outline} />
        <path d="M204 12h-20l5 5-5 5h20z" fill={p.body} {...outline} />
      </>
    )}
  </Scene>
);

/** A temple on the forum with a crowd before it: the public token community. */
export const ForumScene = () => (
  <Scene label="A Roman temple with a crowd gathered in front">
    {(p) => (
      <>
        <Ground p={p} />
        {/* cypress trees */}
        <path d="M46 134C28 112 34 80 46 52c12 28 18 60 0 82z" fill={DEEP} {...outline} />
        <path d="M46 132V64" stroke={LINE} strokeOpacity="0.3" />
        <path d="M274 134c-18-22-12-54 0-82 12 28 18 60 0 82z" fill={DEEP} {...outline} />
        <path d="M274 132V64" stroke={LINE} strokeOpacity="0.3" />
        {/* temple */}
        <path d="M88 58 160 28l72 30z" fill={p.marble} {...outline} />
        <path d="M106 54 160 34l54 20z" fill="none" stroke="#7c5cd6" strokeOpacity="0.6" />
        <circle cx="160" cy="46" r="4" fill="none" stroke="#7c5cd6" />
        <rect x="90" y="58" width="140" height="9" fill={p.marble} {...outline} />
        <path d="M96 62.5h128" stroke="#7c5cd6" strokeOpacity="0.5" strokeDasharray="2 4" />
        {[98, 121, 144, 167, 190, 213].map((x) => (
          <g key={x}>
            <rect x={x} y="70" width="10" height="50" fill={p.marble} {...outline} />
            <rect x={x - 2} y="67" width="14" height="4" fill={p.marble} {...outline} />
            <rect x={x - 2} y="119" width="14" height="3" fill={p.marble} {...outline} />
            <path d={`M${x + 3.3} 73v44M${x + 6.7} 73v44`} stroke="#7c5cd6" strokeOpacity="0.45" />
          </g>
        ))}
        <rect x="88" y="122" width="144" height="6" fill={p.stone} {...outline} />
        <rect x="80" y="128" width="160" height="6" fill={p.stone} {...outline} />
        {/* crowd */}
        {[
          [92, 150, 1], [104, 146, 0.9], [116, 152, 1.05], [128, 147, 0.9], [140, 151, 1],
          [152, 146, 0.88], [164, 152, 1.05], [176, 147, 0.9], [188, 151, 1], [200, 146, 0.9],
          [212, 152, 1.05], [224, 147, 0.9], [236, 150, 1],
        ].map(([x, y, s]) => (
          <Figure key={x} x={x} y={y} s={s} />
        ))}
      </>
    )}
  </Scene>
);

/** An empty throne under a shaft of light: no seat for the agent. */
export const ThroneScene = () => (
  <Scene label="An empty throne on a dais between banners and torches" glow={[160, 70]}>
    {(p) => (
      <>
        <Ground p={p} y={136} />
        <path d="M150 0h20l42 136H108z" fill={LINE} opacity="0.07" />
        {/* pillars, banners, torches */}
        <rect x="62" y="16" width="16" height="120" fill={p.stone} {...outline} />
        <rect x="242" y="16" width="16" height="120" fill={p.stone} {...outline} />
        <path d="M92 16h22v58l-11 8-11-8z" fill={p.body} {...outline} />
        <path d="M206 16h22v58l-11 8-11-8z" fill={p.body} {...outline} />
        <circle cx="103" cy="40" r="5" fill="none" stroke={PALE} strokeOpacity="0.7" />
        <circle cx="217" cy="40" r="5" fill="none" stroke={PALE} strokeOpacity="0.7" />
        <Flame x={70} y={50} p={p} />
        <Flame x={250} y={50} p={p} />
        {/* dais and carpet */}
        <rect x="110" y="124" width="100" height="8" fill={p.stone} {...outline} />
        <rect x="98" y="132" width="124" height="6" fill={p.stone} {...outline} />
        <path d="M151 160l3-36h12l3 36z" fill="#4a2f8f" />
        {/* throne */}
        <path d="M140 112V62a20 20 0 0 1 40 0v50z" fill={p.body} {...outline} />
        <path d="M148 112V66a12 12 0 0 1 24 0v46z" fill={DEEP} {...outline} />
        <path d="M160 42v-6" {...outline} />
        <circle cx="160" cy="34" r="3" fill={p.gold} />
        <circle cx="140" cy="64" r="2.5" fill={p.gold} />
        <circle cx="180" cy="64" r="2.5" fill={p.gold} />
        <path d="M128 112V92a5 5 0 0 1 10 0v20zM182 112V92a5 5 0 0 1 10 0v20z" fill={p.body} {...outline} />
        <rect x="126" y="108" width="68" height="8" rx="2" fill={p.marble} {...outline} />
        <rect x="130" y="116" width="60" height="8" fill="#4a2f8f" {...outline} />
        <path d="M160 116v8" stroke={WARM} strokeOpacity="0.7" />
      </>
    )}
  </Scene>
);

/* ── How it works ───────────────────────────────────────────────────────── */

/** An open treasure chest spilling coins: capital. */
export const TreasuryScene = () => (
  <Scene label="An open treasure chest full of gold coins">
    {(p) => (
      <>
        <Ground p={p} />
        <path d="M160 84 110 0h22zM160 84 150 0h20zM160 84 188 0h22z" fill={WARM} opacity="0.08" />
        <circle cx="160" cy="84" r="34" fill={p.fire} />
        {/* lid (open) */}
        <path d="M118 92l6-32h72l6 32z" fill="#3b2473" {...outline} />
        <path d="M130 62l-2 30M190 62l2 30" stroke={DEEP} strokeWidth="5" />
        {/* coins in the chest */}
        <path d="M118 94q20-20 42-14 22-8 42 14z" fill={p.gold} stroke="#c79a3a" />
        {[[136, 86], [150, 81], [166, 82], [180, 85], [158, 88], [192, 90], [128, 91]].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="2.4" fill="#fbeab4" stroke="#c79a3a" strokeWidth="0.8" />
        ))}
        {/* chest body */}
        <rect x="116" y="94" width="88" height="40" rx="3" fill={p.body} {...outline} />
        <rect x="127" y="94" width="7" height="40" fill={DEEP} {...outline} />
        <rect x="186" y="94" width="7" height="40" fill={DEEP} {...outline} />
        <path d="M152 100h16v12l-8 6-8-6z" fill={p.gold} stroke="#c79a3a" />
        <circle cx="160" cy="106" r="1.8" fill={INK} />
        <path d="M116 112h88" stroke={LINE} strokeOpacity="0.25" />
        {/* coins on the ground */}
        {[[96, 138], [104, 135], [100, 132], [222, 139], [214, 136], [232, 135], [140, 142], [184, 143]].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="5" ry="2.6" fill={p.gold} stroke="#c79a3a" strokeWidth="0.8" />
        ))}
        <Sparkle x={124} y={52} />
        <Sparkle x={200} y={46} s={5} />
        <Sparkle x={172} y={30} s={3} />
      </>
    )}
  </Scene>
);

const WREATH_LEAVES = Array.from({ length: 9 }, (_, i) => 105 + i * 17);

/** A gold laurel wreath over a ballot urn: shareholders elect. */
export const ElectionScene = () => (
  <Scene label="A gold laurel wreath above a ballot urn" glow={[160, 74]}>
    {(p) => (
      <>
        <Ground p={p} />
        {/* pedestal and urn */}
        <rect x="138" y="108" width="44" height="26" fill={p.marble} {...outline} />
        <rect x="134" y="104" width="52" height="5" fill={p.marble} {...outline} />
        <path d="M148 104c-6-8-6-20 2-26h20c8 6 8 18 2 26z" fill={p.body} {...outline} />
        <path d="M148 78l-2-6h28l-2 6z" fill={p.body} {...outline} />
        <path d="M146 90c-8 0-8-10-2-12M174 90c8 0 8-10 2-12" fill="none" {...outline} />
        <path d="M150 92h20" stroke={PALE} strokeOpacity="0.5" />
        {/* ballots */}
        <rect x="150" y="50" width="9" height="12" rx="1" transform="rotate(-14 154 56)" fill={p.marble} {...outline} />
        <rect x="163" y="40" width="9" height="12" rx="1" transform="rotate(12 167 46)" fill={p.marble} {...outline} />
        {/* wreath */}
        {[1, -1].map((side) => (
          <g key={side} transform={side === -1 ? 'matrix(-1 0 0 1 320 0)' : undefined}>
            <path d="M154.2 125.6A48 48 0 0 1 143.6 32.9" fill="none" stroke="#c79a3a" strokeWidth="1.6" />
            {WREATH_LEAVES.map((deg) => {
              const t = (deg * Math.PI) / 180;
              const x = 160 + 48 * Math.cos(t);
              const y = 78 + 48 * Math.sin(t);
              const r = deg + 180;
              return (
                <g key={deg} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                  <path d="M0 0C-4-3-5-8 0-13 5-8 4-3 0 0z" fill={p.gold} stroke="#c79a3a" strokeWidth="0.6" transform={`rotate(${r - 40})`} />
                  <path d="M0 0C-4-3-5-8 0-13 5-8 4-3 0 0z" fill={p.gold} stroke="#c79a3a" strokeWidth="0.6" transform={`rotate(${r + 40})`} />
                </g>
              );
            })}
          </g>
        ))}
        <path d="M160 126l-10 16 2-8-6 2M160 126l10 16-2-8 6 2" fill="none" stroke="#a685f5" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="160" cy="126" r="3.5" fill="#7c5cd6" stroke={LINE} />
        <Sparkle x={112} y={26} s={3} />
        <Sparkle x={210} y={22} s={4} />
      </>
    )}
  </Scene>
);

/** A jewelled crown on a velvet cushion: a filled seat. */
export const CrownScene = () => (
  <Scene label="A jewelled crown resting on a velvet cushion" glow={[160, 70]}>
    {(p) => (
      <>
        <Ground p={p} />
        <path d="M146 0h28l26 110h-80z" fill={LINE} opacity="0.07" />
        {/* pedestal */}
        <rect x="136" y="112" width="48" height="22" fill={p.marble} {...outline} />
        <rect x="130" y="108" width="60" height="5" fill={p.marble} {...outline} />
        <path d="M144 116v16M152 116v16M160 116v16M168 116v16M176 116v16" stroke="#7c5cd6" strokeOpacity="0.45" />
        {/* cushion */}
        <path d="M110 98q50-12 100 0 6 6 0 12-50 10-100 0-6-6 0-12z" fill={p.body} {...outline} />
        <path d="M110 98l-6 10M210 98l6 10M110 110l-6 8M210 110l6 8" stroke={WARM} strokeWidth="1.2" />
        <circle cx="103" cy="109" r="2" fill={p.gold} />
        <circle cx="217" cy="109" r="2" fill={p.gold} />
        {/* crown */}
        <path d="M132 86q28-50 56 0z" fill="#4a2f8f" />
        <path d="M128 88 124 54l9 18 9-26 9 24 9-30 9 30 9-24 9 26 9-18-4 34z" fill={p.gold} stroke="#c79a3a" strokeWidth="1" strokeLinejoin="round" />
        <rect x="126" y="86" width="68" height="13" rx="2" fill={p.gold} stroke="#c79a3a" />
        {[[124, 51], [142, 43], [160, 37], [178, 43], [196, 51]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3" fill={PALE} stroke="#c79a3a" strokeWidth="0.8" />
        ))}
        <circle cx="160" cy="92.5" r="4" fill="#7c5cd6" stroke={PALE} strokeWidth="0.8" />
        <path d="M142 89l3.5 3.5-3.5 3.5-3.5-3.5zM178 89l3.5 3.5-3.5 3.5-3.5-3.5z" fill="#a685f5" stroke={PALE} strokeWidth="0.6" />
        <circle cx="160" cy="70" r="2.5" fill="#a685f5" />
        <Sparkle x={112} y={40} />
        <Sparkle x={212} y={34} s={5} />
        <Sparkle x={196} y={70} s={3} />
      </>
    )}
  </Scene>
);

/** A sealed decree on a writing desk by candlelight: the board acts. */
export const DecreeScene = () => (
  <Scene label="A decree with a wax seal on a desk beside a quill and candle" glow={[160, 92]}>
    {(p) => (
      <>
        {/* desk */}
        <rect x="0" y="118" width="320" height="42" fill="#1b1433" />
        <rect x="0" y="116" width="320" height="6" fill="#3b2473" stroke={LINE} strokeWidth="1" />
        {/* candle */}
        <circle cx="262" cy="70" r="30" fill={p.fire} />
        <rect x="256" y="84" width="12" height="32" rx="1" fill={p.marble} {...outline} />
        <path d="M250 116h24l-3-4h-18z" fill={p.stone} {...outline} />
        <path d="M262 84v-4" stroke={INK} />
        <path d="M262 68c4 5 5 8 3 11a4 4 0 0 1-6 0c-2-3-1-6 3-11z" fill={p.gold} stroke={WARM} strokeWidth="0.8" />
        {/* parchment */}
        <path d="M92 116l12-44h112l12 44z" fill={p.marble} {...outline} />
        <rect x="88" y="112" width="144" height="7" rx="3.5" fill="#c9bce8" {...outline} />
        <rect x="100" y="68" width="120" height="6" rx="3" fill="#c9bce8" {...outline} />
        <path d="M118 80h66M116 86h88M114 92h80M112 98h56" stroke="#7c5cd6" strokeOpacity="0.7" />
        <path d="M120 108h30" stroke="#4a2f8f" strokeWidth="1.4" />
        {/* wax seal */}
        <path d="M194 110l-5 22 5-3 4 4 1-18M206 110l5 22-5-3-4 4-1-18" fill="#7c5cd6" stroke={LINE} strokeWidth="0.8" />
        <circle cx="200" cy="104" r="9" fill="#5a3aa8" stroke={LINE} />
        <circle cx="200" cy="104" r="5.5" fill="none" stroke={PALE} strokeOpacity="0.7" />
        <path d="M200 100.5l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" fill={PALE} />
        {/* inkwell and quill */}
        <path d="M54 116v-10a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v10z" fill={INK} {...outline} />
        <path d="M60 102v-3h8v3" fill={p.stone} {...outline} />
        <path d="M66 100C60 80 50 56 32 34c8 2 18 10 24 22 6 12 10 28 10 44z" fill={PALE} {...outline} />
        <path d="M64 96C58 78 48 56 34 37" stroke="#7c5cd6" strokeOpacity="0.7" />
      </>
    )}
  </Scene>
);

/* ── A board you can audit ──────────────────────────────────────────────── */

/** Stone tablets of public law, lit by torches: published rules anyone can read. */
export const TabletsScene = () => (
  <Scene label="Two stone tablets of law between torches, with people reading them">
    {(p) => (
      <>
        <Ground p={p} />
        <path d="M104 126V48a12 12 0 0 1 12-12h28a12 12 0 0 1 12 12v78z" fill={p.marble} {...outline} />
        <path d="M164 126V48a12 12 0 0 1 12-12h28a12 12 0 0 1 12 12v78z" fill={p.marble} {...outline} />
        <text x="130" y="54" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="10" fill="#4a2f8f">I – VI</text>
        <text x="190" y="54" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="10" fill="#4a2f8f">VII – XII</text>
        <path d="M112 64h36M112 72h32M112 80h36M112 88h28M112 96h36M112 104h30M112 112h34M172 64h36M172 72h30M172 80h36M172 88h32M172 96h36M172 104h28M172 112h34" stroke="#7c5cd6" strokeOpacity="0.65" />
        <rect x="96" y="126" width="128" height="8" fill={p.stone} {...outline} />
        <Torch x={68} top={66} bottom={134} p={p} />
        <Torch x={252} top={66} bottom={134} p={p} />
        <Figure x={118} y={150} />
        <Figure x={202} y={150} s={0.95} />
        <Figure x={160} y={152} s={1.05} />
      </>
    )}
  </Scene>
);

/** A shield over crossed swords, with a broken key below: no owner key. */
export const ShieldScene = () => (
  <Scene label="A quartered shield over crossed swords, with a broken key beneath">
    {(p) => (
      <>
        <rect x="0" y="0" width="320" height="140" fill={p.stone} opacity="0.35" />
        <path
          d="M0 20h320M0 40h320M0 60h320M0 80h320M0 100h320M0 120h320M40 0v20M120 0v20M200 0v20M280 0v20M80 20v20M160 20v20M240 20v20M40 40v20M280 40v20M80 60v20M240 60v20M40 80v20M280 80v20M80 100v20M240 100v20M40 120v20M280 120v20"
          stroke={LINE}
          strokeOpacity="0.12"
        />
        <Ground p={p} y={140} />
        {/* banners */}
        <path d="M40 0h26v70l-13-10-13 10z" fill={p.body} {...outline} />
        <path d="M254 0h26v70l-13-10-13 10z" fill={p.body} {...outline} />
        {/* swords */}
        {[1, -1].map((side) => (
          <g key={side} transform={side === -1 ? 'matrix(-1 0 0 1 320 0)' : undefined}>
            <path d="M110 30l102 102 4 6-6-4L108 32z" fill={PALE} stroke={LINE} strokeWidth="0.8" />
            <path d="M100 38l16-16" stroke={p.gold} strokeWidth="4" strokeLinecap="round" />
            <path d="M106 26l-8-8" stroke="#4a2f8f" strokeWidth="4" strokeLinecap="round" />
            <circle cx="96" cy="16" r="3.5" fill={p.gold} />
          </g>
        ))}
        {/* shield */}
        <path d="M160 28l40 12v36c0 26-16 44-40 54-24-10-40-28-40-54V40z" fill={p.body} {...outline} />
        <path d="M160 36v44h-32V46zM160 80h32c-1 20-14 35-32 43z" fill={DEEP} />
        <path d="M160 36l32 10v30c0 22-13 38-32 47-19-9-32-25-32-47V46z" fill="none" stroke={PALE} strokeOpacity="0.55" />
        <path d="M160 36v87M128 80h64" stroke={PALE} strokeOpacity="0.55" />
        <circle cx="160" cy="80" r="7" fill={p.gold} stroke="#c79a3a" />
        {/* broken key */}
        <g transform="rotate(-8 128 148)">
          <circle cx="118" cy="148" r="5" fill="none" stroke={WARM} strokeWidth="2.2" />
          <path d="M123 148h17" stroke={WARM} strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <g transform="rotate(14 170 148)">
          <path d="M162 148h22M178 148v5M184 148v4" stroke={WARM} strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <path d="M150 140l2 4M156 152l3 2" stroke={WARM} strokeOpacity="0.6" />
      </>
    )}
  </Scene>
);

const Gear = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g opacity="0.35">
    <circle cx={x} cy={y} r={r} fill="none" stroke={LINE} strokeWidth="5" strokeDasharray="3.5 3.5" />
    <circle cx={x} cy={y} r={r - 3} fill="none" stroke={LINE} strokeWidth="1.2" />
    <circle cx={x} cy={y} r={r / 3} fill="none" stroke={LINE} strokeWidth="1.2" />
  </g>
);

/** A plumed Roman helmet with glowing eyes on an armour stand: an agent director. */
export const AutomatonScene = () => (
  <Scene label="A plumed Roman helmet on an armour stand, with glowing eyes inside" glow={[160, 90]}>
    {(p) => (
      <>
        <Gear x={70} y={60} r={20} />
        <Gear x={252} y={92} r={14} />
        <Gear x={96} y={104} r={10} />
        <Ground p={p} y={140} />
        {/* stand and shoulders */}
        <rect x="156" y="136" width="8" height="10" fill={p.stone} {...outline} />
        <ellipse cx="160" cy="148" rx="26" ry="4" fill={p.stone} {...outline} />
        <path d="M104 138q4-22 56-22t56 22z" fill={p.body} {...outline} />
        <path d="M118 132q42-14 84 0" fill="none" stroke={PALE} strokeOpacity="0.4" />
        {/* crest */}
        <path d="M122 72q4-46 38-50 34 4 38 50h-10q-4-34-28-38-24 4-28 38z" fill="#5a3aa8" {...outline} />
        <path d="M128 60l8 4M134 44l8 7M146 32l5 9M160 28v10M174 32l-5 9M186 44l-8 7M192 60l-8 4" stroke={PALE} strokeOpacity="0.55" />
        {/* helmet */}
        <path d="M124 92a36 36 0 0 1 72 0z" fill={p.body} {...outline} />
        <path d="M160 58v34M136 80h8l4-6h10M184 80h-8l-4-6h-10" fill="none" stroke={PALE} strokeOpacity="0.45" />
        <circle cx="148" cy="74" r="1.4" fill={PALE} opacity="0.6" />
        <circle cx="172" cy="74" r="1.4" fill={PALE} opacity="0.6" />
        <path d="M140 96h40v26h-40z" fill={INK} />
        <rect x="118" y="88" width="84" height="9" rx="2" fill={p.gold} stroke="#c79a3a" />
        <path d="M126 97v20l14 9V97zM194 97v20l-14 9V97z" fill={p.body} {...outline} />
        <circle cx="132" cy="108" r="1.6" fill={p.gold} />
        <circle cx="188" cy="108" r="1.6" fill={p.gold} />
        <path d="M118 97l-8 10M202 97l8 10" {...outline} strokeWidth={2} />
        {/* glowing eyes */}
        <circle cx="151" cy="106" r="9" fill={p.glow} />
        <circle cx="169" cy="106" r="9" fill={p.glow} />
        <circle cx="151" cy="106" r="2.6" fill={PALE} />
        <circle cx="169" cy="106" r="2.6" fill={PALE} />
      </>
    )}
  </Scene>
);
