import * as THREE from 'three';

export interface RigOpts {
  height: number;
  /** 1 = human proportions; < 1 = emaciated. */
  girth: number;
  /** Arm length multiplier. */
  arms: number;
  body: THREE.Material;
  skin: THREE.Material;
  eyes?: THREE.Material;
  cap?: THREE.Material;
}

export interface Rig {
  root: THREE.Group;
  hips: THREE.Object3D;
  spine: THREE.Object3D;
  neck: THREE.Object3D;
  head: THREE.Object3D;
  arm: [THREE.Object3D, THREE.Object3D][]; // [upper, fore] L, R
  leg: [THREE.Object3D, THREE.Object3D][]; // [thigh, shin] L, R
  opts: RigOpts;
}

function limb(len: number, r0: number, r1: number, mat: THREE.Material) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 2);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/**
 * Procedural humanoid built from a joint hierarchy (no skinning — cheap and
 * robust on mobile). Used for the creature and for the "guard" apparitions.
 */
export function buildHumanoid(o: RigOpts): Rig {
  const s = o.height / 1.8;
  const gw = o.girth;
  const root = new THREE.Group();
  const hips = new THREE.Object3D();
  hips.position.y = 0.95 * s;
  root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s * gw, 0.18 * s, 0.18 * s * gw), o.body);
  hips.add(pelvis);
  const spine = new THREE.Object3D();
  spine.position.y = 0.08 * s;
  hips.add(spine);
  const torsoG = new THREE.CylinderGeometry(0.19 * s * gw, 0.14 * s * gw, 0.55 * s, 8, 3);
  torsoG.translate(0, 0.28 * s, 0);
  torsoG.scale(1, 1, 0.65);
  const torso = new THREE.Mesh(torsoG, o.body);
  torso.castShadow = true;
  spine.add(torso);
  const neck = new THREE.Object3D();
  neck.position.y = 0.58 * s;
  spine.add(neck);
  const nk = limb(0.12 * s, 0.045 * s * gw, 0.04 * s * gw, o.skin);
  nk.rotation.x = Math.PI;
  nk.position.y = 0;
  neck.add(nk);
  const head = new THREE.Object3D();
  head.position.y = 0.12 * s;
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 10, 8), o.skin);
  skull.scale.set(0.85, 1.15, 0.95);
  skull.position.y = 0.1 * s;
  skull.castShadow = true;
  head.add(skull);
  if (o.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.105 * s, 0.11 * s, 0.07 * s, 10), o.cap);
    cap.position.y = 0.2 * s;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.012 * s, 0.08 * s), o.cap);
    visor.position.set(0, 0.17 * s, 0.11 * s);
    head.add(cap, visor);
  }
  if (o.eyes) {
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 6, 4), o.eyes);
      e.position.set(sx * 0.035 * s, 0.11 * s, 0.095 * s);
      head.add(e);
    }
  }
  const arm: Rig['arm'] = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Object3D();
    sh.position.set(sx * 0.2 * s * gw, 0.52 * s, 0);
    spine.add(sh);
    const ul = 0.3 * s * o.arms, fl = 0.3 * s * o.arms;
    sh.add(limb(ul, 0.05 * s * gw, 0.04 * s * gw, o.body));
    const el = new THREE.Object3D();
    el.position.y = -ul;
    sh.add(el);
    el.add(limb(fl, 0.04 * s * gw, 0.028 * s * gw, o.arms > 1.2 ? o.skin : o.body));
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.16 * s * Math.min(1.6, o.arms), 0.025 * s), o.skin);
    hand.position.y = -fl - 0.07 * s * o.arms;
    el.add(hand);
    arm.push([sh, el]);
  }
  const leg: Rig['leg'] = [];
  for (const sx of [-1, 1]) {
    const th = new THREE.Object3D();
    th.position.set(sx * 0.1 * s * gw, -0.05 * s, 0);
    hips.add(th);
    const tl = 0.45 * s, sl = 0.45 * s;
    th.add(limb(tl, 0.075 * s * gw, 0.055 * s * gw, o.body));
    const kn = new THREE.Object3D();
    kn.position.y = -tl;
    th.add(kn);
    kn.add(limb(sl, 0.055 * s * gw, 0.04 * s * gw, o.body));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s, 0.05 * s, 0.24 * s), o.skin);
    foot.position.set(0, -sl - 0.02 * s, 0.06 * s);
    kn.add(foot);
    leg.push([th, kn]);
  }
  return { root, hips, spine, neck, head, arm, leg, opts: o };
}

export type Gait = 'idle' | 'walk' | 'run' | 'crawl' | 'attack' | 'stand';

/** Procedural animation. `phase` advances with distance walked. */
export function animateRig(r: Rig, phase: number, gait: Gait, t: number, twitch = 0) {
  const sw = gait === 'run' ? 0.8 : gait === 'walk' ? 0.45 : 0;
  const s = Math.sin(phase), c = Math.cos(phase);
  r.leg[0][0].rotation.x = s * sw;
  r.leg[1][0].rotation.x = -s * sw;
  r.leg[0][1].rotation.x = Math.max(0, -c) * sw * 1.4;
  r.leg[1][1].rotation.x = Math.max(0, c) * sw * 1.4;
  const hunch = gait === 'run' ? 0.45 : gait === 'crawl' ? 1.1 : gait === 'stand' ? 0 : 0.18;
  r.spine.rotation.x = hunch + Math.sin(t * 1.3) * 0.02;
  r.hips.position.y = r.opts.height / 1.8 * 0.95 - Math.abs(s) * 0.04 * sw - (gait === 'crawl' ? 0.35 : 0);
  // arms hang and swing; long-armed things drag them
  const armSw = sw * (r.opts.arms > 1.2 ? 0.35 : 0.8);
  r.arm[0][0].rotation.x = -s * armSw + (gait === 'attack' ? -2.2 : 0);
  r.arm[1][0].rotation.x = s * armSw + (gait === 'attack' ? -2.0 : 0);
  r.arm[0][0].rotation.z = -0.08;
  r.arm[1][0].rotation.z = 0.08;
  r.arm[0][1].rotation.x = gait === 'attack' ? -0.4 : -0.15 - Math.max(0, s) * 0.3;
  r.arm[1][1].rotation.x = gait === 'attack' ? -0.5 : -0.15 - Math.max(0, -s) * 0.3;
  // head: slow tilt, sudden twitches
  const tw = twitch > 0 ? Math.sin(t * 60) * 0.25 * twitch : 0;
  r.neck.rotation.z = Math.sin(t * 0.4) * 0.2 + tw + (r.opts.arms > 1.2 ? 0.35 : 0);
  r.neck.rotation.x = -hunch * 0.7 + (gait === 'stand' ? 0.1 : 0);
  r.head.rotation.y = Math.sin(t * 0.23) * 0.3;
}
