import type { Quality } from '@/smena/state/settings';

export interface DeviceInfo {
  touch: boolean;
  ios: boolean;
  android: boolean;
  gpu: string;
  memory: number;
  cores: number;
  suggested: Quality;
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'unknown';
  }
}

/** Heuristic first guess; the engine then adapts at runtime based on measured FPS. */
export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const gpu = gpuName();
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? (ios ? 4 : 4);
  const cores = navigator.hardwareConcurrency || 4;
  let suggested: Quality = 'medium';
  const g = gpu.toLowerCase();
  const weakGpu = /mali-(4|t6|t7|g5[12])|adreno \(tm\) (3|4|50|51|52|60)|powervr|swiftshader|llvmpipe|software/.test(g);
  const strongGpu = /apple m\d|adreno \(tm\) (7[3-9]|8)|mali-g7[1-9]|nvidia|geforce|radeon|rtx|intel\(r\) arc|apple gpu/.test(g);
  if (!touch && !weakGpu) suggested = 'high';
  else if (weakGpu || memory <= 2 || cores <= 4) suggested = 'low';
  else if (strongGpu && memory >= 6) suggested = 'high';
  if (ios) suggested = memory >= 6 || screen.width * devicePixelRatio >= 1170 ? 'medium' : 'low';
  return { touch, ios, android, gpu, memory, cores, suggested };
}

let cached: DeviceInfo | null = null;
export const device = () => (cached ??= detectDevice());
