import * as THREE from 'three';
import { G, groups, type Physics } from '@/smena/core/Physics';
import { glowSprite } from '@/smena/world/textures';

/**
 * Flare pistol round: a ballistic projectile with its own dedicated point light
 * (always in the scene, intensity animated → no shader recompiles). After it
 * lands it keeps burning for a while; the creature will not approach a burning flare.
 */
export class FlareSystem {
  readonly light = new THREE.PointLight(0xff3a1e, 0, 16, 1.4);
  private mesh: THREE.Mesh;
  private glow: THREE.Sprite;
  private vel = new THREE.Vector3();
  private flying = false;
  burning = 0;
  readonly pos = new THREE.Vector3();
  onLand?: (p: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, private ph: () => Physics | null) {
    scene.add(this.light);
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd0b0 }));
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('255,90,50'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.glow.scale.setScalar(2.5);
    this.glow.visible = false;
    scene.add(this.glow);
  }

  fire(origin: THREE.Vector3, dir: THREE.Vector3) {
    this.pos.copy(origin).addScaledVector(dir, 0.4);
    this.vel.copy(dir).multiplyScalar(26);
    this.vel.y += 2;
    this.flying = true;
    this.burning = 14;
    this.mesh.visible = this.glow.visible = true;
  }

  get active() {
    return this.burning > 0;
  }

  update(dt: number, t: number) {
    if (this.burning <= 0) {
      this.light.intensity = 0;
      this.mesh.visible = this.glow.visible = false;
      return;
    }
    this.burning -= dt;
    if (this.flying) {
      const step = this.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const ph = this.ph();
      const hit = ph?.raycast(this.pos, step.clone().normalize(), len + 0.05, groups(0xffff, G.STATIC | G.DOOR | G.PROP | G.CREATURE));
      if (hit) {
        this.pos.copy(hit.point).addScaledVector(hit.normal, 0.08);
        this.flying = false;
        this.onLand?.(this.pos.clone());
      } else {
        this.pos.add(step);
        this.vel.y -= 9.8 * dt * 0.5;
        if (this.pos.y < -10) this.flying = false;
      }
    }
    const flick = 0.75 + 0.25 * Math.sin(t * 37) * Math.sin(t * 13);
    const fade = Math.min(1, this.burning / 2);
    this.light.position.copy(this.pos);
    this.light.intensity = 40 * flick * fade;
    this.mesh.position.copy(this.pos);
    this.glow.position.copy(this.pos);
    (this.glow.material as THREE.SpriteMaterial).opacity = flick * fade;
  }
}
