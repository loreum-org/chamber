import React from 'react';

/*
 * Medieval and Roman line icons for the landing page cards.
 * 24×24, stroke-only, currentColor — drawn to sit beside lucide icons.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Castle gate with a lowered portcullis: a fixed, closed list. */
export const Portcullis = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V10a8 8 0 0 1 16 0v11" />
    <path d="M8 3.5V21M12 2.5V21M16 3.5V21" />
    <path d="M4 11h16M4 16h16" />
    <path d="M2 21h20" />
  </Svg>
);

/** Roman temple front: the public forum. */
export const Forum = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h18L12 3.5z" />
    <path d="M6 11.5v6M10 11.5v6M14 11.5v6M18 11.5v6" />
    <path d="M4 18h16M2.5 21h19" />
  </Svg>
);

/** An empty throne: no seat for the agent. */
export const Throne = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 13V7a4.5 4.5 0 0 1 9 0v6" />
    <path d="M10.25 13V8.5a1.75 1.75 0 0 1 3.5 0V13" />
    <path d="M4 10.5h3.5M16.5 10.5H20M4.5 10.5V13M19.5 10.5V13" />
    <path d="M3.5 13h17v2.5h-17z" />
    <path d="M5.5 15.5V21M18.5 15.5V21M5.5 19h13" />
  </Svg>
);

/** Iron-banded treasure chest: the treasury. */
export const Chest = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10V8.5A4.5 4.5 0 0 1 7.5 4h9A4.5 4.5 0 0 1 21 8.5V10" />
    <path d="M3 10h18v10H3z" />
    <path d="M7.5 4v16M16.5 4v16" />
    <path d="M10.5 11.5h3v3.5h-3z" />
  </Svg>
);

/** Laurel wreath: the victor of an election. */
export const Laurel = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 20.5C6.5 20 3.5 16.4 3.5 12c0-2.3.7-4.4 2-6" />
    <path d="M13 20.5c4.5-.5 7.5-4.1 7.5-8.5 0-2.3-.7-4.4-2-6" />
    <path d="M5.5 6c-1.4-.2-2.3-1.2-2.4-2.6 1.4 0 2.4.9 2.4 2.6z" />
    <path d="M3.9 10.2C2.6 9.8 1.9 8.6 2.1 7.2c1.3.4 2 1.6 1.8 3z" />
    <path d="M4.3 14.6c-1.3-.1-2.3-1.1-2.4-2.5 1.4 0 2.4 1 2.4 2.5z" />
    <path d="M6.6 18.3c-1.3.3-2.6-.3-3.1-1.6 1.3-.4 2.6.2 3.1 1.6z" />
    <path d="M18.5 6c1.4-.2 2.3-1.2 2.4-2.6-1.4 0-2.4.9-2.4 2.6z" />
    <path d="M20.1 10.2c1.3-.4 2-1.6 1.8-3-1.3.4-2 1.6-1.8 3z" />
    <path d="M19.7 14.6c1.3-.1 2.3-1.1 2.4-2.5-1.4 0-2.4 1-2.4 2.5z" />
    <path d="M17.4 18.3c1.3.3 2.6-.3 3.1-1.6-1.3-.4-2.6.2-3.1 1.6z" />
    <path d="M11 20.5l-1.5 2M13 20.5l1.5 2" />
  </Svg>
);

/** Crown: a filled board seat. */
export const Crown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8l4 4 4.5-6.5 4.5 6.5 4-4-1.5 10h-14z" />
    <path d="M5.5 15h13" />
    <circle cx="3.5" cy="7" r="1" />
    <circle cx="12" cy="4.5" r="1" />
    <circle cx="20.5" cy="7" r="1" />
  </Svg>
);

/** Decree under a wax seal: the board acts. */
export const Decree = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 2.5h10l4 4v15H5z" />
    <path d="M15 2.5v4h4" />
    <path d="M8 8h5M8 11h8" />
    <circle cx="12" cy="15.5" r="2.5" />
    <path d="M10.6 17.6 10 21l2-1 2 1-.6-3.4" />
  </Svg>
);

/** Open scroll: the published rules. */
export const Scroll = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3" width="17" height="3" rx="1.5" />
    <rect x="3.5" y="18" width="17" height="3" rx="1.5" />
    <path d="M5.5 6v12M18.5 6v12" />
    <path d="M9 9.5h6M9 12h6M9 14.5h4" />
  </Svg>
);

/** Heater shield with a cross: no key outside the board. */
export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5l7.5 3V11c0 5-3.2 8.6-7.5 10.5C7.7 19.6 4.5 16 4.5 11V5.5z" />
    <path d="M12 6v12M7.5 10.5h9" />
  </Svg>
);

/** Plumed Roman helmet: any wallet can wear the seat. */
export const Helmet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7.5C8 4 10 2.5 12 2.5s4 1.5 5 5" />
    <path d="M9.3 4.4 10.3 7M12 2.5V7M14.7 4.4 13.7 7" />
    <path d="M5 15a7 7 0 0 1 14 0" />
    <path d="M3.5 15h17" />
    <path d="M5.5 15v3.5l3 2V15M18.5 15v3.5l-3 2V15" />
  </Svg>
);

/** Square frame the card icons sit in. */
export function IconBadge({ icon: Icon }: { icon: (p: IconProps) => React.ReactElement }) {
  return (
    <span className="inline-flex w-10 h-10 items-center justify-center rounded-md border border-accent-500/30 bg-accent-600/15 text-accent-300">
      <Icon className="w-6 h-6" />
    </span>
  );
}
