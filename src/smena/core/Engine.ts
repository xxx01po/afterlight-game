import * as THREE from 'three';
import { PostFX } from './PostFX';
import { QUALITY, type QualityProfile } from './quality';
import { useSettings, type Quality } from '@/smena/state/settings';
import { device } from '@/smena/platform/device';
import { clamp } from '@/utils/math';

type Updater = (dt: number, t: number) => void;

export function resolveQuality(): Quality {
  const q = useSettings.getState().quality;
  return q === 'auto' ? device().suggested : q;
}

/**
 * Owns renderer, camera and the main loop. Systems register updaters which
 * run in registration order (input → player → physics → AI → story → audio → render).
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 160);
  post: PostFX;
  quality: Quality;
  profile: QualityProfile;
  running = false;
  paused = false;
  time = 0;
  fps = 60;
  timeScale = 1;
  private updaters: Updater[] = [];
  private renderHooks: ((r: THREE.WebGLRenderer) => void)[] = [];
  private last = 0;
  private raf = 0;
  private frames = 0;
  private fpsAcc = 0;
  private lowStreak = 0;
  private autoLevel: Quality | null = null;
  onQualityChange?: (q: Quality, p: QualityProfile) => void;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setClearColor(0x06080a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    const c = this.renderer.domElement;
    c.className = 'smena-canvas';
    container.appendChild(c);
    const floatOK = this.renderer.extensions.has('EXT_color_buffer_float') || this.renderer.extensions.has('EXT_color_buffer_half_float');
    this.quality = resolveQuality();
    this.profile = QUALITY[this.quality];
    this.post = new PostFX(floatOK);
    this.scene.fog = new THREE.FogExp2(0x0a0d10, this.profile.fogDensity);
    this.scene.background = new THREE.Color(0x0a0d10);
    this.scene.add(this.camera);
    this.applyQuality(this.quality, true);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    c.addEventListener('webglcontextlost', (e) => e.preventDefault());
  }

  add(u: Updater) {
    this.updaters.push(u);
    return () => (this.updaters = this.updaters.filter((x) => x !== u));
  }
  /** Extra render passes (CCTV monitor) executed before the main frame. */
  addRenderHook(h: (r: THREE.WebGLRenderer) => void) {
    this.renderHooks.push(h);
  }

  applyQuality(q: Quality, force = false) {
    if (q === this.quality && !force) return;
    this.quality = q;
    this.profile = QUALITY[q];
    this.post.scale = this.profile.renderScale;
    this.post.u.uGrain.value = this.profile.grain;
    this.renderer.shadowMap.enabled = this.profile.shadow > 0;
    (this.scene.fog as THREE.FogExp2).density = this.profile.fogDensity;
    this.resize();
    this.onQualityChange?.(q, this.profile);
  }

  resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.profile.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    const el = this.renderer.domElement;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    // settings FOV is horizontal-ish for landscape; clamp vertical FOV for portrait/ultrawide
    const hfov = THREE.MathUtils.degToRad(useSettings.getState().fov + 22);
    this.camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)), 50, 80);
    this.camera.updateProjectionMatrix();
    this.post.setSize(w * pr, h * pr);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const raw = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const dt = this.paused ? 0 : raw * this.timeScale;
      this.time += dt;
      this.renderer.info.reset();
      for (const u of this.updaters) u(dt, this.time);
      for (const h of this.renderHooks) h(this.renderer);
      this.post.render(this.renderer, this.scene, this.camera, this.time + (this.paused ? now / 1000 : 0));
      if (!this.paused) this.measure(raw);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Adaptive quality ("auto" only): drop a level after ~6 s under 26 FPS. */
  private measure(dt: number) {
    this.frames++;
    this.fpsAcc += dt;
    if (this.fpsAcc < 2) return;
    this.fps = this.frames / this.fpsAcc;
    this.frames = 0;
    this.fpsAcc = 0;
    if (useSettings.getState().quality !== 'auto' || this.time < 5) return;
    this.lowStreak = this.fps < 26 ? this.lowStreak + 1 : 0;
    if (this.lowStreak >= 3 && this.quality !== 'low') {
      this.lowStreak = 0;
      this.autoLevel = this.quality === 'high' ? 'medium' : 'low';
      this.applyQuality(this.autoLevel);
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.visualViewport?.removeEventListener('resize', this.resize);
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
