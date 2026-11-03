import { create } from 'zustand';

export type Quality = 'low' | 'medium' | 'high';
export interface Settings {
  master: number;
  ambience: number;
  sfx: number;
  music: number;
  quality: Quality;
  autoQuality: boolean;
  lookSensitivity: number;
  invertY: boolean;
  subtitles: boolean;
  showFps: boolean;
}

const KEY = 'afterlight.settings.v1';
const defaults: Settings = {
  master: 0.9,
  ambience: 0.85,
  sfx: 0.9,
  music: 0.7,
  quality: 'medium',
  autoQuality: true,
  lookSensitivity: 1,
  invertY: false,
  subtitles: true,
  showFps: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* private mode / blocked storage */
  }
  return { ...defaults };
}

export const useSettings = create<Settings & { patch: (p: Partial<Settings>) => void }>()((set, get) => ({
  ...load(),
  patch: (p) => {
    set(p);
    try {
      const { patch: _p, ...rest } = get();
      void _p;
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  },
}));
