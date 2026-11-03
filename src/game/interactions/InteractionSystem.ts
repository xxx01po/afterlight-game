import * as THREE from 'three';
import type { Interactable } from './types';
import { useUI, inputBlocked } from '@/game/state/ui';

/**
 * Centre-screen ray against interactables + occluders. Shows the prompt and
 * dispatches `act()` on demand. Evaluated every other frame (cheap).
 */
export class InteractionSystem {
  private ray = new THREE.Raycaster();
  private center = new THREE.Vector2(0, 0);
  private byId = new Map<string, Interactable>();
  private targets: THREE.Object3D[] = [];
  current: Interactable | null = null;
  private frame = 0;
  private lastLabel: string | null = null;

  constructor(private camera: THREE.Camera, list: Interactable[], occluders: THREE.Object3D[]) {
    for (const i of list) this.byId.set(i.id, i);
    const objs = new Set<THREE.Object3D>();
    list.forEach((i) => i.objects.forEach((o) => objs.add(o)));
    occluders.forEach((o) => objs.add(o));
    this.targets = [...objs];
    this.ray.far = 2.2;
  }

  get(id: string) {
    return this.byId.get(id);
  }

  register(i: Interactable) {
    this.byId.set(i.id, i);
    i.objects.forEach((o) => {
      o.traverse((c) => (c.userData.interactId = i.id));
      this.targets.push(o);
    });
  }

  update() {
    if (++this.frame % 2) return;
    if (inputBlocked()) {
      this.set(null, null);
      return;
    }
    this.ray.setFromCamera(this.center, this.camera);
    const hits = this.ray.intersectObjects(this.targets, true);
    let found: Interactable | null = null;
    for (const h of hits) {
      if (!h.object.visible || !isVisibleChain(h.object)) continue;
      const id = h.object.userData.interactId as string | undefined;
      if (id) {
        const it = this.byId.get(id);
        if (it && h.distance <= (it.range ?? 1.9)) found = it;
      }
      break; // first visible hit decides (occluders block)
    }
    const label = found ? found.label() : null;
    this.set(label ? found : null, label);
  }

  private set(it: Interactable | null, label: string | null) {
    this.current = it;
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      useUI.setState({ prompt: label ? { label } : null });
    }
  }

  /** Force-refresh the prompt (after an action changed labels). */
  refresh() {
    this.lastLabel = '__';
    this.frame = 1;
    this.update();
  }

  interact() {
    if (inputBlocked() || !this.current) return false;
    const label = this.current.label();
    if (!label) return false;
    this.current.act();
    this.refresh();
    return true;
  }
}

function isVisibleChain(o: THREE.Object3D) {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}
