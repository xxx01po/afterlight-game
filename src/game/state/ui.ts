import { create } from 'zustand';

export interface DialogueView {
  speaker: string;
  text: string;
  choices: { id: string; text: string }[];
  /** Muffled = voice through a door / phone. Affects styling. */
  muffled?: boolean;
  canContinue: boolean;
}
export interface ReaderView { title: string; body: string; style: 'paper' | 'flyer' | 'photo' | 'polaroid' | 'plain'; image?: string }
export interface IncomingCall { name: string; number: string }
export interface Subtitle { id: number; text: string; speaker?: string; until: number }

export type Screen = 'title' | 'game' | 'ending';
export type PhoneApp = 'home' | 'messages' | 'thread' | 'calls' | 'photos' | 'photo' | 'recorder' | 'notes' | 'note' | 'call';

export interface UIState {
  screen: Screen;
  paused: boolean;
  prompt: { label: string; hint?: string } | null;
  subtitles: Subtitle[];
  objective: string | null;
  objectiveFlash: number;
  phoneOpen: boolean;
  phoneApp: PhoneApp;
  phoneArg: string | null;
  phoneVibrating: boolean;
  incomingCall: IncomingCall | null;
  activeCall: { name: string; startedAt: number } | null;
  dialogue: DialogueView | null;
  reader: ReaderView | null;
  fade: number;
  fadeMs: number;
  peephole: boolean;
  flashlight: boolean;
  toast: string | null;
  ending: string | null;
  loading: boolean;
  /** Blocks movement (phone, reader, dialogue, cutscene). */
  cutscene: boolean;
  set: (p: Partial<UIState>) => void;
}

export const useUI = create<UIState>()((set) => ({
  screen: 'title',
  paused: false,
  prompt: null,
  subtitles: [],
  objective: null,
  objectiveFlash: 0,
  phoneOpen: false,
  phoneApp: 'home',
  phoneArg: null,
  phoneVibrating: false,
  incomingCall: null,
  activeCall: null,
  dialogue: null,
  reader: null,
  fade: 1,
  fadeMs: 0,
  peephole: false,
  flashlight: false,
  toast: null,
  ending: null,
  loading: false,
  cutscene: false,
  set: (p) => set(p),
}));

let subId = 1;
export function say(text: string, seconds = Math.max(2.6, text.length * 0.065), speaker?: string) {
  const until = performance.now() + seconds * 1000;
  const s: Subtitle = { id: subId++, text, speaker, until };
  useUI.setState((u) => ({ subtitles: [...u.subtitles.slice(-2), s] }));
}

export function setObjective(text: string | null) {
  useUI.setState({ objective: text, objectiveFlash: text ? performance.now() : 0 });
}

export function toast(text: string) {
  useUI.setState({ toast: text });
  setTimeout(() => useUI.getState().toast === text && useUI.setState({ toast: null }), 2200);
}

/** Anything that should freeze player movement & look. */
export function inputBlocked() {
  const u = useUI.getState();
  return u.paused || u.phoneOpen || !!u.dialogue || !!u.reader || u.cutscene || !!u.incomingCall || !!u.activeCall || u.peephole;
}
