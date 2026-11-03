import type { StoryState } from '@/game/state/types';
import { SAVE_VERSION } from '@/game/state/story';

const KEY = 'afterlight.save.slot1';

export interface SaveMeta { savedAt: number; chapter: string; stage: number; clock: number; playTime: number }
export interface SaveFile { meta: SaveMeta; state: StoryState }

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

/**
 * LocalStorage save slot. Saves are versioned; incompatible saves are ignored
 * instead of crashing. Storage can be injected for tests.
 */
export class SaveSystem {
  constructor(private storage: StorageLike | null = safeLocalStorage()) {}

  save(state: StoryState): boolean {
    if (!this.storage) return false;
    const file: SaveFile = { meta: { savedAt: Date.now(), chapter: state.chapter, stage: state.stage, clock: state.clockMin, playTime: state.playTime }, state };
    try {
      this.storage.setItem(KEY, JSON.stringify(file));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveFile | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return null;
      const f = JSON.parse(raw) as SaveFile;
      if (!f?.state || f.state.saveVersion !== SAVE_VERSION) return null;
      return f;
    } catch {
      return null;
    }
  }

  meta(): SaveMeta | null {
    return this.load()?.meta ?? null;
  }

  clear() {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__al_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export const saves = new SaveSystem();
