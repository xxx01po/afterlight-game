import type { ReactNode } from 'react';

const P = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const Icon = {
  hand: P(<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L5 15.5a1.6 1.6 0 0 1 2.4-2.1L8 14" />),
  door: P(<><path d="M5 21V4l9-1v18" /><path d="M14 4h5v17M3 21h18" /><circle cx="11.5" cy="12.5" r=".6" /></>),
  locked: P(<><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  read: P(<><path d="M4 4h11l5 5v11H4z" /><path d="M15 4v5h5M8 13h8M8 17h6" /></>),
  take: P(<><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M4 21h16" /></>),
  use: P(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>),
  talk: P(<><rect x="8" y="6" width="8" height="15" rx="1" /><path d="M14 6V2M10 10h4M10 13h4" /></>),
  look: P(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  flashlight: P(<><path d="M7 2h10v5l-3 4v11h-4V11L7 7z" /><path d="M7 7h10" /></>),
  run: P(<><circle cx="14" cy="4" r="2" /><path d="M7 21l3-6 3 2v4M6 12l3-4 4 1 2 4 4 1M10 15l-3-1" /></>),
  crouch: P(<><circle cx="12" cy="5" r="2" /><path d="M8 21l2-5h4l1 5M7 13l4-4 4 3 3-1M10 16l-1-4" /></>),
  bag: P(<><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  pause: P(<><path d="M9 5v14M15 5v14" /></>),
  journal: P(<><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z" /><path d="M5 19a2 2 0 0 1 2-2h12M9 7h6" /></>),
  battery: P(<><rect x="3" y="7" width="16" height="10" rx="1" /><path d="M21 10v4" /></>),
  heart: P(<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />),
  medkit: P(<><rect x="3" y="7" width="18" height="13" rx="1" /><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7" /></>),
  key: P(<><circle cx="7" cy="14" r="4" /><path d="M10 12l10-8m-4 3 3 3m-6-1 2 2" /></>),
  fuse: P(<><rect x="6" y="8" width="12" height="8" rx="3" /><path d="M2 12h4m12 0h4" /></>),
  tool: P(<><path d="M14 4l6 6-9 9H5v-6z" /><path d="M13 7l4 4" /></>),
  card: P(<><rect x="3" y="6" width="18" height="12" rx="1" /><circle cx="8" cy="12" r="2" /><path d="M13 10h5M13 14h3" /></>),
  gun: P(<><path d="M3 8h15l3 3v2h-8l-2 7H7l1-7H3z" /></>),
  ammo: P(<><path d="M8 21V9l2-5 2 5v12zM14 21V9l2-5 2 5v12z" /></>),
  radio: P(<><rect x="7" y="7" width="10" height="14" rx="1" /><path d="M15 7V2M10 11h4" /></>),
  canister: P(<><path d="M6 6h9l3 3v12H6z" /><path d="M9 3h4v3" /></>),
  rotate: P(<><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>),
  stamina: P(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />),
  ear: P(<><path d="M7 10a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0" /></>),
};
export type IconName = keyof typeof Icon;
