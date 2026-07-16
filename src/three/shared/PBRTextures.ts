import * as THREE from "three";
import {
  fbm2D, ridgedFbm2D, buildHeightField, buildSlopeField, buildAOField,
  heightToNormal, floatToRgba, floatToRedRgba, rgbaToTexture, lerpColor,
  getPerlin, getValue, getWorley, seededRng,
} from "./PBRNoise";

// ---------------------------------------------------------------------------
//  PBRTextures — production-quality PBR texture sets for every terrain type.
//
//  Each builder returns a complete { color, normal, roughness, ao, height }
//  bundle.  All five maps share the same height field so they
//  match perfectly (no seams between normal/roughness/color).
//
//  Resolution: 512×512 (sweet spot for tile-scale; big enough to
//  survive close-up zoom, small enough to keep VRAM low).
// ---------------------------------------------------------------------------

export const TEX_SIZE = 512;
export const HEIGHT_RES = 256; // height/AO can be half-res

export interface PBRSet {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
  ao: THREE.DataTexture;
  height: THREE.DataTexture;
}

interface BuildOpts {
  // Color tinting
  baseColor: { r: number; g: number; b: number };
  baseColor2?: { r: number; g: number; b: number }; // for 2-tone terrain
  blend?: number; // 0..1 mix toward baseColor2

  // Per-pixel micro-color
  variation: number; // 0..0.5 amount of random color jitter

  // Large-scale color variation noise
  colorFreq: number;
  colorOctaves: number;
  colorContrast: number;

  // Height field
  heightFreq: number;
  heightOctaves: number;
  heightGain: number;
  heightContrast: number;

  // Normal map strength
  normalStrength: number;

  // Roughness
  baseRoughness: number;
  roughnessVariation: number;
  roughnessFreq: number;

  // Macro features: dark "cracks" overlaid on top
  cracks?: {
    color: { r: number; g: number; b: number };
    width: number;
    freq: number;
    intensity: number;
  };

  // Macro features: bright "highlights" (e.g. moss, ice shine)
  highlights?: {
    color: { r: number; g: number; b: number };
    freq: number;
    intensity: number;
    threshold: number;
  };

  // Repeat the texture across the tile (TEX_SIZE / repeat = # tiles per repeat)
  repeat: [number, number];

  // Seed
  seed: number;
}

function buildColor(opts: BuildOpts, height: Float32Array, ao: Float32Array): Uint8ClampedArray {
  const { size } = { size: TEX_SIZE };
  const out = new Uint8ClampedArray(size * size * 4);
  const perlin = getPerlin(opts.seed);
  const perlin2 = getPerlin(opts.seed ^ 0xCAFEBABE);
  const rng = seededRng(opts.seed ^ 0x12345);
  const c2 = opts.baseColor2 ?? opts.baseColor;
  const blend = opts.blend ?? 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * opts.colorFreq;
      const ny = (y / size) * opts.colorFreq;

      // 1) large-scale tint variation
      const largeNoise = fbm2D(perlin, nx, ny, opts.colorOctaves, 2.0, 0.5);
      const largeLerp = (largeNoise - 0.5) * opts.colorContrast + 0.5;
      let tint = {
        r: opts.baseColor.r + (c2.r - opts.baseColor.r) * blend,
        g: opts.baseColor.g + (c2.g - opts.baseColor.g) * blend,
        b: opts.baseColor.b + (c2.b - opts.baseColor.b) * blend,
      };
      // Shift toward lighter / darker by large-scale noise
      const lighten = THREE.MathUtils.smoothstep(largeLerp, 0, 1);
      tint = {
        r: tint.r * (0.75 + lighten * 0.5),
        g: tint.g * (0.75 + lighten * 0.5),
        b: tint.b * (0.75 + lighten * 0.5),
      };

      // 2) micro-color noise
      const micro = perlin2(x * 0.1, y * 0.1);
      const microJ = (micro - 0.5) * opts.variation * 2;
      let r = tint.r + microJ;
      let g = tint.g + microJ;
      let b = tint.b + microJ;

      // 3) height-based shading (valleys darker)
      const h = height[Math.floor(y / (size / HEIGHT_RES)) * HEIGHT_RES + Math.floor(x / (size / HEIGHT_RES))];
      const heightShade = 0.7 + h * 0.6;
      r *= heightShade;
      g *= heightShade;
      b *= heightShade;

      // 4) crack overlay
      if (opts.cracks) {
        const cn = fbm2D(perlin, (x / size) * opts.cracks.freq, (y / size) * opts.cracks.freq, 3, 2.0, 0.5);
        const crackMask = 1 - Math.min(1, Math.abs(cn - 0.5) / opts.cracks.width);
        const k = crackMask * opts.cracks.intensity;
        r = r * (1 - k) + opts.cracks.color.r * k;
        g = g * (1 - k) + opts.cracks.color.g * k;
        b = b * (1 - k) + opts.cracks.color.b * k;
      }

      // 5) highlight overlay (moss, ice, etc.)
      if (opts.highlights) {
        const hn = fbm2D(perlin, (x / size) * opts.highlights.freq + 100, (y / size) * opts.highlights.freq + 100, 4, 2.0, 0.5);
        const hm = THREE.MathUtils.smoothstep(hn, opts.highlights.threshold, 1);
        const k = hm * opts.highlights.intensity;
        r = r * (1 - k) + opts.highlights.color.r * k;
        g = g * (1 - k) + opts.highlights.color.g * k;
        b = b * (1 - k) + opts.highlights.color.b * k;
      }

      // 6) AO modulation
      const aoV = ao[Math.floor(y / (size / HEIGHT_RES)) * HEIGHT_RES + Math.floor(x / (size / HEIGHT_RES))];
      r *= aoV;
      g *= aoV;
      b *= aoV;

      // 7) per-pixel jitter (sand grain feel)
      const j = (rng() - 0.5) * 0.015;
      r += j; g += j; b += j;

      const idx = (y * size + x) * 4;
      out[idx]     = Math.max(0, Math.min(255, r * 255));
      out[idx + 1] = Math.max(0, Math.min(255, g * 255));
      out[idx + 2] = Math.max(0, Math.min(255, b * 255));
      out[idx + 3] = 255;
    }
  }
  return out;
}

