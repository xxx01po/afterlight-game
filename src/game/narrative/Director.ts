/**
 * Beat scheduler. A chapter is a list of beats: each has a condition and an
 * action (possibly async, using `wait`). Fired beats are stored in the save,
 * so the same sequence is reproducible and resumable. Nothing is random.
 */
export interface Beat<C> {
  id: string;
  /** Only evaluated while story.stage === stage (if given). */
  stage?: number;
  when: (c: C) => boolean;
  run: (c: C) => void | Promise<void>;
}

export interface DirectorStore {
  fired: readonly string[];
  stage: number;
  fire(id: string): void;
}

export class Director<C> {
  time = 0;
  busy = 0;
  stageStart = 0;
  private firedAt = new Map<string, number>();
  private waits: { at: number; resolve: () => void }[] = [];
  private lastStage = -1;
  onError?: (e: unknown) => void;

  constructor(private beats: Beat<C>[], private store: () => DirectorStore, private ctx: () => C) {}

  /** After loading a save: fired beats count as "just fired" so delays restart. */
  syncFromStore() {
    this.firedAt.clear();
    for (const id of this.store().fired) this.firedAt.set(id, this.time);
    this.lastStage = this.store().stage;
    this.stageStart = this.time;
  }

  fired(id: string) {
    return this.firedAt.has(id) || this.store().fired.includes(id);
  }
  /** Seconds since a beat/mark happened; -Infinity if it hasn't (so `since(x) > n` is false). */
  since(id: string) {
    const t = this.firedAt.get(id);
    return t === undefined ? (this.store().fired.includes(id) ? 0 : -Infinity) : this.time - t;
  }
  /** Mark an arbitrary event as happened (for `since`). */
  mark(id: string) {
    if (!this.firedAt.has(id)) this.firedAt.set(id, this.time);
    this.store().fire(id);
  }
  get stageTime() {
    return this.time - this.stageStart;
  }

  wait(seconds: number) {
    return new Promise<void>((resolve) => this.waits.push({ at: this.time + seconds, resolve }));
  }

  update(dt: number) {
    this.time += dt;
    const st = this.store();
    if (st.stage !== this.lastStage) {
      this.lastStage = st.stage;
      this.stageStart = this.time;
    }
    if (this.waits.length) {
      const due = this.waits.filter((w) => w.at <= this.time);
      if (due.length) {
        this.waits = this.waits.filter((w) => w.at > this.time);
        due.forEach((w) => w.resolve());
      }
    }
    const c = this.ctx();
    for (const b of this.beats) {
      if (this.fired(b.id)) continue;
      if (b.stage !== undefined && b.stage !== st.stage) continue;
      let ok = false;
      try {
        ok = b.when(c);
      } catch (e) {
        this.onError?.(e);
      }
      if (!ok) continue;
      this.firedAt.set(b.id, this.time);
      st.fire(b.id);
      this.busy++;
      Promise.resolve()
        .then(() => b.run(c))
        .catch((e) => this.onError?.(e))
        .finally(() => this.busy--);
    }
  }
}
