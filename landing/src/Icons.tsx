import React from 'react';

/*
 * Medieval and Roman icons for the landing page cards.
 * 48×48, two-tone: currentColor strokes over translucent currentColor fills,
 * so they follow the accent colour of whatever badge they sit in.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

const light = { fill: 'currentColor', fillOpacity: 0.14 };
const mid = { fill: 'currentColor', fillOpacity: 0.28 };
const dark = { fill: 'currentColor', fillOpacity: 0.45 };

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Castle gatehouse with a lowered portcullis: a fixed, closed list. */
export const Portcullis = (p: IconProps) => (
  <Svg {...p}>
    <path {...light} d="M4 44V8h3.5v3h4V8H15v8h3v-3h3.5v3h5v-3H30v3h3V8h3.5v3h4V8H44v36z" />
    <path {...dark} d="M17 44V30a7 7 0 0 1 14 0v14z" />
    <path d="M20.5 24V44M24 23V44M27.5 24V44M17 33h14M17 38.5h14" />
    <path d="M9.5 19v5M38.5 19v5M15 16h18" />
    <path d="M2 44h44" />
  </Svg>
);

/** Roman temple front: the public forum. */
export const Forum = (p: IconProps) => (
  <Svg {...p}>
    <path {...mid} d="M5 16 24 5l19 11z" />
    <circle cx="24" cy="12" r="2" />
    <path {...dark} d="M5 16h38v4H5z" />
    <path {...light} d="M8 21h4v16H8zM17.5 21h4v16h-4zM26.5 21h4v16h-4zM36 21h4v16h-4z" />
    <path d="M7 21h6M16.5 21h6M25.5 21h6M35 21h6" />
    <path {...mid} d="M5 37h38v3H5z" />
    <path {...light} d="M3 40h42v4H3z" />
  </Svg>
);

/** An empty throne: no seat for the agent. */
export const Throne = (p: IconProps) => (
  <Svg {...p}>
    <path {...light} d="M14 30V15a10 10 0 0 1 20 0v15" />
    <path {...dark} d="M18.5 30V16.5a5.5 5.5 0 0 1 11 0V30z" />
    <path d="M24 5V3" />
    <circle cx="24" cy="2.2" r="1" />
    <path {...mid} d="M8 30v-8a2.5 2.5 0 0 1 5 0v8zM35 30v-8a2.5 2.5 0 0 1 5 0v8z" />
    <path {...mid} d="M6.5 30h35v5h-35z" />
    <path {...light} d="M9 35h30v3.5H9z" />
    <path d="M10.5 38.5V44M37.5 38.5V44M8.5 44h4M35.5 44h4" />
    <path d="M17 19.5h14" strokeOpacity={0.5} />
  </Svg>
);

/** Iron-banded treasure chest: the treasury. */
export const Chest = (p: IconProps) => (
  <Svg {...p}>
    <path {...mid} d="M6 20v-3a9 9 0 0 1 9-9h18a9 9 0 0 1 9 9v3z" />
    <rect {...light} x="6" y="20" width="36" height="20" rx="1.5" />
    <path d="M14 8.2V40M34 8.2V40" />
    <path {...dark} d="M20 18h8v9l-4 3-4-3z" />
    <circle cx="24" cy="22" r="1.3" />
    <path d="M24 23.3v2.5" />
    <g fill="currentColor" stroke="none">
      <circle cx="14" cy="13" r="1" />
      <circle cx="34" cy="13" r="1" />
      <circle cx="14" cy="25" r="1" />
      <circle cx="34" cy="25" r="1" />
      <circle cx="14" cy="35" r="1" />
      <circle cx="34" cy="35" r="1" />
    </g>
    <path d="M8 40v3h4v-3M36 40v3h4v-3" />
  </Svg>
);

const LEAVES: [number, number, number][] = [
  [16.8, 38.4, -65],
  [11, 33.9, -40],
  [7.6, 27.4, -15],
  [7.3, 20, 10],
  [10.1, 13.2, 35],
  [15.5, 8.3, 60],
];
const LEAF = 'M0 0C-2.6-1.8-3.2-4.8 0-7.5 3.2-4.8 2.6-1.8 0 0z';

function LaurelBranch() {
  return (
    <g>
      <path d="M18.2 39A17 17 0 0 1 16.8 7.6" />
      {LEAVES.map(([x, y, r]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path {...mid} d={LEAF} transform={`rotate(${r - 38})`} />
          <path {...light} d={LEAF} transform={`rotate(${r + 38})`} />
        </g>
      ))}
    </g>
  );
}

/** Laurel wreath tied with a ribbon: the victor of an election. */
export const Laurel = (p: IconProps) => (
  <Svg {...p}>
    <LaurelBranch />
    <g transform="matrix(-1 0 0 1 48 0)">
      <LaurelBranch />
    </g>
    <path {...dark} d="M24 40.5 19.5 46.5l-1-3.5M24 40.5l4.5 6 1-3.5" />
    <circle {...dark} cx="24" cy="40.5" r="1.8" />
    <path {...mid} d="M24 15.5l2 4.2 4.5.6-3.3 3.1.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.1 4.5-.6z" />
  </Svg>
);

