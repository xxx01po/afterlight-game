import * as THREE from 'three';
import { glowSprite } from './textures';

export interface Lamp {
  id: string;
  light: THREE.PointLight;
  bulb: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
  base: number;
  /** 0..1 current level (animated: flicker, fade). */
  level: number;
  target: number;
  flicker: number;
  color: THREE.Color;
}

let glowTex: THREE.Texture | null = null;

/** A ceiling/desk lamp: point light + emissive bulb + additive glow sprite (fake bloom). */
export function makeLamp(id: string, parent: THREE.Object3D, x: number, y: number, z: number, intensity: number, color = 0xffd9a8, distance = 9, glowSize = 0.5): Lamp {
  glowTex ??= glowSprite();
  const c = new THREE.Color(color);
  const light = new THREE.PointLight(c, intensity, distance, 2);
  light.position.set(x, y - 0.12, z);
  parent.add(light);
  const bulb = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3) });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb);
  b.position.set(x, y - 0.12, z);
  parent.add(b);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
  glow.scale.setScalar(glowSize);
  glow.position.copy(b.position);
  parent.add(glow);
  return { id, light, bulb, glow, base: intensity, level: 1, target: 1, flicker: 0, color: c };
}

export function updateLamp(l: Lamp, dt: number, t: number) {
  const speed = l.target > l.level ? 14 : 9;
  l.level += (l.target - l.level) * Math.min(1, dt * speed);
  let f = 1;
  if (l.flicker > 0) {
    // irregular mains flicker: bursts of drop-outs
    const n = Math.sin(t * 37.1) * Math.sin(t * 13.7 + 1.3) * Math.sin(t * 5.3);
    f = n > 0.35 - l.flicker * 0.4 ? 0.08 : 1;
  }
  const v = Math.max(0, l.level * f);
  l.light.intensity = l.base * v;
  l.bulb.color.copy(l.color).multiplyScalar(0.25 + v * 2.75);
  (l.glow.material as THREE.SpriteMaterial).opacity = 0.6 * v;
  l.glow.visible = v > 0.02;
}
