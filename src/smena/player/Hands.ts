import * as THREE from 'three';
import type { MatLib } from '@/smena/world/materials';
import { damp } from '@/utils/math';

/**
 * View-model: the flashlight in the right hand and, when equipped, the flare
 * pistol. Small, close to the camera, with sway and bob so the world feels handled.
 */
export class Hands {
  readonly root = new THREE.Group();
  readonly torch = new THREE.Group();
  readonly gun = new THREE.Group();
  private lens: THREE.MeshBasicMaterial;
  private sway = new THREE.Vector2();
  private recoil = 0;
  gunOut = false;
  private gunT = 0;
  torchVisible = false;

  constructor(camera: THREE.Camera, M: MatLib) {
    camera.add(this.root);
    // flashlight body
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2620, roughness: 0.45, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), dark);
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.05, 12), dark);
    head.rotation.x = Math.PI / 2;
    head.position.z = -0.1;
    this.lens = new THREE.MeshBasicMaterial({ color: 0x333028 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), this.lens);
    lens.position.z = -0.1251;
    lens.rotation.y = Math.PI;
    const skin = new THREE.MeshStandardMaterial({ color: 0x5a4436, roughness: 0.75 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.085), skin);
    hand.position.set(0.005, -0.012, 0.02);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), M.clothDark);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0.01, -0.02, 0.17);
    this.torch.add(body, head, lens, hand, sleeve);
    this.torch.position.set(0.2, -0.2, -0.36);
    this.root.scale.setScalar(0.8);
    this.torch.rotation.set(0.04, 0.06, 0);
    this.root.add(this.torch);
    // flare pistol (orange plastic, wide barrel)
    const orange = new THREE.MeshStandardMaterial({ color: 0x8a3a14, roughness: 0.5 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10), orange);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.06);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.045), orange);
    grip.position.set(0, -0.025, 0.02);
    grip.rotation.x = -0.25;
    const gh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x5a4436, roughness: 0.75 }));
    gh.position.set(0, -0.03, 0.04);
    this.gun.add(barrel, grip, gh);
    this.gun.position.set(-0.17, -0.22, -0.34);
    this.gun.visible = false;
    this.root.add(this.gun);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.renderOrder = 10;
        m.frustumCulled = false;
      }
    });
    this.torch.visible = false;
  }

  kick() {
    this.recoil = 1;
  }

  update(dt: number, look: { x: number; y: number }, speed: number, t: number, lightOn: boolean) {
    this.sway.x = damp(this.sway.x, look.x * 2.2, 10, dt);
    this.sway.y = damp(this.sway.y, look.y * 2.2, 10, dt);
    const bob = Math.min(1, speed / 4.5);
    const bx = Math.cos(t * 8) * 0.008 * bob, by = Math.abs(Math.sin(t * 8)) * 0.01 * bob;
    this.torch.visible = this.torchVisible;
    this.torch.position.set(0.22 - this.sway.x * 0.05 + bx, -0.23 + this.sway.y * 0.05 - by, -0.38);
    this.lens.color.setHex(lightOn ? 0xd8ccb0 : 0x26241f);
    this.gunT = damp(this.gunT, this.gunOut ? 1 : 0, 10, dt);
    this.gun.visible = this.gunT > 0.02;
    this.recoil = damp(this.recoil, 0, 9, dt);
    this.gun.position.set(-0.19 - this.sway.x * 0.05 - bx, -0.25 - (1 - this.gunT) * 0.3 + this.sway.y * 0.05 - by, -0.4 + this.recoil * 0.06);
    this.gun.rotation.x = this.recoil * 0.5;
  }
}