function buildRoughness(opts: BuildOpts, height: Float32Array): Uint8ClampedArray {
  const { size } = { size: TEX_SIZE };
  const out = new Uint8ClampedArray(size * size * 4);
  const perlin = getPerlin(opts.seed ^ 0xDEADBEEF);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2D(perlin, (x / size) * opts.roughnessFreq, (y / size) * opts.roughnessFreq, 4, 2.0, 0.5);
      let r = opts.baseRoughness + (n - 0.5) * opts.roughnessVariation * 2;
      r = Math.max(0, Math.min(1, r));
      const idx = (y * size + x) * 4;
      // Pack roughness into red channel
      out[idx]     = r * 255;
      out[idx + 1] = 0;
      out[idx + 2] = 0;
      out[idx + 3] = 255;
    }
  }
  return out;
}

function buildPBRSet(opts: BuildOpts): PBRSet {
  // 1) Height field
  const perlin = getPerlin(opts.seed);
  const height = buildHeightField(
    HEIGHT_RES,
    perlin,
    opts.heightFreq,
    opts.heightOctaves,
    opts.heightGain,
    0,
    opts.heightContrast,
  );
  // 2) AO
  const ao = buildAOField(height, HEIGHT_RES, 2, 0.85);
  // 3) Color
  const color = buildColor(opts, height, ao);
  // 4) Normal
  const normal = heightToNormal(height, HEIGHT_RES, opts.normalStrength);
  // 5) Roughness
  const roughness = buildRoughness(opts, height);

  return {
    color: rgbaToTexture(color, TEX_SIZE, opts.repeat, false),
    normal: rgbaToTexture(normal, HEIGHT_RES, opts.repeat, true),
    roughness: rgbaToTexture(roughness, TEX_SIZE, opts.repeat, true),
    ao: rgbaToTexture(floatToRgba(ao, HEIGHT_RES), HEIGHT_RES, opts.repeat, true),
    height: rgbaToTexture(floatToRgba(height, HEIGHT_RES), HEIGHT_RES, opts.repeat, true),
  };
}

// ---------------------------------------------------------------------------
//  Cached texture sets — one per terrain category.
//  The PBR sets themselves are cached; materials are assembled in
//  SceneAssets with per-tile-type tinting & UV repeats.
// ---------------------------------------------------------------------------

const cache = new Map<string, PBRSet>();

function key(name: string) { return name; }

