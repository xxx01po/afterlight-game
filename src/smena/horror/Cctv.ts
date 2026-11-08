import * as THREE from 'three';
import type { CctvCam } from '@/smena/world/ctx';
import { makeCanvas } from '@/utils/canvas';

/** Objects on this layer are seen ONLY by security cameras. */
export const CCTV_LAYER = 1;

interface Screen {
  mesh: THREE.Mesh;
  feeds: string[];
  idx: number;
  mat: THREE.ShaderMaterial;
}

/**
 * Real security cameras: a second camera renders the scene into a small render
 * target (only while the player stands at a monitor, ~8 fps), shown on CRT
 * screens through a grainy black-and-white shader. Apparitions live on a layer
 * the player's eyes cannot see — they exist only on the monitor.
 */
export class Cctv {
  readonly rt: THREE.WebGLRenderTarget;
  readonly cam = new THREE.PerspectiveCamera(62, 4 / 3, 0.1, 60);
  private screens: Screen[] = [];
  private feeds = new Map<string, CctvCam>();
  private acc = 0;
  private active: Screen | null = null;
  private label: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private clock = '00:41';
  glitch = 0;
  private tmp = new THREE.Vector3();
  onFeed?: (id: string) => void;

  constructor(res: number, cams: CctvCam[]) {
    this.rt = new THREE.WebGLRenderTarget(res, Math.round(res * 0.75), { depthBuffer: true });
    this.cam.layers.enable(CCTV_LAYER);
    for (const c of cams) this.feeds.set(c.id, c);
    const { c, ctx } = makeCanvas(256, 192);
    const tex = new THREE.CanvasTexture(c);
    this.label = { c, ctx, tex };
  }

  addFeed(c: CctvCam) {
    this.feeds.set(c.id, c);
  }

  addScreen(mesh: THREE.Mesh, feeds: string[]) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tFeed: { value: this.rt.texture }, tLabel: { value: this.label.tex }, uTime: { value: 0 }, uOn: { value: 0 }, uGlitch: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tFeed; uniform sampler2D tLabel; uniform float uTime; uniform float uOn; uniform float uGlitch;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec2 c = uv - 0.5;
          uv = 0.5 + c * (1.0 + dot(c,c) * 0.25);
          uv.x += (h(vec2(floor(uv.y * 60.0), floor(uTime * 12.0))) - 0.5) * 0.02 * uGlitch;
          vec3 col = texture2D(tFeed, uv).rgb;
          float l = dot(col, vec3(0.3, 0.59, 0.11));
          l = pow(clamp(l * 2.6, 0.0, 1.0), 0.8);
          float n = h(uv * 300.0 + uTime);
          l = l * 0.85 + n * 0.12;
          l *= 0.85 + 0.15 * sin(uv.y * 400.0 + uTime * 8.0);
          vec4 lab = texture2D(tLabel, vUv);
          vec3 o = vec3(l * 0.85, l, l * 0.9);
          o = mix(o, vec3(1.0), lab.a * 0.9);
          float vig = smoothstep(0.75, 0.3, length(c));
          o *= vig;
          vec3 off = vec3(n * 0.08 + 0.02);
          gl_FragColor = vec4(mix(off, o, uOn), 1.0);
        }`,
    });
    mesh.material = mat;
    this.screens.push({ mesh, feeds, idx: 0, mat });
  }

  /** Cycle the feed on the given screen. */
  next(mesh: THREE.Object3D) {
    const s = this.screens.find((x) => x.mesh === mesh);
    if (!s || s.feeds.length < 2) return null;
    s.idx = (s.idx + 1) % s.feeds.length;
    this.drawLabel(s);
    this.onFeed?.(s.feeds[s.idx]);
    return s.feeds[s.idx];
  }
  setFeed(mesh: THREE.Object3D, id: string) {
    const s = this.screens.find((x) => x.mesh === mesh);
    if (!s) return;
    const i = s.feeds.indexOf(id);
    if (i >= 0) s.idx = i;
    this.drawLabel(s);
  }
  currentFeed(mesh: THREE.Object3D) {
    const s = this.screens.find((x) => x.mesh === mesh);
    return s ? s.feeds[s.idx] : null;
  }

  setClock(c: string) {
    this.clock = c;
    if (this.active) this.drawLabel(this.active);
  }

  private drawLabel(s: Screen) {
    const { ctx, c, tex } = this.label;
    const f = this.feeds.get(s.feeds[s.idx]);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(f?.label ?? '—', 10, 22);
    ctx.fillText('14.11.86  ' + this.clock, 10, c.height - 12);
    ctx.fillStyle = '#f33';
    ctx.beginPath();
    ctx.arc(c.width - 20, 18, 5, 0, 7);
    ctx.fill();
    tex.needsUpdate = true;
  }

  /** Called every frame; renders only when a powered screen is close to the player. */
  update(dt: number, t: number, playerPos: THREE.Vector3, powered: (s: THREE.Mesh) => boolean) {
    let best: Screen | null = null, bd = 4.5;
    for (const s of this.screens) {
      s.mat.uniforms.uTime.value = t;
      s.mat.uniforms.uGlitch.value = this.glitch;
      if (!powered(s.mesh)) continue;
      const d = s.mesh.getWorldPosition(this.tmp).distanceTo(playerPos);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    // one shared render target: only the screen in use shows a live picture, the rest show snow
    for (const s of this.screens) s.mat.uniforms.uOn.value = s === best && s.feeds.length > 0 ? 1 : 0;
    if (best !== this.active && best) this.drawLabel(best);
    this.active = best;
    this.acc += dt;
    this.glitch = Math.max(0, this.glitch - dt * 0.5);
  }

  renderHook = (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => {
    const s = this.active;
    if (!s || this.acc < 1 / 8) return;
    this.acc = 0;
    const f = this.feeds.get(s.feeds[s.idx]);
    if (!f) return;
    this.cam.position.copy(f.pos);
    this.cam.lookAt(f.look);
    this.cam.updateMatrixWorld();
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(prev);
  };

  get activeScreen() {
    return this.active?.mesh ?? null;
  }
}
