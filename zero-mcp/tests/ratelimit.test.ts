import { describe, expect, it } from 'vitest';
import { UsageMeter } from '../src/core/ratelimit.js';

describe('usage meter', () => {
  it('enforces per-minute rate and refills over time', () => {
    let t = 0;
    const m = new UsageMeter(() => t);
    m.consume('gh', 2);
    m.consume('gh', 2);
    expect(() => m.consume('gh', 2)).toThrow(/Rate limit/);
    t += 30_000; // half a minute → one token back
    expect(() => m.consume('gh', 2)).not.toThrow();
  });
  it('enforces session quota', () => {
    const m = new UsageMeter();
    m.consume('x', undefined, 1);
    expect(() => m.consume('x', undefined, 1)).toThrow(/quota/);
    expect(m.snapshot()).toEqual({ x: 1 });
  });
});
