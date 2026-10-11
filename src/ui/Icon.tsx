import type { ReactNode } from "react";

export type IconName =
  | "plane"
  | "layers"
  | "target"
  | "play"
  | "pause"
  | "expand"
  | "collapse"
  | "slice"
  | "viewPlan"
  | "viewSide"
  | "viewFront"
  | "cube"
  | "perspective"
  | "single"
  | "splitV"
  | "splitH"
  | "overlay"
  | "link"
  | "swap"
  | "help"
  | "close"
  | "chevronDown"
  | "arrowRight"
  | "book"
  | "ruler"
  | "panelLeft"
  | "panelRight"
  | "chart"
  | "gauge"
  | "flight"
  | "check"
  | "info"
  | "keyboard"
  | "settings"
  | "reset"
  | "mouse";

const PATHS: Record<IconName, ReactNode> = {
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  layers: (
    <>
      <path d="m12 2.7 9 4.6-9 4.6-9-4.6z" />
      <path d="m3 12 9 4.6 9-4.6" />
      <path d="m3 16.7 9 4.6 9-4.6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  expand: (
    <>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </>
  ),
  collapse: (
    <>
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </>
  ),
  slice: (
    <>
      <path d="M12 2v20" strokeDasharray="2 2.5" />
      <rect x="3" y="6" width="18" height="12" rx="2" />
    </>
  ),
  viewPlan: (
    <>
      <path d="M12 2.5v19" />
      <path d="M3 11.5 12 9l9 2.5" />
      <path d="M8.5 20 12 18.5l3.5 1.5" />
    </>
  ),
  viewSide: (
    <>
      <path d="M2.5 13.5h15.5c2 0 3.5-.8 3.5-1.8S20 10 18 10H6L3.5 6.5H2.5z" />
      <path d="M9 13.5 11.5 17" />
    </>
  ),
  viewFront: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12.5h7" />
      <path d="M15 12.5h7" />
      <path d="M12 3v6" />
      <circle cx="6.5" cy="14.5" r="1.4" />
      <circle cx="17.5" cy="14.5" r="1.4" />
    </>
  ),
  cube: (
    <>
      <path d="m12 2.5 8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z" />
      <path d="M12 12v9.5" />
      <path d="m3.5 7.25 8.5 4.75 8.5-4.75" />
    </>
  ),
  perspective: (
    <>
      <path d="M4 5.5 20 3v18L4 18.5z" />
      <path d="M4 12h16" />
      <path d="M12 4.2v15.6" />
    </>
  ),
  single: <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />,
  splitV: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M12 4.5v15" />
    </>
  ),
  splitH: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 12h17" />
    </>
  ),
  overlay: (
    <>
      <rect x="3" y="3" width="13" height="13" rx="2.5" />
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  swap: (
    <>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5V5a2.5 2.5 0 0 1 2.5-2.5H20v17H6.5A2.5 2.5 0 0 0 4 22" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M9 7h7" />
    </>
  ),
  ruler: (
    <>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </>
  ),
  panelLeft: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </>
  ),
  panelRight: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M15 4v16" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" />
      <path d="M12 16V8" />
      <path d="M17 16v-6" />
    </>
  ),
  gauge: (
    <>
      <path d="M12 14l4-4" />
      <path d="M3.3 19a10 10 0 1 1 17.4 0" />
    </>
  ),
  flight: (
    <>
      <path d="M2 20h20" />
      <path d="M4.5 15.5 9 14l9.5-6.5c1.2-.8 2.8-.5 3 .3.2.7-.3 1.4-1.2 2L10 16.5l-5.5 1z" />
      <path d="m8 11 2.5 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16v-5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M6.5 9.5h.01M10 9.5h.01M14 9.5h.01M17.5 9.5h.01M6.5 13h.01M17.5 13h.01" strokeWidth="2.4" />
      <path d="M9.5 13h5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h10" />
      <path d="M18 6h2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M4 12h2" />
      <path d="M10 12h10" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 18h8" />
      <path d="M16 18h4" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  mouse: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="6" />
      <path d="M12 7v4" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