/** Jewelled crown: a filled board seat. */
export const Crown = (p: IconProps) => (
  <Svg {...p}>
    <path {...light} d="M9 32 6.5 15 13 24l2.5-13L20 22l4-15 4 15 4.5-11L35 24l6.5-9L39 32z" />
    <g {...mid}>
      <circle cx="6.5" cy="13.2" r="1.8" />
      <circle cx="15.5" cy="9.2" r="1.8" />
      <circle cx="24" cy="5.2" r="1.8" />
      <circle cx="32.5" cy="9.2" r="1.8" />
      <circle cx="41.5" cy="13.2" r="1.8" />
    </g>
    <rect {...dark} x="8.5" y="32" width="31" height="6.5" rx="1" />
    <circle cx="24" cy="35.25" r="1.7" />
    <path d="M16 33.5l1.75 1.75L16 37l-1.75-1.75zM32 33.5l1.75 1.75L32 37l-1.75-1.75z" />
    <path d="M24 17v4M22 19h4" strokeOpacity={0.6} />
    <path d="M11 42.5h26" strokeOpacity={0.5} />
  </Svg>
);

/** Decree under a wax seal: the board acts. */
export const Decree = (p: IconProps) => (
  <Svg {...p}>
    <path {...light} d="M9 4h22l8 8v32H9z" />
    <path {...mid} d="M31 4v8h8" />
    <path d="M14 12h12M14 17h20M14 21.5h20M14 26h12" />
    <path {...dark} d="M24.2 39.5 21.5 47l3-1 2 2.5 1.2-7M31.8 39.5 34.5 47l-3-1-2 2.5-1.2-7" />
    <circle {...dark} cx="28" cy="35" r="6" />
    <circle cx="28" cy="35" r="4" strokeOpacity={0.6} />
    <path fill="currentColor" stroke="none" d="M28.00 32.40L28.65 34.11L30.47 34.20L29.05 35.34L29.53 37.10L28.00 36.10L26.47 37.10L26.95 35.34L25.53 34.20L27.35 34.11z" />
  </Svg>
);

/** Open scroll on wooden rods: the published rules. */
export const Scroll = (p: IconProps) => (
  <Svg {...p}>
    <path {...light} d="M10 10h28v28H10z" />
    <rect {...dark} x="8" y="5" width="32" height="5" rx="2.5" />
    <rect {...dark} x="8" y="38" width="32" height="5" rx="2.5" />
    <path d="M5 7.5h3M40 7.5h3M5 40.5h3M40 40.5h3" />
    <g fill="currentColor" stroke="none">
      <circle cx="4.5" cy="7.5" r="1.6" />
      <circle cx="43.5" cy="7.5" r="1.6" />
      <circle cx="4.5" cy="40.5" r="1.6" />
      <circle cx="43.5" cy="40.5" r="1.6" />
    </g>
    <path d="M18 15.5h12" strokeWidth={2.2} />
    <path d="M15 21h18M15 25.5h18M15 30h12" />
    <path d="M30 31.5l1.5 1.5 3-3.5" />
  </Svg>
);

/** Quartered shield over crossed swords: no key outside the board. */
export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="5.5" r="1.5" />
    <path d="M6.6 6.6 9.5 9.5M7.2 12.2l5-5M9.5 9.5l2.8 2.8M35.3 35.3 41 41" />
    <circle cx="42.5" cy="5.5" r="1.5" />
    <path d="M41.4 6.6 38.5 9.5M40.8 12.2l-5-5M38.5 9.5l-2.8 2.8M12.7 35.3 7 41" />
    <path {...light} d="M24 8l14 5v11c0 10-6 17-14 20-8-3-14-10-14-20V13z" />
    <path {...dark} d="M24 11.5V24H13v-8.5zM24 24h11c0 8-4.8 13.6-11 16.3z" />
    <path d="M24 11.5l11 4V24c0 8-4.8 13.6-11 16.3C17.8 37.6 13 32 13 24v-8.5z" strokeOpacity={0.6} />
    <path d="M24 11.5v28.8M13 24h22" strokeOpacity={0.6} />
  </Svg>
);

/** Plumed Roman helmet: any wallet can wear the seat. */
export const Helmet = (p: IconProps) => (
  <Svg {...p}>
    <path {...dark} d="M10 16C11 7 17 2.5 24 2.5S37 7 38 16h-4C33 10 29 7 24 7S15 10 14 16z" />
    <path d="M14.5 8.5l2.5 3M19 5l1.5 3.5M24 3.5V7M29 5l-1.5 3.5M33.5 8.5l-2.5 3" strokeOpacity={0.7} />
    <path {...light} d="M10 28a14 14 0 0 1 28 0z" />
    <path d="M24 14v13M16 21a10 10 0 0 1 16 0" strokeOpacity={0.5} />
    <rect {...dark} x="7" y="27" width="34" height="4" rx="1" />
    <path {...mid} d="M11 31v8l6 4.5V31zM37 31v8l-6 4.5V31z" />
    <path d="M7 31l-3 4M41 31l3 4" />
    <g fill="currentColor" stroke="none">
      <circle cx="14" cy="35.5" r="1" />
      <circle cx="34" cy="35.5" r="1" />
    </g>
  </Svg>
);

/** Framed medallion the card icons sit in. */
export function IconBadge({ icon: Icon }: { icon: (p: IconProps) => React.ReactElement }) {
  return (
    <span className="relative inline-flex w-[72px] h-[72px] items-center justify-center rounded-xl border border-accent-500/35 bg-gradient-to-b from-accent-600/35 to-accent-700/10 text-accent-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="absolute inset-[3px] rounded-[9px] border border-accent-500/15" />
      <Icon className="relative w-12 h-12" />
    </span>
  );
}
