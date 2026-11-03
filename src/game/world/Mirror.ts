import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export const REFLECTION_LAYER = 1;

/**
 * Bathroom mirror. A real planar reflection (Reflector) plus a simple
 * silhouette "body" of the player that only reflection cameras can see.
 * The silhouette follows a delayed pose history — the reflection can lag.
 */
export class Mirror {
  readonly reflector: Reflector | null;
  readonly fallback: THREE.Mesh;
  readonly avatar: THREE.Group;
  private head: THREE.Mesh;
  private history: { t: number; x: number; z: number; yaw: number; pitch: number }[] = [];
  /** Seconds of lag applied to the reflected body. 0 = normal. */
  lag = 0;
  /** When set, the reflection keeps looking at the player even when they turn. */
  stare = false;
  private frame = 0;

  constructor(parent: THREE.Object3D, spot: { pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number }, resolution: number) {
    const geo = new THREE.PlaneGeometry(spot.w, spot.h);
    const yaw = Math.atan2(spot.normal.x, spot.normal.z);
    if (resolution > 0) {
      this.reflector = new Reflector(geo, { textureWidth: resolution, textureHeight: Math.round(resolution * (spot.h / spot.w)), color: 0x8a9496, clipBias: 0.003 });
      this.reflector.position.copy(spot.pos);
      // throttle: refresh the reflection every second frame only
      const orig = this.reflector.onBeforeRender;
      this.reflector.onBeforeRender = (...args) => {
        if (this.frame % 2 === 0) orig.apply(this.reflector!, args);
      };
      this.reflector.rotation.y = yaw;
      parent.add(this.reflector);
    } else this.reflector = null;
    // grime overlay / fallback surface
    this.fallback = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x1a1d1f, shininess: 120, specular: 0x555555, transparent: true, opacity: resolution > 0 ? 0.28 : 1 }));
    this.fallback.position.copy(spot.pos).addScaledVector(spot.normal, 0.002);
    this.fallback.rotation.y = yaw;
    parent.add(this.fallback);

    // silhouette body (layer 1 only)
    this.avatar = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x24282c });
    const skin = new THREE.MeshLambertMaterial({ color: 0xb09a88 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 10), dark);
    body.position.y = 1.0;
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), dark);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.y = 1.38;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), skin);
    this.head.position.y = 1.62;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.116, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), dark);
    hair.position.set(0, 1.645, 0.02);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), dark);
    hood.position.set(0, 1.47, 0.04);
    hood.rotation.x = Math.PI / 2;
    this.avatar.add(body, shoulders, this.head, hair, hood);
    this.avatar.traverse((o) => o.layers.set(REFLECTION_LAYER));
    parent.add(this.avatar);
  }

  /** Make the reflection camera see the avatar layer. */
  bindCamera(cam: THREE.Camera) {
    if (!this.reflector) return;
    const rc = this.reflector.getReflectionCamera(cam);
    rc.layers.enable(REFLECTION_LAYER);
  }

  update(t: number, x: number, z: number, yaw: number, pitch: number, active: boolean) {
    this.history.push({ t, x, z, yaw, pitch });
    while (this.history.length > 2 && this.history[0].t < t - 3) this.history.shift();
    const target = t - this.lag;
    let pose = this.history[this.history.length - 1];
    for (let i = this.history.length - 1; i >= 0; i--)
      if (this.history[i].t <= target) {
        pose = this.history[i];
        break;
      }
    this.avatar.position.set(pose.x, 0, pose.z);
    this.avatar.rotation.y = this.stare ? Math.atan2(-(x - pose.x), -(z - pose.z)) : pose.yaw;
    this.head.rotation.x = -pose.pitch * 0.6;
    this.frame++;
    if (this.reflector) this.reflector.visible = active;
  }
}
