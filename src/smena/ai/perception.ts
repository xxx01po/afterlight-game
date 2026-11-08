/**
 * Pure perception maths (unit-tested). The creature sees with a view cone and
 * range that depend on the player's light, stance and movement, and hears
 * noise events whose radius is set by the player's actions.
 */
export interface SightInput {
  dist: number;
  /** cos of the angle between creature forward and direction to player. */
  cosAngle: number;
  lineOfSight: boolean;
  flashlightOn: boolean;
  /** Flashlight pointing roughly at the creature (it notices being lit). */
  litByFlashlight: boolean;
  crouching: boolean;
  moving: boolean;
  /** Player stands near a lit lamp. */
  inLight: boolean;
  /** Player hides in bushes / dense foliage. */
  inCover: boolean;
}

export const SIGHT = { range: 15, fovCos: Math.cos((115 / 2) * (Math.PI / 180)), nearAware: 2.2 };

/** 0 = invisible, 1 = clearly visible; awareness grows proportionally. */
export function visibility(s: SightInput): number {
  if (!s.lineOfSight) return 0;
  let range = SIGHT.range;
  if (s.flashlightOn) range *= 1.7;
  if (s.inLight) range *= 1.5;
  if (s.crouching) range *= 0.6;
  if (s.inCover) range *= 0.45;
  if (!s.moving) range *= 0.8;
  // anything touching it is noticed regardless of the cone
  if (s.dist < SIGHT.nearAware) return 1;
  // a beam in the face is always noticed from further away
  if (s.litByFlashlight && s.dist < range * 1.4) return 1;
  if (s.cosAngle < SIGHT.fovCos) return 0;
  if (s.dist > range) return 0;
  const k = 1 - s.dist / range;
  // peripheral vision is weaker
  const centre = (s.cosAngle - SIGHT.fovCos) / (1 - SIGHT.fovCos);
  return Math.min(1, k * (0.5 + centre * 0.8) * 1.6);
}

/** Can a noise of `radius` emitted at distance `dist` be heard? Walls halve it. */
export function hears(dist: number, radius: number, throughWalls: boolean) {
  return dist < radius * (throughWalls ? 0.5 : 1);
}

/** Awareness integrator: rises with visibility, decays slowly when unseen. */
export function stepAwareness(a: number, vis: number, dt: number) {
  if (vis > 0) return Math.min(1, a + vis * dt * 1.8);
  return Math.max(0, a - dt * 0.12);
}
