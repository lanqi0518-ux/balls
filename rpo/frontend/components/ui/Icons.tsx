import { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const svg = (path: React.ReactNode) => (props: P) =>
  (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      {...props}
    >
      {path}
    </svg>
  );

export const ArrowRight = svg(
  <>
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </>
);
export const ArrowUpRight = svg(
  <>
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </>
);
export const Check = svg(<path d="M4 12l5 5L20 6" />);
export const Menu = svg(
  <>
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
  </>
);
export const X = svg(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>
);
export const ChevronDown = svg(<path d="M6 9l6 6 6-6" />);
export const Chart = svg(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </>
);
export const Shield = svg(
  <>
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
    <path d="M9 12l2 2 4-4" />
  </>
);
export const Layers = svg(
  <>
    <path d="M12 2 2 8l10 6 10-6-10-6z" />
    <path d="M2 16l10 6 10-6" />
    <path d="M2 12l10 6 10-6" />
  </>
);
export const Bolt = svg(<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />);
export const Lock = svg(
  <>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>
);
export const Globe = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
  </>
);
export const Coin = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8M12 8v8" />
  </>
);
export const Wallet = svg(
  <>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M16 13h2" />
    <path d="M3 10h18" />
  </>
);
export const Calendar = svg(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </>
);
export const Trophy = svg(
  <>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
    <path d="M17 4h3v2a3 3 0 0 1-3 3M7 4H4v2a3 3 0 0 0 3 3" />
  </>
);
export const Zap = Bolt;
export const Circle = svg(<circle cx="12" cy="12" r="9" />);
export const Discord = svg(
  <>
    <path d="M20 5.5A18 18 0 0 0 15 4l-.3.6a15 15 0 0 0-5.4 0L9 4a18 18 0 0 0-5 1.5C1 10 0 14 0 18a20 20 0 0 0 5 2l1-2c-1 0-2-.4-3-1 .3 0 .6-.2.8-.4 4 2 8 2 12 0 .2.2.5.4.8.4-1 .6-2 1-3 1l1 2a20 20 0 0 0 5-2c0-4-1-8-4-12.5zM8.5 15c-1 0-2-1-2-2.2 0-1.2 1-2.2 2-2.2s2 1 2 2.2c0 1.2-.9 2.2-2 2.2zm7 0c-1 0-2-1-2-2.2 0-1.2 1-2.2 2-2.2s2 1 2 2.2c0 1.2-.9 2.2-2 2.2z" fill="currentColor" stroke="none" />
  </>
);
export const Twitter = svg(
  <path d="M22 5.8c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.8-2.3c-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.9 3.7A11.5 11.5 0 0 1 3.4 4.4a4 4 0 0 0 1.3 5.4c-.7 0-1.3-.2-1.8-.5v.1c0 2 1.4 3.7 3.3 4a4 4 0 0 1-1.8.1c.5 1.6 2 2.8 3.8 2.8A8 8 0 0 1 2 17.9a11.4 11.4 0 0 0 6.1 1.8c7.4 0 11.4-6.1 11.4-11.4v-.5c.8-.6 1.5-1.3 2-2z" fill="currentColor" stroke="none" />
);
export const Github = svg(
  <path d="M12 2a10 10 0 0 0-3.2 19.5c.5 0 .7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9 0-.7.4-1.2.7-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7 0-.3-.5-1.4.1-2.8 0 0 .9-.3 2.8 1a9.7 9.7 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .6 1.4.2 2.5.1 2.8.7.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor" stroke="none" />
);
export const Book = svg(
  <>
    <path d="M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" />
    <path d="M4 16a4 4 0 0 1 4-4h11" />
  </>
);
export const Sparkles = svg(
  <>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
  </>
);
