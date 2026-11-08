/** Minimal finite state machine with enter/update/exit hooks and time-in-state. */
export interface StateDef<S extends string, C> {
  enter?: (c: C, from: S | null) => void;
  update?: (c: C, dt: number, time: number) => S | void;
  exit?: (c: C, to: S) => void;
}

export class FSM<S extends string, C> {
  state: S;
  time = 0;
  readonly history: S[] = [];
  onChange?: (from: S, to: S) => void;
  constructor(private ctx: C, private defs: Record<S, StateDef<S, C>>, initial: S) {
    this.state = initial;
    defs[initial].enter?.(ctx, null);
  }
  go(to: S) {
    if (to === this.state) return;
    const from = this.state;
    this.defs[from].exit?.(this.ctx, to);
    this.state = to;
    this.time = 0;
    this.history.push(to);
    if (this.history.length > 32) this.history.shift();
    this.defs[to].enter?.(this.ctx, from);
    this.onChange?.(from, to);
  }
  update(dt: number) {
    this.time += dt;
    const next = this.defs[this.state].update?.(this.ctx, dt, this.time);
    if (next && next !== this.state) this.go(next);
  }
}
