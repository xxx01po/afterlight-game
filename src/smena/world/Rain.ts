import * as THREE from 'three';

/**
 * GPU rain: streak segments in a box that follows the camera; the vertex shader
 * animates and wraps them, so the CPU cost is one uniform update per frame.
 * Indoors the rain is masked by a simple "roof" test against indoor volumes.
 */
export class Rain {
  readonly mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  constructor(count: number) {
    const pos = new Float32Array(count * 2 * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 40 - 20, y = Math.random() * 20, z = Math.random() * 40 - 20;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0;
      seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uWind: { value: new THREE.Vector2(1.2, 0.4) },
        uRoofMin: { value: new THREE.Vector3(1e6, 0, 0) },
        uRoofMax: { value: new THREE.Vector3(1e6, 0, 0) },
        uLight: { value: 0.0 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float tip;
        uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; uniform vec3 uRoofMin; uniform vec3 uRoofMax;
        varying float vA; varying float vTip;
        void main(){
          vec3 p = position;
          float speed = 11.0 + fract(p.x * 7.13) * 4.0;
          p.y = mod(p.y - uTime * speed, 20.0);
          p.xz += uWind * (20.0 - p.y) * 0.06;
          // wrap around the camera
          p.x = mod(p.x - uCam.x + 20.0, 40.0) - 20.0 + uCam.x;
          p.z = mod(p.z - uCam.z + 20.0, 40.0) - 20.0 + uCam.z;
          p.y += uCam.y - 6.0;
          vec3 dir = normalize(vec3(uWind.x * 0.06, -1.0, uWind.y * 0.06));
          p -= dir * tip * 0.55;
          vec3 wp = p;
          bool under = all(greaterThan(wp, uRoofMin)) && all(lessThan(wp, uRoofMax));
          float d = distance(wp, uCam);
          vA = under ? 0.0 : smoothstep(22.0, 3.0, d) * smoothstep(0.3, 1.5, d);
          vTip = tip;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLight; uniform float uOpacity;
        varying float vA; varying float vTip;
        void main(){
          float a = vA * mix(0.05, 0.22, 1.0 - vTip) * (0.6 + uLight) * uOpacity;
          gl_FragColor = vec4(vec3(0.72, 0.78, 0.84), a);
        }`,
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  /** Indoors: volume of the building the camera is in (rain is hidden under its roof). */
  setRoof(min: THREE.Vector3 | null, max?: THREE.Vector3) {
    if (!min || !max) this.mat.uniforms.uRoofMin.value.set(1e6, 0, 0), this.mat.uniforms.uRoofMax.value.set(1e6, 0, 0);
    else this.mat.uniforms.uRoofMin.value.copy(min).subScalar(0.3), this.mat.uniforms.uRoofMax.value.copy(max).addScalar(0.3).setY(100);
  }

  update(t: number, cam: THREE.Vector3, lightNear: number, intensity: number) {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uCam.value.copy(cam);
    u.uLight.value = lightNear;
    u.uOpacity.value = intensity;
    u.uWind.value.set(1.2 + Math.sin(t * 0.13) * 0.8, 0.4 + Math.cos(t * 0.1) * 0.5);
  }
}

/** Floating dust motes, mostly visible inside the flashlight cone. */
export class Dust {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  constructor(count: number) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([Math.random() * 12 - 6, Math.random() * 4, Math.random() * 12 - 6], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uOn: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uCam; uniform vec3 uDir; uniform float uPx;
        varying float vL;
        void main(){
          vec3 p = position;
          p += vec3(sin(uTime*0.3+p.y*3.0), sin(uTime*0.2+p.x*2.0)*0.5, cos(uTime*0.25+p.z*3.0)) * 0.25;
          p.x = mod(p.x - uCam.x + 6.0, 12.0) - 6.0 + uCam.x;
          p.z = mod(p.z - uCam.z + 6.0, 12.0) - 6.0 + uCam.z;
          p.y = mod(p.y - uCam.y + 2.0, 4.0) - 2.0 + uCam.y;
          vec3 d = p - uCam;
          float dist = length(d);
          float cone = smoothstep(0.82, 0.97, dot(normalize(d), uDir));
          vL = cone * smoothstep(8.0, 0.8, dist) * smoothstep(0.2, 0.6, dist);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * 2.2 / max(0.3, -mv.z) * 3.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOn; varying float vL;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c)) * vL * uOn * 0.5;
          gl_FragColor = vec4(1.0, 0.95, 0.85, a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  update(t: number, cam: THREE.Camera, on: number, px: number) {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uCam.value.setFromMatrixPosition(cam.matrixWorld);
    u.uDir.value.set(0, 0, -1).applyQuaternion(cam.quaternion);
    u.uOn.value = on;
    u.uPx.value = px;
  }
}
