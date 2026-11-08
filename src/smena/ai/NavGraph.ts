/** Waypoint graph with A* — the creature's map of roads, clearings and corridors. */
export interface NavNode { id: number; x: number; z: number; tag?: string; links: number[] }

export class NavGraph {
  readonly nodes: NavNode[] = [];

  add(x: number, z: number, tag?: string) {
    const n: NavNode = { id: this.nodes.length, x, z, tag, links: [] };
    this.nodes.push(n);
    return n.id;
  }
  link(a: number, b: number) {
    if (a === b) return;
    if (!this.nodes[a].links.includes(b)) this.nodes[a].links.push(b);
    if (!this.nodes[b].links.includes(a)) this.nodes[b].links.push(a);
  }
  chain(ids: number[]) {
    for (let i = 0; i < ids.length - 1; i++) this.link(ids[i], ids[i + 1]);
  }
  byTag(tag: string) {
    return this.nodes.find((n) => n.tag === tag);
  }
  nearest(x: number, z: number, filter?: (n: NavNode) => boolean) {
    let best = -1, bd = Infinity;
    for (const n of this.nodes) {
      if (filter && !filter(n)) continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = n.id;
      }
    }
    return best;
  }

  /** A* shortest path between node ids (inclusive). Empty if unreachable. */
  path(from: number, to: number, blocked?: (n: NavNode) => boolean): number[] {
    if (from < 0 || to < 0) return [];
    if (from === to) return [from];
    const N = this.nodes;
    const h = (i: number) => Math.hypot(N[i].x - N[to].x, N[i].z - N[to].z);
    const g = new Map<number, number>([[from, 0]]);
    const f = new Map<number, number>([[from, h(from)]]);
    const came = new Map<number, number>();
    const open = new Set([from]);
    const closed = new Set<number>();
    while (open.size) {
      let cur = -1, cf = Infinity;
      for (const o of open) {
        const v = f.get(o)!;
        if (v < cf) {
          cf = v;
          cur = o;
        }
      }
      if (cur === to) {
        const out = [cur];
        while (came.has(cur)) {
          cur = came.get(cur)!;
          out.push(cur);
        }
        return out.reverse();
      }
      open.delete(cur);
      closed.add(cur);
      for (const nb of N[cur].links) {
        if (closed.has(nb) || (blocked && nb !== to && blocked(N[nb]))) continue;
        const tg = g.get(cur)! + Math.hypot(N[cur].x - N[nb].x, N[cur].z - N[nb].z);
        if (tg < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, tg);
          f.set(nb, tg + h(nb));
          open.add(nb);
        }
      }
    }
    return [];
  }
}