export function getGrassSet(): PBRSet {
  if (!cache.has(key("grass"))) {
    cache.set(key("grass"), buildPBRSet({
      baseColor: { r: 0.22, g: 0.40, b: 0.18 },
      baseColor2: { r: 0.30, g: 0.50, b: 0.22 },
      blend: 0.5,
      variation: 0.08,
      colorFreq: 5, colorOctaves: 5, colorContrast: 0.4,
      heightFreq: 12, heightOctaves: 4, heightGain: 0.4, heightContrast: 0.7,
      normalStrength: 4.5,
      baseRoughness: 0.95, roughnessVariation: 0.06, roughnessFreq: 8,
      highlights: {
        color: { r: 0.55, g: 0.65, b: 0.30 },
        freq: 6, intensity: 0.18, threshold: 0.65,
      },
      cracks: {
        color: { r: 0.18, g: 0.14, b: 0.10 },
        width: 0.04, freq: 4, intensity: 0.25,
      },
      repeat: [1, 1], seed: 101,
    }));
  }
  return cache.get(key("grass"))!;
}

export function getForestSet(): PBRSet {
  if (!cache.has(key("forest"))) {
    cache.set(key("forest"), buildPBRSet({
      baseColor: { r: 0.14, g: 0.30, b: 0.13 },
      baseColor2: { r: 0.22, g: 0.40, b: 0.18 },
      blend: 0.65,
      variation: 0.10,
      colorFreq: 6, colorOctaves: 5, colorContrast: 0.5,
      heightFreq: 14, heightOctaves: 4, heightGain: 0.5, heightContrast: 0.8,
      normalStrength: 5.5,
      baseRoughness: 0.98, roughnessVariation: 0.04, roughnessFreq: 8,
      highlights: {
        color: { r: 0.40, g: 0.55, b: 0.25 },
        freq: 8, intensity: 0.12, threshold: 0.7,
      },
      cracks: {
        color: { r: 0.08, g: 0.10, b: 0.06 },
        width: 0.05, freq: 3, intensity: 0.35,
      },
      repeat: [1, 1], seed: 202,
    }));
  }
  return cache.get(key("forest"))!;
}

export function getThicketSet(): PBRSet {
  if (!cache.has(key("thicket"))) {
    cache.set(key("thicket"), buildPBRSet({
      baseColor: { r: 0.18, g: 0.28, b: 0.10 },
      baseColor2: { r: 0.30, g: 0.42, b: 0.18 },
      blend: 0.4,
      variation: 0.12,
      colorFreq: 8, colorOctaves: 4, colorContrast: 0.6,
      heightFreq: 16, heightOctaves: 4, heightGain: 0.5, heightContrast: 0.9,
      normalStrength: 6.0,
      baseRoughness: 0.98, roughnessVariation: 0.05, roughnessFreq: 6,
      cracks: {
        color: { r: 0.06, g: 0.08, b: 0.04 },
        width: 0.06, freq: 4, intensity: 0.4,
      },
      repeat: [1, 1], seed: 303,
    }));
  }
  return cache.get(key("thicket"))!;
}

export function getSandSet(): PBRSet {
  if (!cache.has(key("sand"))) {
    cache.set(key("sand"), buildPBRSet({
      baseColor: { r: 0.74, g: 0.65, b: 0.45 },
      baseColor2: { r: 0.82, g: 0.72, b: 0.50 },
      blend: 0.5,
      variation: 0.06,
      colorFreq: 4, colorOctaves: 4, colorContrast: 0.35,
      heightFreq: 8, heightOctaves: 3, heightGain: 0.3, heightContrast: 0.5,
      normalStrength: 3.0,
      baseRoughness: 0.92, roughnessVariation: 0.08, roughnessFreq: 6,
      highlights: {
        color: { r: 0.90, g: 0.82, b: 0.62 },
        freq: 3, intensity: 0.18, threshold: 0.6,
      },
      repeat: [1, 1], seed: 404,
    }));
  }
  return cache.get(key("sand"))!;
}

export function getStoneSet(): PBRSet {
  if (!cache.has(key("stone"))) {
    cache.set(key("stone"), buildPBRSet({
      baseColor: { r: 0.42, g: 0.40, b: 0.38 },
      baseColor2: { r: 0.52, g: 0.48, b: 0.42 },
      blend: 0.5,
      variation: 0.07,
      colorFreq: 4, colorOctaves: 4, colorContrast: 0.4,
      heightFreq: 6, heightOctaves: 4, heightGain: 0.45, heightContrast: 0.7,
      normalStrength: 5.5,
      baseRoughness: 0.88, roughnessVariation: 0.10, roughnessFreq: 4,
      cracks: {
        color: { r: 0.18, g: 0.16, b: 0.14 },
        width: 0.03, freq: 5, intensity: 0.5,
      },
      highlights: {
        color: { r: 0.60, g: 0.62, b: 0.45 },
        freq: 5, intensity: 0.15, threshold: 0.7,
      },
      repeat: [2, 2], seed: 505,
    }));
  }
  return cache.get(key("stone"))!;
}

