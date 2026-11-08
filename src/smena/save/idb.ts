/**
 * Minimal promise wrapper over IndexedDB (one object store, key → value).
 * Falls back to localStorage when IndexedDB is unavailable (old WebViews,
 * some private modes), so saving never blocks the game from running.
 */
const DB_NAME = 'smena';
const STORE = 'kv';

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

class IdbKV implements KV {
  readonly kind = 'indexeddb' as const;
  constructor(private db: IDBDatabase) {}
  private tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  get<T>(key: string) {
    return this.tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
  }
  async set(key: string, value: unknown) {
    await this.tx('readwrite', (s) => s.put(value, key));
  }
  async del(key: string) {
    await this.tx('readwrite', (s) => s.delete(key));
  }
}

class LsKV implements KV {
  readonly kind = 'localstorage' as const;
  async get<T>(key: string) {
    const raw = localStorage.getItem('smena.' + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
  async set(key: string, value: unknown) {
    localStorage.setItem('smena.' + key, JSON.stringify(value));
  }
  async del(key: string) {
    localStorage.removeItem('smena.' + key);
  }
}

export class MemoryKV implements KV {
  readonly kind = 'memory' as const;
  private m = new Map<string, unknown>();
  async get<T>(key: string) {
    const v = this.m.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async set(key: string, value: unknown) {
    this.m.set(key, structuredClone(value));
  }
  async del(key: string) {
    this.m.delete(key);
  }
}

let kvPromise: Promise<KV> | null = null;

export function getKV(): Promise<KV> {
  if (kvPromise) return kvPromise;
  kvPromise = (async () => {
    try {
      if (typeof indexedDB !== 'undefined') return new IdbKV(await openDB());
    } catch {
      /* fall through */
    }
    try {
      localStorage.setItem('smena.__t', '1');
      localStorage.removeItem('smena.__t');
      return new LsKV();
    } catch {
      return new MemoryKV();
    }
  })();
  return kvPromise;
}
