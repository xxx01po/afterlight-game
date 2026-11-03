import { describe, it, expect } from 'vitest';
import { resolveCircle } from '@/game/player/collision';

const wall = { minX: 0, maxX: 1, minZ: 0, maxZ: 0.12 };

describe('resolveCircle', () => {
  it('leaves a free position untouched', () => {
    expect(resolveCircle(5, 5, 0.25, [wall])).toEqual([5, 5]);
  });
  it('pushes the player out of a wall along the normal', () => {
    const [x, z] = resolveCircle(0.5, 0.2, 0.25, [wall]);
    expect(x).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0.12 + 0.25);
  });
  it('handles a centre inside the box', () => {
    const [, z] = resolveCircle(0.5, 0.05, 0.25, [wall]);
    expect(z).toBeLessThan(0);
  });
  it('ignores disabled colliders (open doors)', () => {
    expect(resolveCircle(0.5, 0.06, 0.25, [{ ...wall, enabled: false }])).toEqual([0.5, 0.06]);
  });
  it('resolves corners between two boxes', () => {
    const b2 = { minX: 0.88, maxX: 1, minZ: 0, maxZ: 1 };
    const [x, z] = resolveCircle(0.8, 0.2, 0.25, [wall, b2]);
    expect(z).toBeGreaterThanOrEqual(0.12 + 0.25 - 1e-6);
    expect(x).toBeLessThanOrEqual(0.88 - 0.25 + 1e-6);
  });
});
