import { describe, expect, it } from 'vitest';
import { FSM } from '@/smena/ai/fsm';
import { NavGraph } from '@/smena/ai/NavGraph';
import { buildNavGraph } from '@/smena/ai/navmap';
import { hears, SIGHT, stepAwareness, visibility, type SightInput } from '@/smena/ai/perception';

const base: SightInput = { dist: 10, cosAngle: 1, lineOfSight: true, flashlightOn: false, litByFlashlight: false, crouching: false, moving: true, inLight: false, inCover: false };

describe('perception', () => {
  it('needs line of sight', () => {
    expect(visibility({ ...base, lineOfSight: false })).toBe(0);
  });
  it('cannot see behind itself', () => {
    expect(visibility({ ...base, cosAngle: -0.5 })).toBe(0);
  });
  it('sees further when the player uses the flashlight', () => {
    const d = SIGHT.range * 1.3;
    expect(visibility({ ...base, dist: d })).toBe(0);
    expect(visibility({ ...base, dist: d, flashlightOn: true })).toBeGreaterThan(0);
  });
  it('crouching in cover makes the player much harder to notice', () => {
    expect(visibility({ ...base, dist: 8, crouching: true, inCover: true })).toBe(0);
    expect(visibility({ ...base, dist: 8 })).toBeGreaterThan(0);
  });
  it('a beam in the face is always noticed', () => {
    expect(visibility({ ...base, cosAngle: -1, litByFlashlight: true, flashlightOn: true, dist: 20 })).toBe(1);
  });
  it('awareness rises while seen and decays slowly', () => {
    let a = 0;
    for (let i = 0; i < 10; i++) a = stepAwareness(a, 0.5, 0.1);
    expect(a).toBeGreaterThan(0.8);
    const b = stepAwareness(a, 0, 1);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(a - 0.2);
  });
  it('walls halve hearing range', () => {
    expect(hears(10, 16, false)).toBe(true);
    expect(hears(10, 16, true)).toBe(false);
  });
});

describe('FSM', () => {
  it('runs enter/exit hooks and transitions from update', () => {
    const log: string[] = [];
    type S = 'A' | 'B';
    const f = new FSM<S, { n: number }>({ n: 0 }, {
      A: { enter: () => log.push('enterA'), exit: () => log.push('exitA'), update: (c) => (++c.n > 2 ? 'B' : undefined) },
      B: { enter: (_c, from) => log.push('enterB from ' + from) },
    }, 'A');
    f.update(0.1);
    f.update(0.1);
    expect(f.state).toBe('A');
    f.update(0.1);
    expect(f.state).toBe('B');
    expect(log).toEqual(['enterA', 'exitA', 'enterB from A']);
    expect(f.time).toBe(0);
  });
});

describe('NavGraph', () => {
  it('finds the shortest path with A*', () => {
    const g = new NavGraph();
    const a = g.add(0, 0), b = g.add(10, 0), c = g.add(10, 10), d = g.add(0, 10), e = g.add(5, 5);
    g.chain([a, b, c]);
    g.chain([a, e, c]);
    g.link(a, d);
    expect(g.path(a, c)).toEqual([a, e, c]);
  });
  it('respects blocked nodes and returns [] when unreachable', () => {
    const g = new NavGraph();
    const a = g.add(0, 0), b = g.add(5, 0, 'x'), c = g.add(10, 0);
    g.chain([a, b, c]);
    expect(g.path(a, c, (n) => n.tag === 'x')).toEqual([]);
  });
  it('the game map is connected: base gate ↔ village ↔ complex cell', () => {
    const g = buildNavGraph();
    const gate = g.byTag('northGateOut')!.id;
    const cell = g.byTag('cxCell')!.id;
    const h3 = g.byTag('h3')!.id;
    expect(g.path(gate, cell).length).toBeGreaterThan(5);
    expect(g.path(cell, h3).length).toBeGreaterThan(5);
    // the hunter can't path through the lit compound
    // (the deepest node of the yard can only be reached through other yard nodes)
    const inside = g.nodes.filter((n) => n.tag === 'base').at(-1)!.id;
    expect(g.path(cell, inside).length).toBeGreaterThan(5);
    expect(g.path(cell, inside, (n) => n.tag === 'base')).toEqual([]);
  });
});
