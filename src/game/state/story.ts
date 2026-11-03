import { createStore } from 'zustand/vanilla';
import type { FlagValue, PhoneMessage, StoryState, PendingChange, CallEntry, RecordingEntry, NoteEntry, PhotoEntry } from './types';
import { formatClock } from '@/utils/math';

export const SAVE_VERSION = 3;

export interface StoryActions {
  reset(initial: StoryState): void;
  load(s: StoryState): void;
  setFlag(key: string, v: FlagValue): void;
  inc(key: string, by?: number): number;
  addItem(id: string): void;
  removeItem(id: string): void;
  learn(id: string): void;
  setWorld(key: string, v: FlagValue): void;
  queueUnseen(c: PendingChange): void;
  resolvePending(key: string): void;
  fire(id: string): void;
  setStage(n: number): void;
  setClock(min: number): void;
  setCharacter(id: string, patch: Partial<StoryState['characters'][string]>): void;
  record(id: string, label: string): void;
  pushMessage(threadId: string, msg: Omit<PhoneMessage, 'id' | 'time'> & { time?: string }, unread?: boolean): void;
  markRead(threadId: string): void;
  addCall(c: Omit<CallEntry, 'id'>): void;
  addRecording(r: RecordingEntry): void;
  addPhoto(p: PhotoEntry): void;
  updateNote(id: string, patch: Partial<NoteEntry>): void;
  savePlayer(p: StoryState['player']): void;
  addPlayTime(dt: number): void;
}

export type StoryStore = StoryState & StoryActions;

let uid = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(uid++).toString(36)}`;

export function createStoryStore(initial: StoryState) {
  return createStore<StoryStore>()((set, get) => ({
    ...structuredClone(initial),
    reset: (s) => set(structuredClone(s)),
    load: (s) => set(structuredClone(s)),
    setFlag: (key, v) => set((s) => ({ flags: { ...s.flags, [key]: v } })),
    inc: (key, by = 1) => {
      const v = (Number(get().flags[key]) || 0) + by;
      set((s) => ({ flags: { ...s.flags, [key]: v } }));
      return v;
    },
    addItem: (id) => set((s) => (s.inventory.includes(id) ? s : { inventory: [...s.inventory, id] })),
    removeItem: (id) => set((s) => ({ inventory: s.inventory.filter((i) => i !== id) })),
    learn: (id) => set((s) => (s.knowledge.includes(id) ? s : { knowledge: [...s.knowledge, id] })),
    setWorld: (key, v) => set((s) => ({ world: { ...s.world, [key]: v } })),
    queueUnseen: (c) => set((s) => ({ pending: [...s.pending.filter((p) => p.key !== c.key), c] })),
    resolvePending: (key) => {
      const p = get().pending.find((x) => x.key === key);
      if (!p) return;
      set((s) => ({ pending: s.pending.filter((x) => x.key !== key), world: { ...s.world, [p.key]: p.value } }));
    },
    fire: (id) => set((s) => (s.fired.includes(id) ? s : { fired: [...s.fired, id] })),
    setStage: (n) => set({ stage: n }),
    setClock: (min) => set({ clockMin: min }),
    setCharacter: (id, patch) =>
      set((s) => ({
        characters: { ...s.characters, [id]: { ...(s.characters[id] ?? { relation: 0, status: 'unknown', met: false }), ...patch } },
      })),
    record: (id, label) => set((s) => ({ choices: [...s.choices, { id, label, clock: formatClock(s.clockMin) }] })),
    pushMessage: (threadId, msg, unread = msg.from === 'them') =>
      set((s) => ({
        phone: {
          ...s.phone,
          threads: s.phone.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, { id: nid('m'), time: msg.time ?? formatClock(s.clockMin), from: msg.from, text: msg.text, status: msg.status }],
                  unread: t.unread + (unread ? 1 : 0),
                }
              : t,
          ),
        },
      })),
    markRead: (threadId) =>
      set((s) => ({ phone: { ...s.phone, threads: s.phone.threads.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)) } })),
    addCall: (c) => set((s) => ({ phone: { ...s.phone, calls: [{ ...c, id: nid('c') }, ...s.phone.calls] } })),
    addRecording: (r) => set((s) => ({ phone: { ...s.phone, recordings: [r, ...s.phone.recordings.filter((x) => x.id !== r.id)] } })),
    addPhoto: (p) => set((s) => ({ phone: { ...s.phone, photos: [p, ...s.phone.photos.filter((x) => x.id !== p.id)] } })),
    updateNote: (id, patch) =>
      set((s) => ({ phone: { ...s.phone, notes: s.phone.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) } })),
    savePlayer: (p) => set({ player: p }),
    addPlayTime: (dt) => set((s) => ({ playTime: s.playTime + dt })),
  }));
}

export type StoryApi = ReturnType<typeof createStoryStore>;

/** Extract only the serialisable data part of the store. */
export function snapshot(api: StoryApi): StoryState {
  const s = api.getState();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (typeof v !== 'function') out[k] = v;
  return structuredClone(out) as unknown as StoryState;
}
