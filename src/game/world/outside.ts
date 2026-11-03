import * as THREE from 'three';
import type { WorldBuilder } from './builder';
import { facade, radialBlob, glowSprite } from './textures';
import { rng } from '@/utils/math';

const GROUND = -10.6;

/** Courtyard seen through the windows: panel blocks, a streetlamp, cars, trees, rain. */
export function buildOutside(b: WorldBuilder) {
  const g = new THREE.Group();
  b.root.add(g);
  const R = rng(99);

  // wet asphalt
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshPhongMaterial({ color: 0x0e1013, shininess: 90, specular: 0x30363c }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(5, GROUND, 45);
  g.add(asphalt);
  // our own facade (seen at an angle from the windows' edges) — simple dark slab
  const own = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({ color: 0x2c3034 }));
  own.position.set(4, 4, 7.0);
  own.rotation.y = Math.PI;
  void own;

  // opposite panel blocks
  const f1 = facade(3, 0.12);
  const blockA = new THREE.Mesh(new THREE.PlaneGeometry(72, 27), new THREE.MeshLambertMaterial({ map: f1.map, emissiveMap: f1.emissive, emissive: 0xffffff, emissiveIntensity: 1.4 }));
  blockA.position.set(6, GROUND + 13.5, 38);
  blockA.rotation.y = Math.PI;
  g.add(blockA);
  const f2 = facade(4, 0.08);
  const blockB = new THREE.Mesh(new THREE.PlaneGeometry(50, 27), new THREE.MeshLambertMaterial({ map: f2.map, emissiveMap: f2.emissive, emissive: 0xffffff, emissiveIntensity: 1.2 }));
  blockB.position.set(40, GROUND + 13.5, 22);
  blockB.rotation.y = -Math.PI / 2;
  g.add(blockB);
  // distant roofs / city haze
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(200, 40), new THREE.MeshBasicMaterial({ color: 0x1b2028, fog: false }));
  haze.position.set(5, 10, 70);
  haze.rotation.y = Math.PI;
  g.add(haze);

  // streetlamp with a light pool on the asphalt (no real light: cheap)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 6), new THREE.MeshLambertMaterial({ color: 0x1a1c1e }));
  pole.position.set(9, GROUND + 3.5, 16);
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), pole.material);
  arm.position.set(8.4, GROUND + 7, 16);
  g.add(arm);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('255,214,150'), color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  lampGlow.position.set(7.8, GROUND + 6.9, 16);
  lampGlow.scale.setScalar(3.2);
  g.add(lampGlow);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: radialBlob('rgba(255,200,130,0.55)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(7.8, GROUND + 0.02, 16);
  g.add(pool);

  // parked cars
  const carMat = new THREE.MeshPhongMaterial({ color: 0x1d2228, shininess: 80, specular: 0x444444 });
  const winMat = new THREE.MeshPhongMaterial({ color: 0x07090b, shininess: 120, specular: 0x666666 });
  for (const [x, z, ry] of [[2, 14, 0.1], [-4, 13.6, -0.05], [13, 13.8, 0.02], [22, 18, 1.5]]) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.8), carMat);
    body.position.y = 0.6;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), winMat);
    cab.position.set(-0.2, 1.25, 0);
    car.add(body, cab);
    car.position.set(x, GROUND, z);
    car.rotation.y = ry;
    g.add(car);
  }
  // trees (layered silhouettes)
  const treeMat = new THREE.MeshBasicMaterial({ color: 0x07090a, transparent: true, map: treeTexture(), depthWrite: false, alphaTest: 0.3 });
  for (let i = 0; i < 7; i++) {
    const tr = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), treeMat);
    tr.position.set(-12 + i * 5.5 + R() * 2, GROUND + 4.5, 20 + R() * 8);
    tr.rotation.y = Math.PI + (R() - 0.5) * 0.4;
    g.add(tr);
  }
  // playground frame
  const pm = new THREE.MeshLambertMaterial({ color: 0x23282b });
  for (const dx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), pm);
    leg.position.set(16 + dx, GROUND + 1.2, 26);
    g.add(leg);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.08), pm);
  bar.position.set(16, GROUND + 2.4, 26);
  g.add(bar);

  // rain volume in front of the facade
  const rain = makeRain(1800, new THREE.Vector3(-4, GROUND, 7.2), new THREE.Vector3(12, 14, 9));
  g.add(rain.mesh);

  // replace window glass with a rain-on-glass shader
  const glassMat = rainGlassMaterial();
  b.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.windowGlass) {
      (o as THREE.Mesh).material = glassMat;
      o.renderOrder = 5;
    }
  });

  return {
    group: g,
    update(t: number) {
      rain.uniforms.uTime.value = t;
      glassMat.uniforms.uTime.value = t;
    },
    lampGlow,
  };
}

function makeRain(n: number, origin: THREE.Vector3, size: THREE.Vector3) {
  const pos = new Float32Array(n * 2 * 3);
  const seed = new Float32Array(n * 2);
  const R = rng(5);
  for (let i = 0; i < n; i++) {
    const x = origin.x + R() * size.x, y = origin.y + R() * size.y, z = origin.z + R() * size.z;
    const s = R();
    pos.set([x, y, z, x - 0.02, y, z], i * 6);
    seed[i * 2] = s;
    seed[i * 2 + 1] = s + 10.0; // >=10 marks the tail vertex
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uTop: { value: origin.y + size.y }, uH: { value: size.y } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime, uTop, uH; varying float vA;
      void main(){
        vec3 p = position;
        float tail = step(10.0, seed);
        float s = seed - tail * 10.0;
        float fall = uTime * (7.5 + s * 3.0) + s * uH;
        p.y = uTop - mod(uTop - p.y + fall, uH) - tail * 0.38;
        vA = (0.18 + s * 0.22) * (1.0 - tail * 0.7);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ gl_FragColor = vec4(0.62,0.68,0.76, vA); }`,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function rainGlassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vW; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float drops(vec2 uv, float t){
        vec2 g = uv * vec2(18.0, 10.0);
        vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        float r = h(id);
        float y = fract(r * 7.0 - t * (0.05 + r * 0.25));
        vec2 c = vec2((r - 0.5) * 0.6, y - 0.5);
        float d = length((f - c) * vec2(1.0, 0.7));
        float trail = smoothstep(0.06, 0.0, abs(f.x - c.x)) * smoothstep(-0.5, c.y, f.y) * step(f.y, c.y) * 0.35;
        return smoothstep(0.16, 0.05, d) * step(0.55, r) + trail * step(0.75, r);
      }
      void main(){
        vec2 uv = vec2(vW.x + vW.z, vW.y) * 0.9;
        float d = drops(uv, uTime) + 0.6 * drops(uv * 1.7 + 3.1, uTime * 0.7);
        float stat = smoothstep(0.93, 1.0, h(floor(uv * 90.0))) * 0.5;
        float a = 0.10 + d * 0.38 + stat * 0.2;
        vec3 col = mix(vec3(0.05,0.07,0.09), vec3(0.55,0.62,0.7), d + stat);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

function treeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const x = c.getContext('2d')!;
  const R = rng(7);
  x.fillStyle = '#000';
  x.fillRect(60, 110, 8, 82);
  for (let i = 0; i < 70; i++) {
    x.beginPath();
    x.arc(64 + (R() - 0.5) * 90, 70 + (R() - 0.5) * 100, 6 + R() * 14, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = '#000';
  for (let i = 0; i < 12; i++) {
    x.beginPath();
    x.moveTo(64, 120);
    x.lineTo(64 + (R() - 0.5) * 120, 20 + R() * 90);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
