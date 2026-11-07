import { NavGraph } from './NavGraph';
import { ROAD_COMPLEX, ROAD_VILLAGE, type P2 } from '@/smena/world/layout';

function sample(pts: P2[], step: number): P2[] {
  const out: P2[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

/** Hand-authored + road-sampled navigation graph for the whole map. */
export function buildNavGraph() {
  const g = new NavGraph();
  const near = (x: number, z: number) => g.nearest(x, z);
  // roads
  const villageRoad = sample(ROAD_VILLAGE, 7).map(([x, z], i) => g.add(x, z, i === 0 ? 'northGateOut' : undefined));
  g.chain(villageRoad);
  const complexRoad = sample(ROAD_COMPLEX, 7).slice(1).map(([x, z]) => g.add(x, z));
  g.link(near(ROAD_COMPLEX[0][0], ROAD_COMPLEX[0][1]), complexRoad[0]);
  g.chain(complexRoad);
  // forest loops off the road (patrol routes through the trees)
  const loops: P2[][] = [
    [[-14, -40], [-24, -52], [-32, -66], [-38, -78]],
    [[10, -48], [14, -62], [6, -76], [-4, -88]],
    [[-46, -86], [-56, -98], [-64, -106]],
    [[18, -98], [28, -110], [40, -124], [48, -138]],
    [[-12, -112], [-20, -126], [-28, -136]],
  ];
  for (const lp of loops) {
    const ids = lp.map(([x, z]) => g.add(x, z, 'forest'));
    g.chain(ids);
    g.link(ids[0], g.nearest(lp[0][0], lp[0][1], (n) => !ids.includes(n.id) && n.tag !== 'forest'));
    g.link(ids[ids.length - 1], g.nearest(lp[lp.length - 1][0], lp[lp.length - 1][1], (n) => !ids.includes(n.id) && n.tag !== 'forest'));
  }
  // village yards
  const yards: [number, number, string][] = [[-40, -113, 'h1yard'], [-40, -108.5, 'h1'], [-45, -124, 'h3yard'], [-45, -129, 'h3'], [-56, -114, 'h2yard'], [-61, -124, 'h4'], [-66, -110, 'h5yard'], [-50, -125, 'well'], [-32, -122, 'relay']];
  for (const [x, z, tag] of yards) {
    const to = near(x, z); // find the neighbour before adding, or we'd link the node to itself
    g.link(g.add(x, z, tag), to);
  }
  g.link(g.byTag('h1')!.id, g.byTag('h1yard')!.id);
  g.link(g.byTag('h3')!.id, g.byTag('h3yard')!.id);
  // complex: outside → vestibule → corridor → rooms
  const cx = (x: number, z: number, tag?: string) => g.add(x, z, tag);
  const roadEnd = near(38, -146);
  const out = cx(38, -146, 'cxOut');
  g.link(out, roadEnd);
  const vest = cx(38, -152, 'cxVest');
  const cor = [cx(28, -156.5, 'cxCorW'), cx(31.5, -156.5), cx(38, -156.5, 'cxCorC'), cx(41, -156.5), cx(48, -156.5), cx(49.5, -156.5), cx(52.5, -156.5, 'cxCorE')];
  g.chain(cor);
  g.link(out, vest);
  g.link(vest, cor[2]);
  g.link(cor[1], cx(31, -163, 'cxLab1'));
  g.link(g.byTag('cxLab1')!.id, cx(31, -169, 'cxLab1b'));
  g.link(cor[3], cx(41, -163, 'cxLab2'));
  g.link(cor[5], cx(49.5, -161, 'cxServer'));
  g.link(g.byTag('cxServer')!.id, cx(49.5, -170, 'cxCell'));
  g.link(cor[0], cx(30, -152.5, 'cxRecords'));
  g.link(cor[4], cx(48, -152.5, 'cxElectric'));
  // base (forbidden while the generator lights the yard)
  const gateIn = g.add(0, -14, 'base');
  g.link(gateIn, g.byTag('northGateOut')!.id);
  g.chain([gateIn, g.add(0, -4, 'base'), g.add(-3, 6, 'base'), g.add(2, 12, 'base')]);
  return g;
}

export const PATROLS = {
  /** Early sighting: crosses the village road and walks off between the trees. */
  forestCross: [[-44, -90], [-36, -95], [-24, -98], [-12, -104], [-2, -96]] as P2[],
  /** Hunt: roams the roads between the complex and the base. */
  hunt: [[34, -144], [14, -120], [0, -104], [-14, -92], [-24, -80], [-16, -66], [-8, -50], [-2, -34], [-16, -66], [-30, -94], [-38, -116], [-24, -80], [0, -104]] as P2[],
};
