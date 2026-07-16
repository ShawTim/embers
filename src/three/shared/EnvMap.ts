import * as THREE from "three";
import { getPerlin, fbm2D } from "./PBRNoise";

// ---------------------------------------------------------------------------
//  EnvMap — procedural HDR cubemap.  The cubemap acts as an
//  environment light source for all PBR materials in the scene
//  (reflections, indirect light).  We build a 6-face render-target
//  cubemap on a canvas, then upload it as an equirectangular HDR
//  texture that three.js can sample for IBL.
//
//  The cubemap is dynamic per chapter (different scene / time of
//  day) so the "world" feels alive.
// ---------------------------------------------------------------------------

export interface EnvConfig {
  // Top half (sky)
  topColor: { r: number; g: number; b: number };
  midColor: { r: number; g: number; b: number };
  // Bottom half (ground)
  bottomColor: { r: number; g: number; b: number };
  // Sun / moon
  sunColor: { r: number; g: number; b: number };
  sunSize: number;       // 0..1 angular size
  sunIntensity: number;  // 0..3 HDR strength
  // Atmosphere
  horizonGlow: number;   // 0..1 strength
  starCount: number;     // 0 = no stars
  // Cloud noise (optional)
  cloudFreq: number;
  cloudCoverage: number; // 0..1
  cloudSharpness: number;
  // Three.js scene fog colour (linear hex string, e.g. "#1a1e2a")
  fogColor: string;
}

const DEFAULT_CH1_NIGHT: EnvConfig = {
  topColor: { r: 0.02, g: 0.04, b: 0.10 },
  midColor: { r: 0.08, g: 0.10, b: 0.20 },
  bottomColor: { r: 0.05, g: 0.04, b: 0.03 },
  sunColor: { r: 1.6, g: 1.5, b: 1.0 },
  sunSize: 0.02,
  sunIntensity: 4.0,
  horizonGlow: 0.3,
  starCount: 200,
  cloudFreq: 4,
  cloudCoverage: 0.3,
  cloudSharpness: 0.5,
  fogColor: "#141a26",
};

const DAY_DAWN: EnvConfig = {
  topColor: { r: 0.40, g: 0.55, b: 0.85 },
  midColor: { r: 0.75, g: 0.55, b: 0.50 },
  bottomColor: { r: 0.45, g: 0.40, b: 0.30 },
  sunColor: { r: 2.5, g: 1.8, b: 1.0 },
  sunSize: 0.04,
  sunIntensity: 6.0,
  horizonGlow: 0.6,
  starCount: 0,
  cloudFreq: 4,
  cloudCoverage: 0.4,
  cloudSharpness: 0.4,
  fogColor: "#3a4458",
};

const DUNGEON_TORCH: EnvConfig = {
  topColor: { r: 0.04, g: 0.03, b: 0.02 },
  midColor: { r: 0.08, g: 0.06, b: 0.04 },
  bottomColor: { r: 0.06, g: 0.04, b: 0.03 },
  sunColor: { r: 2.5, g: 1.2, b: 0.4 },
  sunSize: 0.08,
  sunIntensity: 2.0,
  horizonGlow: 0.0,
  starCount: 0,
  cloudFreq: 1,
  cloudCoverage: 0.0,
  cloudSharpness: 0.5,
  fogColor: "#0a0805",
};

const ICE_FROZEN: EnvConfig = {
  topColor: { r: 0.55, g: 0.70, b: 0.85 },
  midColor: { r: 0.78, g: 0.85, b: 0.92 },
  bottomColor: { r: 0.65, g: 0.70, b: 0.75 },
  sunColor: { r: 1.8, g: 1.9, b: 2.2 },
  sunSize: 0.03,
  sunIntensity: 4.0,
  horizonGlow: 0.4,
  starCount: 0,
  cloudFreq: 3,
  cloudCoverage: 0.5,
  cloudSharpness: 0.6,
  fogColor: "#bcd6e8",
};

const LAVA_VOLCANIC: EnvConfig = {
  topColor: { r: 0.18, g: 0.10, b: 0.06 },
  midColor: { r: 0.40, g: 0.18, b: 0.08 },
  bottomColor: { r: 0.30, g: 0.10, b: 0.04 },
  sunColor: { r: 2.5, g: 1.0, b: 0.3 },
  sunSize: 0.06,
  sunIntensity: 3.0,
  horizonGlow: 0.9,
  starCount: 50,
  cloudFreq: 5,
  cloudCoverage: 0.6,
  cloudSharpness: 0.5,
  fogColor: "#3a0a08",
};

export function envForChapter(chapterId: string): EnvConfig {
  const id = chapterId.toLowerCase();
  if (id.includes("dungeon") || id.includes("crypt") || id.includes("cave") || id.includes("tom")) return DUNGEON_TORCH;
  if (id.includes("ice") || id.includes("frozen") || id.includes("mount")) return ICE_FROZEN;
  if (id.includes("volcano") || id.includes("lava") || id.includes("inferno")) return LAVA_VOLCANIC;
  if (id === "ch01" || id === "ch02" || id === "ch03" || id === "ch04" || id === "ch05") return DEFAULT_CH1_NIGHT;
  return DAY_DAWN;
}

