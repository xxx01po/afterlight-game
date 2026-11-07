import type * as RAPIER_NS from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export type RAPIER = typeof RAPIER_NS;
export type RBody = RAPIER_NS.RigidBody;
export type RCollider = RAPIER_NS.Collider;

/** Collision groups (membership bits). Interaction groups = membership << 16 | filter. */
export const G = { STATIC: 1, PROP: 2, PLAYER: 4, CREATURE: 8, DOOR: 16 } as const;
const ALL = 0xffff;
export const groups = (member: number, filter = ALL) => ((member & 0xffff) << 16) | (filter & 0xffff);

export type StaticShape =
  | { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; ry?: number; surface?: string }
  | { kind: 'cyl'; x: number; y: number; z: number; r: number; hh: number; surface?: string }
  | { kind: 'mesh'; vertices: Float32Array; indices: Uint32Array; surface?: string };

export interface PropDef {
  mesh: THREE.Object3D;
  shape: 'box' | 'cyl' | 'ball';
  size: THREE.Vector3; // half-extents (box), (r, hh, r) for cylinder, (r) for ball
  mass: number;
  /** Plays when it collides hard. */
  material: 'wood' | 'metal' | 'glass' | 'plastic' | 'cardboard';
  grabbable: boolean;
  id: string;
}

export interface Prop extends PropDef {
  body: RBody;
  collider: RCollider;
  home: THREE.Vector3;
  held: boolean;
}

let loading: Promise<RAPIER> | null = null;
export function loadRapier(): Promise<RAPIER> {
  loading ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    const R = (m as unknown as { default?: RAPIER }).default ?? (m as unknown as RAPIER);
    await R.init();
    return R;
  });
  return loading;
}

export interface RayHit { point: THREE.Vector3; normal: THREE.Vector3; dist: number; collider: RCollider; owner: unknown }

/**
 * Rapier wrapper: fixed 60 Hz stepping with accumulator, static world from
 * shape descriptions, dynamic props synced to meshes, activation radius
 * (distant props are disabled entirely), and contact-force events for impact sounds.
 */
export class Physics {
  readonly world: RAPIER_NS.World;
  readonly props: Prop[] = [];
  readonly owners = new Map<number, unknown>();
  readonly surfaces = new Map<number, string>();
  private acc = 0;
  private events: RAPIER_NS.EventQueue;
  private ground: RBody;
  activeRadius = 30;
  onImpact?: (p: Prop, force: number) => void;
  private tmpQ = new THREE.Quaternion();

  constructor(readonly R: RAPIER) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.events = new R.EventQueue(true);
    this.ground = this.world.createRigidBody(R.RigidBodyDesc.fixed());
  }

  addStatics(list: StaticShape[]) {
    const R = this.R;
    for (const s of list) {
      let d: RAPIER_NS.ColliderDesc;
      if (s.kind === 'box') {
        d = R.ColliderDesc.cuboid(s.hx, s.hy, s.hz).setTranslation(s.x, s.y, s.z);
        if (s.ry) {
          this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry);
          d.setRotation({ x: this.tmpQ.x, y: this.tmpQ.y, z: this.tmpQ.z, w: this.tmpQ.w });
        }
      } else if (s.kind === 'cyl') d = R.ColliderDesc.cylinder(s.hh, s.r).setTranslation(s.x, s.y, s.z);
      else d = R.ColliderDesc.trimesh(s.vertices, s.indices);
      d.setCollisionGroups(groups(G.STATIC)).setFriction(0.8);
      const c = this.world.createCollider(d, this.ground);
      if (s.surface) this.surfaces.set(c.handle, s.surface);
    }
  }

  addProp(def: PropDef): Prop {
    const R = this.R;
    const m = def.mesh;
    m.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.matrixWorld.decompose(p, q, sc);
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(0.15).setAngularDamping(0.4).setCanSleep(true),
    );
    let cd: RAPIER_NS.ColliderDesc;
    if (def.shape === 'box') cd = R.ColliderDesc.cuboid(def.size.x, def.size.y, def.size.z);
    else if (def.shape === 'cyl') cd = R.ColliderDesc.cylinder(def.size.y, def.size.x);
    else cd = R.ColliderDesc.ball(def.size.x);
    cd.setMass(def.mass).setFriction(0.7).setRestitution(def.material === 'metal' ? 0.25 : 0.1).setCollisionGroups(groups(G.PROP));
    cd.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(6 * def.mass + 4);
    const collider = this.world.createCollider(cd, body);
    body.sleep();
    // the mesh is now driven by physics in world space
    if (m.parent) m.parent.remove(m);
    m.position.copy(p);
    m.quaternion.copy(q);
    const prop: Prop = { ...def, body, collider, home: p.clone(), held: false };
    this.owners.set(collider.handle, prop);
    this.props.push(prop);
    return prop;
  }

  /** Fixed anchor body for joints (doors). */
  get fixedBody() {
    return this.ground;
  }

  step(dt: number, focus: THREE.Vector3) {
    this.acc = Math.min(this.acc + dt, 1 / 20);
    let n = 0;
    while (this.acc >= 1 / 60 && n < 3) {
      this.world.step(this.events);
      this.acc -= 1 / 60;
      n++;
    }
    if (n) {
      this.events.drainContactForceEvents((e) => {
        const a = this.owners.get(e.collider1()) as Prop | undefined;
        const b = this.owners.get(e.collider2()) as Prop | undefined;
        const p = a && 'body' in a ? a : b && 'body' in b ? b : undefined;
        if (p) this.onImpact?.(p, e.maxForceMagnitude());
      });
    }
    const r2 = this.activeRadius * this.activeRadius;
    for (const pr of this.props) {
      const t = pr.body.translation();
      const dx = t.x - focus.x, dz = t.z - focus.z;
      const near = dx * dx + dz * dz < r2 || pr.held;
      // Distant props are removed from the simulation entirely (not just asleep).
      if (near !== pr.body.isEnabled()) {
        if (near || pr.body.isSleeping()) pr.body.setEnabled(near);
      }
      if (!pr.body.isEnabled() || pr.body.isSleeping()) continue;
      const r = pr.body.rotation();
      pr.mesh.position.set(t.x, t.y, t.z);
      pr.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // fell through the world → put it back
      if (t.y < -20) {
        pr.body.setTranslation(pr.home, true);
        pr.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, max: number, filterGroups = groups(ALL, G.STATIC | G.PROP | G.DOOR | G.CREATURE), exclude?: RCollider): RayHit | null {
    const ray = new this.R.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, max, true, undefined, filterGroups, exclude);
    if (!hit) return null;
    const point = origin.clone().addScaledVector(dir, hit.timeOfImpact);
    return { point, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), dist: hit.timeOfImpact, collider: hit.collider, owner: this.owners.get(hit.collider.handle) };
  }

  /** True if nothing static blocks the segment a→b (used by AI line of sight). */
  clearLine(a: THREE.Vector3, b: THREE.Vector3) {
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-3) return true;
    d.divideScalar(len);
    return !this.raycast(a, d, len - 0.05, groups(ALL, G.STATIC | G.DOOR));
  }
}
