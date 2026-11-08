import * as THREE from 'three';

export type Verb = 'hand' | 'door' | 'read' | 'take' | 'use' | 'talk' | 'look' | 'locked';

export interface Interactable {
  id: string;
  /** Meshes hit by the aim ray. */
  targets: THREE.Object3D[];
  /** Null hides the prompt (not interactable right now). */
  label: () => string | null;
  verb?: () => Verb;
  range?: number;
  use: () => void;
  enabled?: () => boolean;
}

/**
 * Centre-screen aim: raycasts a small set of interactable meshes (not the whole
 * scene), then checks the physics world so prompts never show through walls.
 */
export class InteractionSystem {
  readonly list: Interactable[] = [];
  private ray = new THREE.Raycaster();
  private targets: THREE.Object3D[] = [];
  private owner = new Map<THREE.Object3D, Interactable>();
  focus: Interactable | null = null;
  focusDist = 0;
  private dirty = true;
  blocked?: (origin: THREE.Vector3, dir: THREE.Vector3, dist: number) => boolean;

  add(i: Interactable) {
    this.list.push(i);
    this.dirty = true;
    return i;
  }
  remove(id: string) {
    const i = this.list.findIndex((x) => x.id === id);
    if (i >= 0) this.list.splice(i, 1);
    this.dirty = true;
  }
  get(id: string) {
    return this.list.find((x) => x.id === id);
  }

  private rebuild() {
    this.targets = [];
    this.owner.clear();
    for (const it of this.list)
      for (const t of it.targets)
        t.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            this.targets.push(o);
            this.owner.set(o, it);
          }
        });
    this.dirty = false;
  }
  markDirty() {
    this.dirty = true;
  }

  update(camera: THREE.Camera) {
    if (this.dirty) this.rebuild();
    this.ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.ray.far = 3;
    const hits = this.ray.intersectObjects(this.targets, false);
    this.focus = null;
    for (const h of hits) {
      const it = this.owner.get(h.object);
      if (!it) continue;
      if (h.distance > (it.range ?? 2.3)) break;
      if (it.enabled && !it.enabled()) continue;
      if (!it.label()) continue;
      if (this.blocked?.(this.ray.ray.origin, this.ray.ray.direction, h.distance)) break;
      this.focus = it;
      this.focusDist = h.distance;
      break;
    }
  }

  activate() {
    const f = this.focus;
    if (f) f.use();
    return !!f;
  }
}
