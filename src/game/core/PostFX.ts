import * as THREE from 'three';

/**
 * Single full-screen pass: ACES tone mapping, cold color grading, vignette,
 * film grain, optional peephole barrel distortion and a "pressure" effect.
 * One pass keeps the cost predictable on phones (no EffectComposer chain).
 */
export class PostFX {
  readonly rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mat: THREE.ShaderMaterial;
  scale = 1;

  constructor(floatOK: boolean, samples: number) {
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      type: floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples,
      depthBuffer: true,
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uTime: { value: 0 },
        uExposure: { value: 1.0 },
        uGrain: { value: 0.06 },
        uVignette: { value: 0.9 },
        uSat: { value: 0.8 },
        uBarrel: { value: 0 },
        uPressure: { value: 0 },
        uFade: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uTime, uExposure, uGrain, uVignette, uSat, uBarrel, uPressure, uFade;
        uniform vec2 uRes;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
        void main(){
          vec2 uv = vUv;
          vec2 c = uv - 0.5;
          float aspect = uRes.x / uRes.y;
          if (uBarrel > 0.0) {
            vec2 cc = c * vec2(aspect, 1.0);
            float r2 = dot(cc, cc);
            uv = 0.5 + c * (1.0 - uBarrel * 0.72 + uBarrel * 1.25 * r2);
          }
          // subtle chromatic split under pressure
          float ca = uPressure * 0.004;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + c * ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - c * ca).b;
          col *= uExposure;
          col = aces(col);
          // grading: desaturate, cold shadows, faint sodium-yellow highlights
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          col += vec3(-0.004, 0.0, 0.012) * (1.0 - l) * (1.0 - l);
          col *= mix(vec3(0.94, 0.98, 1.04), vec3(1.04, 1.0, 0.9), smoothstep(0.35, 0.9, l));
          col = max(col, vec3(0.0));
          // to sRGB
          col = pow(col, vec3(1.0/2.2));
          // vignette (stronger under pressure)
          float v = smoothstep(0.85, 0.2, length(c * vec2(aspect * 0.75, 1.0)) * (uVignette + uPressure * 0.35));
          col *= mix(0.35, 1.0, v);
          if (uBarrel > 0.0) {
            float d = length((vUv - 0.5) * vec2(aspect, 1.0));
            col *= smoothstep(0.47, 0.42, d);
          }
          // grain — animated, stronger in the dark
          float n = hash(vUv * uRes + fract(uTime * 13.37) * 100.0) - 0.5;
          col += n * uGrain * (1.2 - l);
          col *= 1.0 - uFade;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
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