export function getMountainSet(): PBRSet {
  if (!cache.has(key("mountain"))) {
    cache.set(key("mountain"), buildPBRSet({
      baseColor: { r: 0.45, g: 0.42, b: 0.38 },
      baseColor2: { r: 0.58, g: 0.50, b: 0.40 },
      blend: 0.55,
      variation: 0.10,
      colorFreq: 6, colorOctaves: 5, colorContrast: 0.7,
      heightFreq: 8, heightOctaves: 5, heightGain: 0.5, heightContrast: 1.0,
      normalStrength: 7.0,
      baseRoughness: 0.95, roughnessVariation: 0.06, roughnessFreq: 4,
      cracks: {
        color: { r: 0.15, g: 0.12, b: 0.10 },
        width: 0.04, freq: 3, intensity: 0.55,
      },
      highlights: {
        color: { r: 0.55, g: 0.55, b: 0.40 },
        freq: 6, intensity: 0.20, threshold: 0.55,
      },
      repeat: [1, 1], seed: 606,
    }));
  }
  return cache.get(key("mountain"))!;
}

export function getCliffSet(): PBRSet {
  if (!cache.has(key("cliff"))) {
    cache.set(key("cliff"), buildPBRSet({
      baseColor: { r: 0.35, g: 0.32, b: 0.30 },
      baseColor2: { r: 0.45, g: 0.42, b: 0.38 },
      blend: 0.4,
      variation: 0.10,
      colorFreq: 5, colorOctaves: 4, colorContrast: 0.7,
      heightFreq: 10, heightOctaves: 5, heightGain: 0.55, heightContrast: 1.0,
      normalStrength: 8.0,
      baseRoughness: 0.97, roughnessVariation: 0.05, roughnessFreq: 4,
      cracks: {
        color: { r: 0.10, g: 0.08, b: 0.06 },
        width: 0.05, freq: 4, intensity: 0.65,
      },
      repeat: [1, 1], seed: 707,
    }));
  }
  return cache.get(key("cliff"))!;
}

export function getWoodSet(): PBRSet {
  if (!cache.has(key("wood"))) {
    cache.set(key("wood"), buildPBRSet({
      baseColor: { r: 0.40, g: 0.26, b: 0.16 },
      baseColor2: { r: 0.52, g: 0.34, b: 0.20 },
      blend: 0.5,
      variation: 0.05,
      colorFreq: 3, colorOctaves: 4, colorContrast: 0.5,
      heightFreq: 12, heightOctaves: 3, heightGain: 0.3, heightContrast: 0.7,
      normalStrength: 4.0,
      baseRoughness: 0.80, roughnessVariation: 0.10, roughnessFreq: 8,
      cracks: {
        color: { r: 0.18, g: 0.10, b: 0.04 },
        width: 0.04, freq: 8, intensity: 0.3,
      },
      repeat: [1, 1], seed: 808,
    }));
  }
  return cache.get(key("wood"))!;
}

export function getWaterSet(): PBRSet {
  if (!cache.has(key("water"))) {
    cache.set(key("water"), buildPBRSet({
      baseColor: { r: 0.10, g: 0.32, b: 0.55 },
      baseColor2: { r: 0.15, g: 0.42, b: 0.65 },
      blend: 0.5,
      variation: 0.05,
      colorFreq: 3, colorOctaves: 3, colorContrast: 0.3,
      heightFreq: 6, heightOctaves: 3, heightGain: 0.2, heightContrast: 0.3,
      normalStrength: 2.0,
      baseRoughness: 0.20, roughnessVariation: 0.10, roughnessFreq: 4,
      highlights: {
        color: { r: 0.55, g: 0.78, b: 0.95 },
        freq: 4, intensity: 0.30, threshold: 0.55,
      },
      repeat: [2, 2], seed: 909,
    }));
  }
  return cache.get(key("water"))!;
}

