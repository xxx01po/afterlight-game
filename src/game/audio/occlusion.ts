/**
 * Room graph for sound propagation. Each edge is a door, opening, wall or
 * window; the loudest path decides lowpass cutoff and gain. This is what makes
 * a knock from the landing sound different from a knock in the same room.
 */
export type EdgeKind = 'open' | 'door' | 'frontDoor' | 'wall' | 'window' | 'ceiling';
export interface Edge { a: string; b: string; kind: EdgeKind; isOpen?: () => boolean }

const ATT: Record<EdgeKind, { cutoff: number; gain: number }> = {
  open: { cutoff: 9000, gain: 0.85 },
  door: { cutoff: 1300, gain: 0.5 },
  frontDoor: { cutoff: 650, gain: 0.42 },
  wall: { cutoff: 380, gain: 0.7 },
  window: { cutoff: 2600, gain: 0.65 },
  ceiling: { cutoff: 300, gain: 0.55 },
};

export function edgeAtt(e: Edge) {
  if ((e.kind === 'door' || e.kind === 'frontDoor') && e.isOpen?.()) return ATT.open;
  return ATT[e.kind];
}

/** Best (loudest) path between rooms. Pure — unit tested. */
export function occlusionBetween(edges: readonly Edge[], from: string, to: string): { cutoff: number; gain: number } {
  if (from === to) return { cutoff: 20000, gain: 1 };
  const best = new Map<string, { cutoff: number; gain: number; hops: number }>();
  best.set(from, { cutoff: 20000, gain: 1, hops: 0 });
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    const cs = best.get(cur)!;
    if (cs.hops > 4) continue;
    for (const e of edges) {
      const nxt = e.a === cur ? e.b : e.b === cur ? e.a : null;
      if (!nxt) continue;
      const a = edgeAtt(e);
      const cand = { cutoff: Math.min(cs.cutoff, a.cutoff) * (cs.hops ? 0.85 : 1), gain: cs.gain * a.gain, hops: cs.hops + 1 };
      const prev = best.get(nxt);
      if (!prev || cand.gain > prev.gain + 1e-6) {
        best.set(nxt, cand);
        queue.push(nxt);
      }
    }
  }
  const r = best.get(to);
  return r ? { cutoff: Math.max(150, r.cutoff), gain: r.gain } : { cutoff: 200, gain: 0.15 };
}
