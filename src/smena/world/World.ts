import * as THREE from 'three';
import { buildTextures, type TexLib } from './textures';
import { buildMaterials, type MatLib } from './materials';
import { StaticBuilder } from './StaticBuilder';
import { buildTerrain } from './terrain';
import { Forest, vegetationBlocked } from './trees';
import { buildBase } from './base';
import { buildForest } from './forest';
import { buildVillage } from './village';
import { buildComplex } from './complex';
import { Dust, Rain } from './Rain';
import { LightPool } from './LightPool';
import type { WorldCtx, Indoor } from './ctx';
import type { Physics, StaticShape } from '@/smena/core/Physics';
import { PLAY } from './layout';
import type { QualityProfile } from '@/smena/core/quality';
import { setWindTime } from './trees';

function skyDome() {
  const g = new THREE.SphereGeometry(130, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform float uTime; uniform float uFlash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float y = clamp(vP.y, 0.0, 1.0);
        vec3 hor = vec3(0.035, 0.042, 0.05), zen = vec3(0.008, 0.01, 0.014);
        vec3 col = mix(hor, zen, pow(y, 0.6));
        vec2 uv = vP.xz / (vP.y + 0.3) * 2.0 + vec2(uTime * 0.01, uTime * 0.004);
        float cl = n(uv) * 0.6 + n(uv * 2.3) * 0.3 + n(uv * 5.1) * 0.1;
        // moon glow behind clouds (north-east)
        vec3 moonDir = normalize(vec3(0.5, 0.45, -0.75));
        float moon = pow(max(dot(vP, moonDir), 0.0), 18.0);
        col += vec3(0.12, 0.13, 0.14) * moon * (0.5 + cl);
        col *= 0.75 + cl * 0.5;
        col += vec3(0.5, 0.55, 0.65) * uFlash * (0.4 + cl);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Assembles all zones into one scene. Visuals are built synchronously (fast);
 * physics is attached later, once Rapier's WASM has finished loading.
 */
export class World {
  readonly T: TexLib;
  readonly M: MatLib;
  readonly ctx: WorldCtx;
  readonly forest: Forest;
  readonly terrain: THREE.Mesh;
  readonly rain: Rain;
  readonly dust: Dust;
  readonly pool: LightPool;
  readonly sky: THREE.Mesh;
  readonly hemi: THREE.HemisphereLight;
  readonly moon: THREE.DirectionalLight;
  private staticMeshes: THREE.Mesh[] = [];
  private terrainCollider;
  private lightning = 0;
  private nextLightning = 30;
  onThunder?: (delay: number, strength: number) => void;

  constructor(readonly scene: THREE.Scene, profile: QualityProfile) {
    this.T = buildTextures();
    this.M = buildMaterials(this.T, profile.pbr);
    const b = new StaticBuilder(this.M);
    const root = new THREE.Group();
    root.name = 'world';
    scene.add(root);
    this.ctx = { M: this.M, T: this.T, b, root, doors: [], props: [], lamps: [], indoors: [], pickups: [], docs: [], cams: [], spots: {}, dynamic: {} };
    const t = buildTerrain(this.M.terrain as THREE.MeshLambertMaterial);
    this.terrain = t.mesh;
    this.terrainCollider = t.collider;
    root.add(t.mesh);
    buildBase(this.ctx);
    buildForest(this.ctx);
    buildVillage(this.ctx);
    buildComplex(this.ctx);
    this.staticMeshes = b.build(root, profile.shadow > 0);
    this.forest = new Forest(this.M, vegetationBlocked);
    root.add(this.forest.group);
    this.sky = skyDome();
    scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0x5a6a80, 0x1a1712, 1.0);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8a9ab0, 0.55);
    this.moon.position.set(40, 60, -60);
    scene.add(this.moon);
    this.rain = new Rain(profile.rain);
    scene.add(this.rain.mesh);
    this.dust = new Dust(profile.dust);
    scene.add(this.dust.points);
    this.pool = new LightPool(scene, this.ctx.lamps, profile.pointLights, this.M);
    this.applyProfile(profile);
  }

  applyProfile(p: QualityProfile) {
    this.forest.drawDistance = p.treeDistance;
    this.forest.hiDistance = p.treeHiDistance;
    this.pool.setCount(p.pointLights);
  }

  attachPhysics(ph: Physics) {
    const P = PLAY, cx = (P.minX + P.maxX) / 2, cz = (P.minZ + P.maxZ) / 2, hx = (P.maxX - P.minX) / 2, hz = (P.maxZ - P.minZ) / 2;
    const walls: StaticShape[] = [
      { kind: 'box', x: P.minX - 1, y: 10, z: cz, hx: 1, hy: 30, hz: hz + 2 },
      { kind: 'box', x: P.maxX + 1, y: 10, z: cz, hx: 1, hy: 30, hz: hz + 2 },
      { kind: 'box', x: cx, y: 10, z: P.minZ - 1, hx: hx + 2, hy: 30, hz: 1 },
      { kind: 'box', x: cx, y: 10, z: P.maxZ + 1, hx: hx + 2, hy: 30, hz: 1 },
    ];
    ph.addStatics([this.terrainCollider, ...walls, ...this.ctx.b.colliders, ...this.forest.colliders]);
    for (const d of this.ctx.doors) d.attach(ph);
    for (const p of this.ctx.props) ph.addProp(p);
  }

  indoorAt(p: THREE.Vector3): Indoor | null {
    for (const i of this.ctx.indoors) if (p.x > i.min.x && p.x < i.max.x && p.z > i.min.z && p.z < i.max.z && p.y < i.max.y + 0.5) return i;
    return null;
  }

  get drawCalls() {
    return this.staticMeshes.length;
  }

  update(dt: number, t: number, camera: THREE.PerspectiveCamera, pos: THREE.Vector3, flashOn: number, pxRatio: number) {
    setWindTime(t);
    this.forest.update(camera, pos);
    this.pool.update(dt, pos);
    const ind = this.indoorAt(pos);
    this.rain.setRoof(ind && ind.closed > 0.25 ? ind.min : null, ind?.max);
    this.rain.update(t, camera.position, flashOn, 1);
    this.dust.update(t, camera, flashOn, pxRatio);
    this.sky.position.copy(camera.position);
    const su = (this.sky.material as THREE.ShaderMaterial).uniforms;
    su.uTime.value = t;
    // distant lightning: sky flash, then thunder after a delay
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = 35 + Math.random() * 60;
      this.lightning = 1;
      this.onThunder?.(2 + Math.random() * 5, 0.4 + Math.random() * 0.6);
    }
    this.lightning = Math.max(0, this.lightning - dt * 3);
    const fl = this.lightning > 0.6 || (this.lightning > 0.2 && this.lightning < 0.35) ? this.lightning : 0;
    su.uFlash.value = fl;
    this.hemi.intensity = 1.0 + fl * 2.2;
    // doors
    for (const d of this.ctx.doors) d.update(dt);
  }
}
