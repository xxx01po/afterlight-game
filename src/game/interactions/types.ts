import type * as THREE from 'three';

export interface Interactable {
  id: string;
  objects: THREE.Object3D[];
  /** Prompt text or null when currently not interactable. */
  label: () => string | null;
  act: () => void;
  /** Max reach in metres. */
  range?: number;
}
