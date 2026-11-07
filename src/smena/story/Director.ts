/**
 * Beat scheduler. A beat fires once when its condition holds; `run` may be
 * async and `wait()` uses game time (it stops while paused). Fired beat ids
 * are stored in the save so loading never replays a scene.
 */
export interface Beat<G> {
  id: string;
  when: (g: G) => boolean;
  run: (g: G) => void | Promise<void>;
  /** Keep re-checking after firing (for repeatable hints). */
  repeat?: boolean;
}

export class Director<G> {
  fired = new Set<string>();
  private waits: { until: number; resolve: () => void }[] = [];
  time = 0;
  busy = 0;
  private generation = 0;

  constructor(private g: G, private beats: Beat<G>[]) {}

  wait = (sec: number) =>
    new Promise<void>((resolve) => {
      const gen = this.generation;
      this.waits.push({ until: this.time + sec, resolve: () => gen === this.generation && resolve() });
    });

  /** Cancel pending waits (load/restart): running scripts simply never resume. */
  reset(fired: string[] = []) {
    this.generation++;
    this.waits = [];
    this.busy = 0;
    this.fired = new Set(fired);
  }

  fire(id: string) {
    const b = this.beats.find((x) => x.id === id);
    if (!b || (this.fired.has(id) && !b.repeat)) return;
    this.fired.add(id);
    const gen = this.generation;
    const r = b.run(this.g);
    if (r instanceof Promise) {
      this.busy++;
      void r.finally(() => {
        if (gen === this.generation) this.busy--;
      });
    }
  }

  update(dt: number) {
    this.time += dt;
    const due = this.waits.filter((w) => w.until <= this.time);
    if (due.length) {
      this.waits = this.waits.filter((w) => w.until > this.time);
      due.forEach((w) => w.resolve());
    }
    for (const b of this.beats) {
      if (this.fired.has(b.id) && !b.repeat) continue;
      if (b.when(this.g)) this.fire(b.id);
    }
  }
}
