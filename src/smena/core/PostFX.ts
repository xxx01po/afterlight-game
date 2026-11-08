import * as THREE from 'three';

/**
 * One full-screen pass (no EffectComposer chain): ACES tone mapping, cold night
 * grading, vignette, animated film grain, damage tint, fear distortion and fades.
 * The scene renders into a (possibly down-scaled) target, which also gives us
 * a cheap render-scale knob for weak GPUs.
 */
export class PostFX {
  readonly rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mat: THREE.ShaderMaterial;
  scale = 1;

  constructor(floatOK: boolean) {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uTime: { value: 0 },
        uExposure: { value: 1.3 },
        uGrain: { value: 0.06 },
        uDamage: { value: 0 },
        uFear: { value: 0 },
        uFade: { value: 0 },
        uStatic: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uTime, uExposure, uGrain, uDamage, uFear, uFade, uStatic;
        uniform vec2 uRes;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
        void main(){
          vec2 c = vUv - 0.5;
          float aspect = uRes.x / uRes.y;
          vec2 uv = vUv;
          // fear: slow breathing warp + chromatic split
          if (uFear > 0.001) {
            float w = sin(uTime * 1.7) * 0.5 + 0.5;
            uv += c * dot(c, c) * uFear * 0.06 * w;
          }
          float ca = uFear * 0.006 + uDamage * 0.004;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + c * ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - c * ca).b;
          col = aces(col * uExposure);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          // night grading: desaturate, teal-blue shadows, warm highlights from lamps
          col = mix(vec3(l), col, 0.78);
          col += vec3(-0.006, 0.004, 0.016) * (1.0 - l) * (1.0 - l);
          col *= mix(vec3(0.93, 0.99, 1.05), vec3(1.05, 1.0, 0.9), smoothstep(0.3, 0.9, l));
          col = pow(max(col, vec3(0.0)), vec3(1.0/2.2));
          float r = length(c * vec2(aspect * 0.72, 1.0));
          float v = smoothstep(0.82, 0.18, r * (0.95 + uFear * 0.35 + uDamage * 0.3));
          col *= mix(0.3, 1.0, v);
          // damage: red edges
          col = mix(col, col * vec3(1.25, 0.35, 0.3), uDamage * smoothstep(0.15, 0.7, r));
          // radio/anomaly static
          float n = hash(vUv * uRes + fract(uTime * 13.37) * 100.0) - 0.5;
          if (uStatic > 0.001) {
            float band = step(0.92, fract(vUv.y * 40.0 + uTime * 7.0)) * uStatic;
            col = mix(col, vec3(n + 0.5) * 0.6, uStatic * 0.35 + band * 0.4);
          }
          col += n * uGrain * (1.25 - l);
          col *= 1.0 - uFade;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  get u() {
    return this.mat.uniforms;
  }

  setSize(w: number, h: number) {
    this.rt.setSize(Math.max(1, Math.floor(w * this.scale)), Math.max(1, Math.floor(h * this.scale)));
    this.mat.uniforms.uRes.value.set(w, h);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, t: number) {
    this.mat.uniforms.uTime.value = t;
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.rt.dispose();
    this.mat.dispose();
  }
}
