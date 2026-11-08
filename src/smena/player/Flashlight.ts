import * as THREE from 'three';
import { damp } from '@/utils/math';

/**
 * Hand flashlight: a spot light that lags slightly behind the view (hand inertia),
 * drains its battery, dims and flickers when low, and can be disturbed by anomalies.
 */
export class Flashlight {
  readonly light: THREE.SpotLight;
  readonly target = new THREE.Object3D();
  on = false;
  battery = 100;
  /** Seconds of full charge. */
  capacity = 330;
  owned = false;
  private flick = 0;
  private disturb = 0;
  private aim = new THREE.Vector2();
  private baseIntensity = 75;

  constructor(private camera: THREE.PerspectiveCamera) {
    const l = new THREE.SpotLight(0xfff1dc, 0, 28, 0.5, 0.5, 1.25);
    l.position.set(0.18, -0.16, 0.05);
    l.shadow.mapSize.set(512, 512);
    l.shadow.camera.near = 0.2;
    l.shadow.camera.far = 22;
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.02;
    this.light = l;
    camera.add(l);
    camera.add(this.target);
    this.target.position.set(0, 0, -6);
    l.target = this.target;
  }

  setShadow(size: number) {
    this.light.castShadow = size > 0;
    if (size > 0 && this.light.shadow.mapSize.x !== size) {
      this.light.shadow.mapSize.set(size, size);
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
    }
  }

  toggle() {
    if (!this.owned) return false;
    if (!this.on && this.battery <= 0) return false;
    this.on = !this.on;
    return true;
  }

  recharge() {
    this.battery = 100;
  }

  /** Anomaly / creature nearby: unstable light. 0..1 */
  setDisturbance(v: number) {
    this.disturb = v;
  }

  update(dt: number, lookDelta: { x: number; y: number }, t: number) {
    if (this.on) {
      this.battery = Math.max(0, this.battery - (dt / this.capacity) * 100);
      if (this.battery <= 0) this.on = false;
    }
    // hand lag: light trails the view a little
    this.aim.x = damp(this.aim.x, -lookDelta.x * 18, 8, dt);
    this.aim.y = damp(this.aim.y, lookDelta.y * 18, 8, dt);
    this.target.position.set(this.aim.x, this.aim.y, -6);
    let k = 1;
    const low = this.battery < 18;
    if (low) k *= 0.45 + this.battery / 33;
    if ((low && Math.random() < dt * 1.4) || (this.disturb > 0 && Math.random() < dt * 6 * this.disturb)) this.flick = 0.05 + Math.random() * 0.25;
    if (this.flick > 0) {
      this.flick -= dt;
      k *= 0.15 + 0.3 * Math.abs(Math.sin(t * 90));
    }
    const target = this.on ? this.baseIntensity * k : 0;
    this.light.intensity = damp(this.light.intensity, target, this.on ? 30 : 40, dt);
  }

  /** Is world point p inside the lit cone (used by AI and anomalies)? */
  illuminates(p: THREE.Vector3, maxDist = 18) {
    if (!this.on || this.light.intensity < 3) return false;
    const o = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
    const d = p.clone().sub(o);
    const len = d.length();
    if (len > maxDist) return false;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return d.normalize().dot(fwd) > Math.cos(0.42);
  }
}
