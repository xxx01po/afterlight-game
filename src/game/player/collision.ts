import type { AABB } from '@/game/world/builder';

/**
 * Resolve a circle (player) against axis-aligned boxes on the XZ plane.
 * Returns the corrected position. Pure function — unit tested.
 */
export function resolveCircle(x: number, z: number, r: number, boxes: readonly AABB[], iterations = 3): [number, number] {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const b of boxes) {
      if (b.enabled === false) continue;
      const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
      const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the shallowest axis
        const l = x - b.minX, rr = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) x = b.minX - r;
        else if (m === rr) x = b.maxX + r;
        else if (m === t) z = b.minZ - r;
        else z = b.maxZ + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}
