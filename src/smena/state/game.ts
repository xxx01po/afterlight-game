import { create } from 'zustand';
import type { ItemId } from '@/smena/gameplay/items';
import type { Verb } from '@/smena/gameplay/Interaction';

export type Screen = 'boot' | 'menu' | 'playing' | 'paused' | 'dead' | 'end';
export interface Subtitle { id: number; who: 'disp' | 'hero' | 'echo' | 'radio'; text: string }
export interface Toast { id: number; text: string }

export interface GameUI {
  screen: Screen;
  physicsReady: boolean;
  hasSave: boolean;
  loadingText: string;
  // HUD
  health: number;
  battery: number;
  stamina: number;
  noise: number;
  flashlightOwned: boolean;
  flashlightOn: boolean;
  crouching: boolean;
  sprinting: boolean;
  objective: string;
  objectiveFlash: number;
  prompt: { text: string; verb: Verb } | null;
  holding: boolean;
  subtitles: Subtitle[];
  toasts: Toast[];
  inventory: { id: ItemId; n: number }[];
  selected: ItemId | null;
  docsRead: string[];
  reading: string | null;
  invOpen: boolean;
  journalOpen: boolean;
  monitor: { label: string } | null;
  damageFlash: number;
  fps: number;
  stats: { playTime: number; deaths: number; docs: number; docsTotal: number };
  set: (p: Partial<GameUI>) => void;
}

let sid = 0;
export const useGame = create<GameUI>()((set) => ({
  screen: 'boot',
  physicsReady: false,
  hasSave: false,
  loadingText: '',
  health: 100,
  battery: 100,
  stamina: 100,
  noise: 0,
  flashlightOwned: false,
  flashlightOn: false,
  crouching: false,
  sprinting: false,
  objective: '',
  objectiveFlash: 0,
  prompt: null,
  holding: false,
  subtitles: [],
  toasts: [],
  inventory: [],
  selected: null,
  docsRead: [],
  reading: null,
  invOpen: false,
  journalOpen: false,
  monitor: null,
  damageFlash: 0,
  fps: 0,
  stats: { playTime: 0, deaths: 0, docs: 0, docsTotal: 0 },
  set: (p) => set(p),
}));

export function pushSubtitle(who: Subtitle['who'], text: string, dur: number) {
  const id = ++sid;
  useGame.setState((s) => ({ subtitles: [...s.subtitles.slice(-2), { id, who, text }] }));
  setTimeout(() => useGame.setState((s) => ({ subtitles: s.subtitles.filter((x) => x.id !== id) })), dur * 1000);
}

export function toast(text: string, dur = 2.6) {
  const id = ++sid;
  useGame.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
  setTimeout(() => useGame.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), dur * 1000);
}