function buildEquirectangular(
  cfg: EnvConfig,
  w: number = 1024,
  h: number = 512,
): { data: Uint8ClampedArray; size: [number, number] } {
  const data = new Uint8ClampedArray(w * h * 4);
  const perlin = getPerlin(7);
  const perlin2 = getPerlin(13);
  const rng = (() => {
    let s = 12345 | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  // Pre-bake star positions
  const stars: { x: number; y: number; b: number }[] = [];
  for (let i = 0; i < cfg.starCount; i++) {
    stars.push({ x: rng() * w, y: rng() * h * 0.5, b: 0.4 + rng() * 0.6 });
  }
  const sunU = 0.5, sunV = 0.30; // position on equirect
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      // v=0 is the top (sky), v=1 is bottom (ground)
      let r: number, g: number, b: number;
      if (v < 0.5) {
        const t = v * 2; // 0 at top, 1 at horizon
        r = cfg.topColor.r + (cfg.midColor.r - cfg.topColor.r) * t;
        g = cfg.topColor.g + (cfg.midColor.g - cfg.topColor.g) * t;
        b = cfg.topColor.b + (cfg.midColor.b - cfg.topColor.b) * t;
      } else {
        const t = (v - 0.5) * 2;
        r = cfg.midColor.r + (cfg.bottomColor.r - cfg.midColor.r) * t;
        g = cfg.midColor.g + (cfg.bottomColor.g - cfg.midColor.g) * t;
        b = cfg.midColor.b + (cfg.bottomColor.b - cfg.midColor.b) * t;
      }
      // horizon glow band
      if (cfg.horizonGlow > 0) {
        const horizonDist = Math.abs(v - 0.5);
        const glow = Math.exp(-horizonDist * 14) * cfg.horizonGlow;
        r += glow * 0.45;
        g += glow * 0.20;
        b += glow * 0.10;
      }
      // sun / moon
      {
        const du = u - sunU, dv = v - sunV;
        const dist = Math.sqrt(du * du + dv * dv);
        if (dist < cfg.sunSize * 4) {
          const k = Math.max(0, 1 - dist / (cfg.sunSize * 4));
          const sunR = k * k * cfg.sunIntensity * cfg.sunColor.r;
          const sunG = k * k * cfg.sunIntensity * cfg.sunColor.g;
          const sunB = k * k * cfg.sunIntensity * cfg.sunColor.b;
          r += sunR; g += sunG; b += sunB;
        }
      }
      // cloud noise (only above horizon)
      if (v < 0.5 && cfg.cloudCoverage > 0) {
        const cn = fbm2D(perlin, u * cfg.cloudFreq, (v * 2) * cfg.cloudFreq, 4, 2.0, 0.5);
        const cm = THREE.MathUtils.smoothstep(cn, 1 - cfg.cloudCoverage - cfg.cloudSharpness, 1 - cfg.cloudCoverage + cfg.cloudSharpness);
        const cMul = 1 - cm * 0.7;
        r *= cMul; g *= cMul; b *= cMul;
        // cloud highlight
        const ch = fbm2D(perlin2, u * cfg.cloudFreq * 1.5, (v * 2) * cfg.cloudFreq * 1.5, 3, 2.0, 0.5);
        if (ch > 0.65) {
          const hl = (ch - 0.65) / 0.35 * cm * 0.5;
          r += hl; g += hl; b += hl;
        }
      }
      // stars (only at night, top half)
      if (v < 0.45) {
        for (let i = 0; i < stars.length; i++) {
          const sx = stars[i].x, sy = stars[i].y, sb = stars[i].b;
          const dx = u * w - sx, dy = v * h - sy;
          if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.6) {
              const k = (1 - d / 0.6) * sb;
              r += k; g += k; b += k;
            }
          }
        }
      }
      const idx = (y * w + x) * 4;
      // clamp (allow slight overshoot for HDR feel — clamp at 1.0 for 8-bit)
      data[idx]     = Math.max(0, Math.min(255, r * 255));
      data[idx + 1] = Math.max(0, Math.min(255, g * 255));
      data[idx + 2] = Math.max(0, Math.min(255, b * 255));
      data[idx + 3] = 255;
    }
  }
  return { data, size: [w, h] };
}

let cachedEquirect: THREE.DataTexture | null = null;
let cachedChapterId: string | null = null;

export function getEnvEquirect(chapterId: string = "default"): THREE.DataTexture {
  if (cachedEquirect && cachedChapterId === chapterId) return cachedEquirect;
  const cfg = envForChapter(chapterId);
  const { data, size } = buildEquirectangular(cfg, 1024, 512);
  const tex = new THREE.DataTexture(data, size[0], size[1], THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  // Apply as both envMap (for IBL) and background (visible sky)
  cachedEquirect = tex;
  cachedChapterId = chapterId;
  return tex;
}

export function getEnvMap(chapterId: string = "default"): THREE.Texture {
  // PMREMGenerator is unavailable in r3f's Three namespace, so we
  // return the equirectangular directly — three.js handles
  // equirect->cube sampling automatically when used as envMap.
  return getEnvEquirect(chapterId);
}
