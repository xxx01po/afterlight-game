import { fbm } from './noise';
import { clamp, smooth } from '@/utils/math';

/**
 * World layout (metres, +X east, −Z north). Everything that needs to agree on
 * positions — terrain, roads, zone builders, AI nav graph, story triggers — reads it here.
 */
export type P2 = [number, number];

export const ZONES = {
  base: { x: 0, z: 0, hx: 24, hz: 20, h: 0 },
  village: { x: -48, z: -118, hx: 26, hz: 18, h: 0 },
  complex: { x: 40, z: -162, hx: 22, hz: 16, h: 0 },
} as const;

/** Forest road from the base's north gate to the village. */
export const ROAD_VILLAGE: P2[] = [[0, -20], [-2, -34], [-8, -50], [-16, -66], [-24, -80], [-30, -94], [-34, -106], [-38, -116], [-50, -119], [-66, -122]];
/** Branch from the fork to the research complex. */
export const ROAD_COMPLEX: P2[] = [[-24, -80], [-14, -92], [0, -104], [14, -120], [26, -134], [34, -144], [38, -150]];
/** The road out (south) — blocked by a barrier, leads nowhere tonight. */
export const ROAD_SOUTH: P2[] = [[0, 20], [0, 40], [3, 70], [8, 120]];

export const ROADS = [
  { pts: ROAD_VILLAGE, width: 4.2, kind: 'dirt' as const },
  { pts: ROAD_COMPLEX, width: 3.6, kind: 'asphalt' as const },
  { pts: ROAD_SOUTH, width: 6, kind: 'asphalt' as const },
];

export const WORLD_HALF = 200;
/** Playable rectangle (invisible walls); the terrain rises beyond it. */
export const PLAY = { minX: -120, maxX: 110, minZ: -200, maxZ: 40 };

/** Distance from point to polyline + parameter along it (in metres). */
export function distToPolyline(x: number, z: number, pts: P2[]) {
  let best = Infinity, along = 0, acc = 0, bx = 0, bz = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [cx, cz] = pts[i + 1];
    const dx = cx - ax, dz = cz - az;
    const L2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    const L = Math.sqrt(L2);
    if (d < best) {
      best = d;
      along = acc + t * L;
      bx = px;
      bz = pz;
    }
    acc += L;
  }
  return { d: best, along, x: bx, z: bz };
}

function zoneWeight(x: number, z: number) {
  let w = 0;
  for (const zn of Object.values(ZONES)) {
    const dx = Math.max(0, Math.abs(x - zn.x) - zn.hx), dz = Math.max(0, Math.abs(z - zn.z) - zn.hz);
    const d = Math.hypot(dx, dz);
    w = Math.max(w, 1 - smooth(clamp(d / 14, 0, 1)));
  }
  return w;
}

export function roadDistance(x: number, z: number) {
  let d = Infinity;
  for (const r of ROADS) d = Math.min(d, distToPolyline(x, z, r.pts).d - r.width / 2);
  return d;
}

const low = (x: number, z: number) => fbm(x / 90, z / 90, 3) * 3.2;

/** Terrain height. Zones are flat at 0, roads ride the smooth low-frequency layer. */
export function heightAt(x: number, z: number) {
  const zw = zoneWeight(x, z);
  const rd = roadDistance(x, z);
  const rw = 1 - smooth(clamp((rd - 0.5) / 5, 0, 1));
  const hi = fbm(x / 13, z / 13, 3) * 0.9;
  let h = low(x, z) + hi * (1 - rw);
  // slight ditch along road edges
  if (rd > 0.4 && rd < 2.4) h -= Math.sin(((rd - 0.4) / 2) * Math.PI) * 0.25;
  // rise towards the world border (hides the edge, keeps players inside)
  const edge = Math.max(PLAY.minX - x, x - PLAY.maxX, PLAY.minZ - z, z - PLAY.maxZ) + 8;
  if (edge > 0) h += edge * 0.3;
  return h * (1 - zw);
}

/** Surface type for footsteps outside buildings. */
export function groundSurface(x: number, z: number): 'asphalt' | 'gravel' | 'mud' | 'grass' | 'forest' {
  for (const r of ROADS) if (distToPolyline(x, z, r.pts).d < r.width / 2) return r.kind === 'asphalt' ? 'asphalt' : 'mud';
  const b = ZONES.base;
  if (Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz) return 'gravel';
  const v = ZONES.village;
  if (Math.abs(x - v.x) < v.hx && Math.abs(z - v.z) < v.hz) return 'grass';
  const c = ZONES.complex;
  if (Math.abs(x - c.x) < c.hx + 4 && Math.abs(z - c.z) < c.hz + 4) return 'asphalt';
  return 'forest';
}
