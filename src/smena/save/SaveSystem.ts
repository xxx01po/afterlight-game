import { getKV, type KV } from './idb';
import type { InvState } from '@/smena/gameplay/Inventory';

export const SAVE_VERSION = 1;
export type Slot = 'auto' | 'manual';

export interface SaveData {
  v: number;
  savedAt: number;
  playTime: number;
  seed: number;
  stage: number;
  flags: Record<string, number>;
  beats: string[];
  player: { x: number; y: number; z: number; yaw: number; health: number; stamina: number; crouch: boolean };
  flashlight: { owned: boolean; on: boolean; battery: number };
  inv: InvState;
  docs: string[];
  taken: string[];
  doors: Record<string, { open: boolean; locked: boolean }>;
  checksum?: string;
}

/** FNV-1a 32-bit over the canonical JSON — detects truncated/corrupted saves. */
export function checksum(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function body(d: SaveData) {
  const { checksum: _c, ...rest } = d;
  void _c;
  return JSON.stringify(rest);
}

const fin = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

/** Structural validation: rejects anything that could put the game in a broken state. */
export function validate(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false;
  const s = d as SaveData;
  if (s.v !== SAVE_VERSION) return false;
  if (!fin(s.stage) || s.stage < 0 || s.stage > 14) return false;
  if (!fin(s.seed) || !fin(s.savedAt) || !fin(s.playTime)) return false;
  const p = s.player;
  if (!p || ![p.x, p.y, p.z, p.yaw, p.health, p.stamina].every(fin)) return false;
  if (Math.abs(p.x) > 400 || Math.abs(p.z) > 400 || p.y < -50 || p.y > 100) return false;
  if (p.health <= 0 || p.health > 100) return false;
  if (!s.flashlight || !fin(s.flashlight.battery)) return false;
  if (!s.inv || typeof s.inv.items !== 'object') return false;
  if (!Array.isArray(s.docs) || !Array.isArray(s.taken) || !Array.isArray(s.beats)) return false;
  if (!s.doors || typeof s.doors !== 'object' || !s.flags || typeof s.flags !== 'object') return false;
  if (s.checksum && s.checksum !== checksum(body(s))) return false;
  return true;
}

export class SaveSystem {
  constructor(private kvP: Promise<KV> = getKV()) {}

  async write(slot: Slot, d: SaveData) {
    const data: SaveData = { ...d, v: SAVE_VERSION, savedAt: Date.now() };
    data.checksum = checksum(body(data));
    const kv = await this.kvP;
    await kv.set('save.' + slot, data);
    return data;
  }

  async read(slot: Slot): Promise<SaveData | null> {
    try {
      const kv = await this.kvP;
      const d = await kv.get<SaveData>('save.' + slot);
      return validate(d) ? d : null;
    } catch {
      return null;
    }
  }

  /** Newest valid save across slots. */
  async latest(): Promise<SaveData | null> {
    const [a, m] = await Promise.all([this.read('auto'), this.read('manual')]);
    if (a && m) return a.savedAt >= m.savedAt ? a : m;
    return a ?? m;
  }

  async clear() {
    const kv = await this.kvP;
    await kv.del('save.auto');
    await kv.del('save.manual');
  }

  async storageKind() {
    return (await this.kvP).kind;
  }
}

export const saves = new SaveSystem();
