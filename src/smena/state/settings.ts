import { create } from 'zustand';
import { getKV } from '@/smena/save/idb';

export type Quality = 'low' | 'medium' | 'high';
export interface Settings {
  master: number;
  ambience: number;
  sfx: number;
  voice: number;
  music: number;
  /** 'auto' picks a profile from device capabilities and steps down on low FPS. */
  quality: Quality | 'auto';
  lookSensitivity: number;
  invertY: boolean;
  headBob: number;
  fov: number;
  subtitles: boolean;
  haptics: boolean;
  showFps: boolean;
  /** Left-handed layout swaps joystick and buttons. */
  leftHanded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.9,
  ambience: 0.85,
  sfx: 0.9,
  voice: 1,
  music: 0.6,
  quality: 'auto',
  lookSensitivity: 1,
  invertY: false,
  headBob: 1,
  fov: 75,
  subtitles: true,
  haptics: true,
  showFps: false,
  leftHanded: false,
};

const KEY = 'settings';
const LS_MIRROR = 'smena.settings.mirror';

/** Settings are read synchronously from a localStorage mirror, IndexedDB is the source of truth. */
function loadMirror(): Settings {
  try {
    const raw = localStorage.getItem(LS_MIRROR);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* blocked storage */
  }
  return { ...DEFAULT_SETTINGS };
}

export function sanitize(v: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!v || typeof v !== 'object') return out;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const d = DEFAULT_SETTINGS[k];
    const x = o[k];
    if (typeof d === 'number' && typeof x === 'number' && Number.isFinite(x)) (out as Record<string, unknown>)[k] = x;
    else if (typeof d === 'boolean' && typeof x === 'boolean') (out as Record<string, unknown>)[k] = x;
    else if (k === 'quality' && (x === 'low' || x === 'medium' || x === 'high' || x === 'auto')) out.quality = x;
  }
  out.lookSensitivity = Math.min(3, Math.max(0.2, out.lookSensitivity));
  out.fov = Math.min(95, Math.max(60, out.fov));
  return out;
}

type Store = Settings & { patch: (p: Partial<Settings>) => void; hydrate: () => Promise<void> };

export const useSettings = create<Store>()((set, get) => ({
  ...loadMirror(),
  patch: (p) => {
    set(p);
    const { patch: _p, hydrate: _h, ...rest } = get();
    void _p;
    void _h;
    try {
      localStorage.setItem(LS_MIRROR, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
    void getKV().then((kv) => kv.set(KEY, rest)).catch(() => {});
  },
  hydrate: async () => {
    try {
      const kv = await getKV();
      const v = await kv.get<Settings>(KEY);
      if (v) set(sanitize(v));
    } catch {
      /* keep mirror */
    }
  },
}));
