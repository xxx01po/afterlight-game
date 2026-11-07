import * as THREE from 'three';
import { animateRig, buildHumanoid, type Rig } from './rig';
import { CCTV_LAYER } from './Cctv';

/** A man in a guard's jacket — your double. Used for every apparition. */
export function guardFigure(): Rig {
  const body = new THREE.MeshLambertMaterial({ color: 0x23272a });
  const skin = new THREE.MeshLambertMaterial({ color: 0x4a3c34 });
  const cap = new THREE.MeshLambertMaterial({ color: 0x1b1f22 });
  const r = buildHumanoid({ height: 1.8, girth: 1.05, arms: 1, body, skin, cap });
  animateRig(r, 0, 'stand', 0);
  r.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return r;
}

export function setLayerOnly(o: THREE.Object3D, layer: number) {
  o.traverse((x) => x.layers.set(layer));
}

export interface Apparition {
  rig: Rig;
  visible: boolean;
}

/** Figures owned by the anomaly system. */
export class Figures {
  readonly cctvMan = guardFigure();
  readonly boothSitter = guardFigure();
  readonly roadMan = guardFigure();
  readonly windowMan = guardFigure();

  constructor(scene: THREE.Scene) {
    for (const f of [this.cctvMan, this.boothSitter, this.roadMan, this.windowMan]) {
      f.root.visible = false;
      scene.add(f.root);
    }
    setLayerOnly(this.cctvMan.root, CCTV_LAYER);
    setLayerOnly(this.boothSitter.root, CCTV_LAYER);
    // seated pose
    const b = this.boothSitter;
    b.hips.position.y = 0.55;
    b.leg[0][0].rotation.x = b.leg[1][0].rotation.x = -1.5;
    b.leg[0][1].rotation.x = b.leg[1][1].rotation.x = 1.5;
    b.arm[0][0].rotation.x = b.arm[1][0].rotation.x = -0.9;
    b.neck.rotation.x = 0.35;
  }

  place(f: Rig, x: number, y: number, z: number, faceX: number, faceZ: number) {
    f.root.position.set(x, y, z);
    f.root.rotation.y = Math.atan2(faceX - x, faceZ - z);
    f.root.visible = true;
  }

  update(t: number) {
    // barely-there idle sway: they stand too still to be alive
    for (const f of [this.cctvMan, this.roadMan, this.windowMan]) if (f.root.visible) f.neck.rotation.z = Math.sin(t * 0.3) * 0.05;
  }
}
