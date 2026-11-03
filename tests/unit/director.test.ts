import { describe, it, expect } from 'vitest';
import { Director, type Beat } from '@/game/narrative/Director';

function store() {
  const s = { fired: [] as string[], stage: 0, fire(id: string) { if (!s.fired.includes(id)) s.fired.push(id); } };
  return s;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Director', () => {
  it('fires beats once, in order of conditions, per stage', async () => {
    const st = store();
    const log: string[] = [];
    const beats: Beat<null>[] = [
      { id: 'a', stage: 0, when: () => true, run: () => void log.push('a') },
      { id: 'b', stage: 1, when: () => true, run: () => void log.push('b') },
    ];
    const d = new Director(beats, () => st, () => null);
    d.update(0.1);
    d.update(0.1);
    await flush();
    expect(log).toEqual(['a']);
    st.stage = 1;
    d.update(0.1);
    await flush();
    expect(log).toEqual(['a', 'b']);
  });

  it('since() is -Infinity before an event happens', () => {
    const st = store();
    const d = new Director([], () => st, () => null);
    expect(d.since('x') > 5).toBe(false);
    d.mark('x');
    d.update(6);
    expect(d.since('x')).toBeCloseTo(6);
  });

  it('wait() resolves on simulated time, not wall time', async () => {
    const st = store();
    let done = false;
    const beats: Beat<null>[] = [{ id: 'w', when: () => true, run: async () => { await d.wait(2); done = true; } }];
    const d: Director<null> = new Director(beats, () => st, () => null);
    d.update(0.1);
    await flush();
    expect(d.busy).toBe(1);
    d.update(1);
    await flush();
    expect(done).toBe(false);
    d.update(1.5);
    await flush();
    await flush();
    expect(done).toBe(true);
    expect(d.busy).toBe(0);
  });

  it('restores fired beats from a save without re-running them', () => {
    const st = store();
    st.fired.push('a');
    let ran = false;
    const d = new Director([{ id: 'a', when: () => true, run: () => void (ran = true) }], () => st, () => null);
    d.syncFromStore();
    d.update(1);
    expect(ran).toBe(false);
  });
});