export function getDeepWaterSet(): PBRSet {
  if (!cache.has(key("deep_water"))) {
    cache.set(key("deep_water"), buildPBRSet({
      baseColor: { r: 0.04, g: 0.18, b: 0.35 },
      baseColor2: { r: 0.08, g: 0.24, b: 0.42 },
      blend: 0.5,
      variation: 0.04,
      colorFreq: 2, colorOctaves: 3, colorContrast: 0.25,
      heightFreq: 4, heightOctaves: 2, heightGain: 0.15, heightContrast: 0.2,
      normalStrength: 1.5,
      baseRoughness: 0.15, roughnessVariation: 0.08, roughnessFreq: 3,
      highlights: {
        color: { r: 0.30, g: 0.55, b: 0.80 },
        freq: 3, intensity: 0.18, threshold: 0.6,
      },
      repeat: [2, 2], seed: 1010,
    }));
  }
  return cache.get(key("deep_water"))!;
}

export function getDirtSet(): PBRSet {
  if (!cache.has(key("dirt"))) {
    cache.set(key("dirt"), buildPBRSet({
      baseColor: { r: 0.30, g: 0.22, b: 0.14 },
      baseColor2: { r: 0.40, g: 0.30, b: 0.18 },
      blend: 0.5,
      variation: 0.08,
      colorFreq: 4, colorOctaves: 4, colorContrast: 0.4,
      heightFreq: 8, heightOctaves: 3, heightGain: 0.4, heightContrast: 0.6,
      normalStrength: 4.0,
      baseRoughness: 0.96, roughnessVariation: 0.06, roughnessFreq: 6,
      cracks: {
        color: { r: 0.12, g: 0.08, b: 0.04 },
        width: 0.04, freq: 5, intensity: 0.4,
      },
      repeat: [1, 1], seed: 1111,
    }));
  }
  return cache.get(key("dirt"))!;
}

export function getSnowSet(): PBRSet {
  if (!cache.has(key("snow"))) {
    cache.set(key("snow"), buildPBRSet({
      baseColor: { r: 0.88, g: 0.92, b: 0.98 },
      baseColor2: { r: 0.95, g: 0.97, b: 1.00 },
      blend: 0.5,
      variation: 0.04,
      colorFreq: 3, colorOctaves: 3, colorContrast: 0.3,
      heightFreq: 6, heightOctaves: 3, heightGain: 0.3, heightContrast: 0.4,
      normalStrength: 3.5,
      baseRoughness: 0.85, roughnessVariation: 0.10, roughnessFreq: 5,
      cracks: {
        color: { r: 0.55, g: 0.70, b: 0.95 },
        width: 0.02, freq: 6, intensity: 0.4,
      },
      highlights: {
        color: { r: 1.0, g: 1.0, b: 1.0 },
        freq: 8, intensity: 0.3, threshold: 0.6,
      },
      repeat: [1, 1], seed: 1212,
    }));
  }
  return cache.get(key("snow"))!;
}

export function getLavaSet(): PBRSet {
  if (!cache.has(key("lava"))) {
    cache.set(key("lava"), buildPBRSet({
      baseColor: { r: 0.25, g: 0.10, b: 0.05 },
      baseColor2: { r: 0.40, g: 0.18, b: 0.08 },
      blend: 0.5,
      variation: 0.10,
      colorFreq: 5, colorOctaves: 4, colorContrast: 0.5,
      heightFreq: 8, heightOctaves: 3, heightGain: 0.3, heightContrast: 0.4,
      normalStrength: 3.5,
      baseRoughness: 0.85, roughnessVariation: 0.10, roughnessFreq: 5,
      cracks: {
        color: { r: 1.0, g: 0.45, b: 0.10 },
        width: 0.05, freq: 4, intensity: 0.85,
      },
      highlights: {
        color: { r: 1.0, g: 0.80, b: 0.30 },
        freq: 6, intensity: 0.4, threshold: 0.55,
      },
      repeat: [1, 1], seed: 1313,
    }));
  }
  return cache.get(key("lava"))!;
}

// Get the PBR set for a given terrain category. Returns the
// closest-match set when the terrain name is unknown.
export function getSetForTerrain(type: string): PBRSet {
  switch (type) {
    case "forest":       return getForestSet();
    case "thicket":      return getThicketSet();
    case "deployment":   return getGrassSet();
    case "mountain":     return getMountainSet();
    case "cliff":        return getCliffSet();
    case "fort":
    case "wall":         return getStoneSet();
    case "floor":        return getWoodSet();
    case "water":        return getWaterSet();
    case "deep_water":   return getDeepWaterSet();
    case "snow":         return getSnowSet();
    case "lava":         return getLavaSet();
    case "dirt":         return getDirtSet();
    case "sand":
    case "road":
    case "bridge":       return getSandSet();
    case "plain":
    default:             return getGrassSet();
  }
}
