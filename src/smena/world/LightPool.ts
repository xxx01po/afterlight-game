import * as THREE from 'three';
import type { Lamp } from './ctx';

/**
 * Fixed pool of real point lights (count depends on the quality profile and never
 * changes while playing, so shaders are never recompiled). Each frame the nearest
 * lit lamps get a real light; every other lamp is only an emissive bulb + glow sprite.
 */
export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  private t = 0;
  powered: Record<Lamp['power'], boolean> = { always: true, base: false, complex: false, emergency: true, village: false };

  constructor(private scene: THREE.Scene, private lamps: Lamp[], count: number, private M: { bulbOn: THREE.Material; bulbOff: THREE.Material }) {
    this.setCount(count);
  }

  setCount(n: number) {
    while (this.lights.length > n) this.scene.remove(this.lights.pop()!);
    while (this.lights.length < n) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  lit(l: Lamp) {
    return l.on && this.powered[l.power];
  }

  update(dt: number, cam: THREE.Vector3) {
    this.t += dt;
    for (const l of this.lamps) {
      const on = this.lit(l);
      // flicker: occasional dips, more frequent with higher `flicker`
      let k = on ? 1 : 0;
      if (on && l.flicker > 0) {
        const n = Math.sin(this.t * 23 + l.pos.x) * Math.sin(this.t * 7.3 + l.pos.z);
        if (n > 1 - l.flicker * 0.35) k = 0.15 + Math.random() * 0.3;
        if (Math.random() < dt * l.flicker * 0.4) k = 0;
      }
      l.k = k;
      for (const b of l.bulbs) b.material = k > 0.5 ? this.M.bulbOn : this.M.bulbOff;
      if (l.glow) {
        l.glow.visible = k > 0.05;
        (l.glow.material as THREE.SpriteMaterial).opacity = 0.55 * k;
      }
    }
    // nearest lit lamps get real lights
    const cand = this.lamps.filter((l) => l.k > 0.01).map((l) => ({ l, d: l.pos.distanceToSquared(cam) - l.range * l.range * 0.6 }));
    cand.sort((a, b) => a.d - b.d);
    this.lights.forEach((pl, i) => {
      const c = cand[i];
      if (!c || c.d > 60 * 60) {
        // never toggle .visible: that changes the light count and recompiles every shader
        pl.intensity = 0;
        return;
      }
      pl.position.copy(c.l.pos);
      pl.color.setHex(c.l.color);
      pl.distance = c.l.range;
      pl.intensity = c.l.intensity * c.l.k;
    });
  }
}
