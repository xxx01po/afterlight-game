import * as THREE from 'three';
import { PostFX } from './PostFX';
import type { Quality } from '@/game/state/settings';
import { useSettings } from '@/game/state/settings';
import { clamp } from '@/utils/math';

export interface QualityPreset { pixelRatio: number; renderScale: number; samples: number; mirror: number; tvLive: boolean; grain: number }
export const PRESETS: Record<Quality, QualityPreset> = {
  low: { pixelRatio: 1, renderScale: 0.8, samples: 0, mirror: 0, tvLive: false, grain: 0.05 },
  medium: { pixelRatio: 1.5, renderScale: 1, samples: 0, mirror: 256, tvLive: true, grain: 0.06 },
  high: { pixelRatio: 2, renderScale: 1, samples: 4, mirror: 512, tvLive: true, grain: 0.06 },
};

type Updater = (dt: number, t: number) => void;

/**
 * Owns the WebGL renderer, the camera, the main loop and adaptive quality.
 * Game systems register updaters; the loop is paused by `running = false`.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 140);
  /** Camera used for the actual draw (peephole swaps this). */
  viewCamera: THREE.PerspectiveCamera = this.camera;
  post: PostFX;
  quality: Quality;
  preset: QualityPreset;
  running = false;
  time = 0;
  fps = 60;
  /** Debug/testing only: speeds up simulated time. */
  timeScale = 1;
  private updaters: Updater[] = [];
  private last = 0;
  private raf = 0;
  private frames = 0;
  private fpsAcc = 0;
  private lowFpsStreak = 0;
  private floatOK: boolean;
  onQualityChange?: (q: Quality) => void;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setClearColor(0x05070a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.info.autoReset = false; // count the whole frame (scene + mirror + post)
    const c = this.renderer.domElement;
    c.className = 'game-canvas';
    container.appendChild(c);
    this.floatOK = this.renderer.extensions.has('EXT_color_buffer_float') || this.renderer.extensions.has('EXT_color_buffer_half_float');
    this.quality = useSettings.getState().quality;
    this.preset = PRESETS[this.quality];
    this.post = new PostFX(this.floatOK, this.preset.samples);
    this.scene.fog = new THREE.FogExp2(0x0b0e12, 0.035);
    this.scene.background = new THREE.Color(0x0b0e12);
    this.applyQuality(this.quality);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
  }

  add(u: Updater) {
    this.updaters.push(u);
    return () => (this.updaters = this.updaters.filter((x) => x !== u));
  }

  applyQuality(q: Quality) {
    const changed = q !== this.quality;
    this.quality = q;
    this.preset = PRESETS[q];
    if (changed || this.post.rt.samples !== this.preset.samples) {
      this.post.dispose();
      this.post = new PostFX(this.floatOK, this.preset.samples);
    }
    this.post.scale = this.preset.renderScale;
    this.post.mat.uniforms.uGrain.value = this.preset.grain;
    this.resize();
    if (changed) this.onQualityChange?.(q);
  }

  resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep a ~92° horizontal FOV in landscape; clamp vertical FOV in portrait
    const hfov = THREE.MathUtils.degToRad(92);
    const vfov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)), 52, 82);
    this.camera.fov = vfov;
    this.camera.updateProjectionMatrix();
    if (this.viewCamera !== this.camera) {
      this.viewCamera.aspect = aspect;
      this.viewCamera.updateProjectionMatrix();
    }
    this.post.setSize(w * pr, h * pr);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000) * this.timeScale;
      this.last = now;
      this.time += dt;
      this.renderer.info.reset();
      for (const u of this.updaters) u(dt, this.time);
      this.post.render(this.renderer, this.scene, this.viewCamera, this.time);
      this.measure(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Adaptive quality: step down if the device can't hold ~28 FPS. */
  private measure(dt: number) {
    this.frames++;
    this.fpsAcc += dt;
    if (this.fpsAcc < 2) return;
    this.fps = this.frames / this.fpsAcc;
    this.frames = 0;
    this.fpsAcc = 0;
    if (!useSettings.getState().autoQuality || this.time < 4) return;
    if (this.fps < 27) this.lowFpsStreak++;
    else this.lowFpsStreak = 0;
    if (this.lowFpsStreak >= 2 && this.quality !== 'low') {
      this.lowFpsStreak = 0;
      const next: Quality = this.quality === 'high' ? 'medium' : 'low';
      useSettings.getState().patch({ quality: next });
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
