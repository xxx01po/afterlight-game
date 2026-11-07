import * as THREE from 'three';
import type { StaticBuilder } from './StaticBuilder';
import type { MatLib } from './materials';
import type { TexLib } from './textures';
import type { Door } from './Door';
import type { PropDef } from '@/smena/core/Physics';
import type { ItemId } from '@/smena/gameplay/items';

export interface Lamp {
  id: string;
  pos: THREE.Vector3;
  color: number;
  intensity: number;
  range: number;
  on: boolean;
  /** Power group: lamps go dark together when their power source is off. */
  power: 'always' | 'base' | 'complex' | 'emergency' | 'village';
  flicker: number;
  bulbs: THREE.Mesh[];
  glow?: THREE.Sprite;
  /** Runtime: 0..1 current flicker multiplier. */
  k: number;
}

export interface Indoor {
  name: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** 0 = open shed, 1 = fully enclosed (rain/wind muffling). */
  closed: number;
}

export interface Pickup {
  id: string;
  item: ItemId;
  count: number;
  mesh: THREE.Object3D;
}

export interface DocSpot {
  id: string;
  docId: string;
  mesh: THREE.Object3D;
}

export interface CctvCam {
  id: string;
  label: string;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

/** Everything zone builders produce; the Game wires gameplay onto it. */
export interface WorldCtx {
  M: MatLib;
  T: TexLib;
  b: StaticBuilder;
  root: THREE.Group;
  doors: Door[];
  props: PropDef[];
  lamps: Lamp[];
  indoors: Indoor[];
  pickups: Pickup[];
  docs: DocSpot[];
  cams: CctvCam[];
  /** Named objects/points for interactions and story beats. */
  spots: Record<string, THREE.Object3D>;
  /** Static decals/meshes that are toggled by story (footprints, figure, etc.). */
  dynamic: Record<string, THREE.Object3D>;
}
