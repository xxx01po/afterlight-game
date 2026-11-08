import type { Quality } from '@/smena/state/settings';

export interface QualityProfile {
  pixelRatio: number;
  renderScale: number;
  /** Flashlight shadow map size; 0 disables shadows. */
  shadow: number;
  /** Number of pooled point lights (fixed per profile → no shader recompiles while playing). */
  pointLights: number;
  rain: number;
  dust: number;
  treeDistance: number;
  treeHiDistance: number;
  fogDensity: number;
  cctvRes: number;
  grain: number;
  hrtf: boolean;
  /** Standard (PBR) material for wet surfaces, Lambert otherwise. */
  pbr: boolean;
  physicsRadius: number;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1, renderScale: 0.75, shadow: 0, pointLights: 2, rain: 1200, dust: 120, treeDistance: 55, treeHiDistance: 18, fogDensity: 0.05, cctvRes: 128, grain: 0.05, hrtf: false, pbr: false, physicsRadius: 22 },
  medium: { pixelRatio: 1.5, renderScale: 0.9, shadow: 0, pointLights: 3, rain: 2400, dust: 220, treeDistance: 75, treeHiDistance: 28, fogDensity: 0.042, cctvRes: 192, grain: 0.055, hrtf: false, pbr: true, physicsRadius: 30 },
  high: { pixelRatio: 2, renderScale: 1, shadow: 1024, pointLights: 4, rain: 4200, dust: 360, treeDistance: 95, treeHiDistance: 40, fogDensity: 0.036, cctvRes: 256, grain: 0.06, hrtf: true, pbr: true, physicsRadius: 40 },
};
