import * as THREE from 'three';
import type { Tex, TexLib } from './textures';

export type Mat = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

function lam(t: Tex | null, color = 0xffffff, extra: THREE.MeshLambertMaterialParameters = {}): Mat {
  const m = new THREE.MeshLambertMaterial({ color, map: t?.map ?? null, ...extra });
  if (t?.bump) {
    m.bumpMap = t.bump;
    m.bumpScale = 1.2;
  }
  m.userData.tile = t?.tile ?? 1;
  return m;
}

function std(t: Tex | null, color: number, rough: number, metal: number, pbr: boolean, extra: THREE.MeshStandardMaterialParameters = {}): Mat {
  if (!pbr) return lam(t, color);
  const m = new THREE.MeshStandardMaterial({ color, map: t?.map ?? null, roughness: rough, metalness: metal, ...extra });
  if (t?.bump) {
    m.bumpMap = t.bump;
    m.bumpScale = 1.5;
  }
  m.userData.tile = t?.tile ?? 1;
  return m;
}

/** All shared materials. PBR is used only where wetness/specular sells the image (roads, metal, puddles). */
export function buildMaterials(T: TexLib, pbr: boolean) {
  const foliage = (t: Tex, color: number) =>
    new THREE.MeshLambertMaterial({ color, map: t.map, alphaTest: 0.45, side: THREE.DoubleSide });
  const m = {
    barkSpruce: lam(T.barkSpruce, 0x9a8f86),
    barkPine: lam(T.barkPine, 0xb09a88),
    barkDead: lam(T.barkDead, 0x9a9892),
    birch: lam(T.birch, 0xe0ddd5),
    spruce: foliage(T.needles, 0x6f8a70),
    spruceDark: foliage(T.needles2, 0x546c5a),
    pine: foliage(T.needles, 0x7d8f64),
    bush: foliage(T.leaves, 0x8a9070),
    bushDry: foliage(T.leavesDry, 0x9a8a68),
    terrain: lam(T.forest, 0xffffff, { color: 0xd8d0c0 }),
    asphalt: std(T.asphalt, 0x8a8c8e, 0.32, 0.0, pbr),
    dirtRoad: std(T.mud, 0x9a8c7c, 0.5, 0, pbr),
    gravel: std(T.gravel, 0x9a9890, 0.6, 0, pbr),
    concrete: std(T.concrete, 0xbab6ae, 0.75, 0, pbr),
    concreteDark: lam(T.concreteDark, 0x9a968e),
    panel: std(T.panel, 0xb4b0a8, 0.7, 0, pbr),
    wallGreen: lam(T.wallGreen),
    wallBlue: lam(T.wallBlue),
    wallLab: lam(T.wallLab),
    tilesLab: std(T.tilesLab, 0xffffff, 0.35, 0, pbr),
    tilesFloor: std(T.tilesFloor, 0xffffff, 0.45, 0, pbr),
    linoleum: std(T.linoleum, 0xffffff, 0.5, 0, pbr),
    wallpaper: lam(T.wallpaper),
    planks: lam(T.planks),
    planksGrey: lam(T.planksGrey),
    planksDark: lam(T.planksDark),
    logs: lam(T.logs, 0xc8baa8),
    roofTin: std(T.roofTin, 0xa09a92, 0.45, 0.5, pbr),
    roofTinClean: std(T.roofTinClean, 0x8a9aa0, 0.4, 0.6, pbr),
    metalGreen: std(T.metalGreen, 0xffffff, 0.55, 0.45, pbr),
    metalGrey: std(T.metalGrey, 0xffffff, 0.5, 0.6, pbr),
    metalRust: std(T.metalRust, 0xffffff, 0.8, 0.3, pbr),
    metalBlue: std(T.metalBlue, 0xffffff, 0.5, 0.4, pbr),
    metalWhite: std(T.metalWhite, 0xffffff, 0.45, 0.3, pbr),
    rubber: lam(null, 0x161616),
    black: lam(null, 0x0b0b0b),
    fabric: lam(null, 0x4a3f36),
    fabricBlue: lam(null, 0x2f3a48),
    mattress: lam(null, 0x8a8170),
    paper: lam(null, 0xd8d0b8),
    chainlink: new THREE.MeshLambertMaterial({ map: T.chainlink.map, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xb0b0a8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8fa3a8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    glassDirty: new THREE.MeshLambertMaterial({ color: 0x55605a, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    bulbOn: new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
    bulbOff: lam(null, 0x3a3a34),
    lampCold: new THREE.MeshBasicMaterial({ color: 0xd8f0ff }),
    redLed: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    greenLed: new THREE.MeshBasicMaterial({ color: 0x40ff60 }),
    screenOff: new THREE.MeshStandardMaterial({ color: 0x080a0a, roughness: 0.15, metalness: 0.1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.35, metalness: 0.05 }),
    clothDark: lam(null, 0x1c1e1f),
    water: new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.05, metalness: 0.6 }),
  };
  for (const k of ['spruce', 'spruceDark', 'pine', 'bush', 'bushDry', 'chainlink'] as const) m[k].userData.tile = 1;
  return m;
}
export type MatLib = ReturnType<typeof buildMaterials>;
export type MatName = keyof MatLib;
