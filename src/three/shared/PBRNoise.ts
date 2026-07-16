import * as THREE from "three";

// ---------------------------------------------------------------------------
//  PBRNoise — Multi-octave Perlin / Simplex / Worley / FBM noise utilities
//
//  These build a per-pixel float height field on a Canvas, then
//  derive matching color / normal / roughness / AO / height maps
//  from it.  Everything is deterministic and seeded so textures
//  don't shimmer between sessions.
// ---------------------------------------------------------------------------

// Mulberry32 — fast, seedable PRNG
export function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2-D value-noise lattice with smoothstep interpolation
function makeValueNoise2D(seed: number, gridSize: number) {
  const rng = seededRng(seed);
  const table: number[] = new Array(gridSize * gridSize);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  const at = (ix: number, iy: number) => {
    const x = ((ix % gridSize) + gridSize) % gridSize;
    const y = ((iy % gridSize) + gridSize) % gridSize;
    return table[y * gridSize + x];
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = smooth(xf), sy = smooth(yf);
    const v00 = at(xi, yi),     v10 = at(xi + 1, yi);
    const v01 = at(xi, yi + 1), v11 = at(xi + 1, yi + 1);
    const ix0 = v00 + sx * (v10 - v00);
    const ix1 = v01 + sx * (v11 - v01);
    return ix0 + sy * (ix1 - ix0);
  };
}

// 2-D Perlin-style gradient noise (Ken Perlin's improved noise approximation)
function makePerlin2D(seed: number) {
  const rng = seededRng(seed ^ 0x9E3779B9);
  const perm: number[] = new Array(512);
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
  };
  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(grad(perm[A], x, y),     grad(perm[B], x - 1, y),     u),
      THREE.MathUtils.lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u),
      v
    ) * 0.5 + 0.5; // map to [0,1]
  };
}

// Worley (cellular) noise — distance to nearest cell point.
// Returns the normalized F1 distance.
function makeWorley2D(seed: number) {
  const rng = seededRng(seed);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 16; i++) points.push({ x: rng(), y: rng() });
  return (x: number, y: number): number => {
    let minD = 1e9;
    for (let i = 0; i < points.length; i++) {
      const dx = x - points[i].x, dy = y - points[i].y;
      const d = dx * dx + dy * dy;
      if (d < minD) minD = d;
    }
    return Math.sqrt(minD);
  };
}

// FBM (fractal Brownian motion) — `octaves` layers of noise added with
// decreasing amplitude.  `lacunarity` is the frequency multiplier
// between layers; `gain` is the amplitude multiplier.
export function fbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number = 5,
  lacunarity: number = 2.0,
  gain: number = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// Ridged FBM — gives sharp ridge / mountain patterns
export function ridgedFbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number = 5,
  lacunarity: number = 2.0,
  gain: number = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise(x * freq, y * freq);
    sum += amp * (1 - Math.abs(n * 2 - 1));
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// Build a height field of `size`×`size` using the given noise function
// at the given base frequency.  Returns a Float32Array (row-major, top-left origin).
export function buildHeightField(
  size: number,
  noise: (x: number, y: number) => number,
  frequency: number,
  fbmOctaves: number,
  fbmGain: number,
  bias: number = 0.0,
  contrast: number = 1.0,
): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * frequency;
      const ny = (y / size) * frequency;
      let h = fbm2D(noise, nx, ny, fbmOctaves, 2.0, fbmGain);
      // contrast around 0.5
      h = (h - 0.5) * contrast + 0.5 + bias;
      h = Math.max(0, Math.min(1, h));
      out[y * size + x] = h;
    }
  }
  return out;
}

// Estimate slope from height field via Sobel filter — used for
// ambient occlusion & detail weighting.
export function buildSlopeField(height: Float32Array, size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const ym = (y - 1 + size) % size, yp = (y + 1) % size;
      const dx = height[y * size + xp] - height[y * size + xm];
      const dy = height[yp * size + x] - height[ym * size + x];
      out[y * size + x] = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 4);
    }
  }
  return out;
}

// Cheap AO estimate — sample height at 4 neighbours and darken
// points that sit "below" them (concave) and brighten ridges (convex).
export function buildAOField(
  height: Float32Array,
  size: number,
  radius: number = 1,
  intensity: number = 0.7,
): Float32Array {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = height[y * size + x];
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xn = (x + dx + size) % size;
          const yn = (y + dy + size) % size;
          const h = height[yn * size + xn];
          // If neighbor is higher, point is shadowed
          sum += Math.max(0, h - c);
          count++;
        }
      }
      const ao = 1 - Math.min(1, (sum / count) * intensity * 4);
      out[y * size + x] = ao;
    }
  }
  return out;
}

// Convert a height field to a normal map (RGB) using Sobel.
export function heightToNormal(
  height: Float32Array,
  size: number,
  strength: number = 4.0,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const ym = (y - 1 + size) % size, yp = (y + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;
      // Tangent-space normal: -dx, -dy, 1
      const nx = -dx, ny = -dy, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const r = ((nx / len) * 0.5 + 0.5) * 255;
      const g = ((ny / len) * 0.5 + 0.5) * 255;
      const b = ((nz / len) * 0.5 + 0.5) * 255;
      const idx = (y * size + x) * 4;
      out[idx]     = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = 255;
    }
  }
  return out;
}

// Pack a Float32Array of [0,1] into a greyscale RGBA Uint8ClampedArray.
export function floatToRgba(data: Float32Array, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(1, data[i])) * 255;
    const idx = i * 4;
    out[idx]     = v;
    out[idx + 1] = v;
    out[idx + 2] = v;
    out[idx + 3] = 255;
  }
  return out;
}

// Pack a Float32Array of [0,1] into a red-channel Uint8ClampedArray
// (used for roughness / metallic / occlusion maps where a single
// channel is enough and saves memory).
export function floatToRedRgba(data: Float32Array, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(1, data[i])) * 255;
    const idx = i * 4;
    out[idx]     = v;
    out[idx + 1] = 0;
    out[idx + 2] = 0;
    out[idx + 3] = 255;
  }
  return out;
}

// Wrap a Uint8ClampedArray (RGBA) into a Three.js DataTexture.
export function rgbaToTexture(
  data: Uint8ClampedArray,
  size: number,
  repeat: [number, number] = [1, 1],
  linear: boolean = true,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  if (linear) tex.colorSpace = THREE.LinearSRGBColorSpace;
  return tex;
}

// Blend two RGB colors by factor t
export function lerpColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

// Pre-defined noise generators (cached for reuse across terrain types)
const noiseCache = new Map<string, ReturnType<typeof makePerlin2D>>();
export function getPerlin(seed: number): (x: number, y: number) => number {
  const k = `p${seed}`;
  if (!noiseCache.has(k)) noiseCache.set(k, makePerlin2D(seed));
  return noiseCache.get(k)!;
}
export function getValue(seed: number, grid: number = 32): (x: number, y: number) => number {
  const k = `v${seed}_${grid}`;
  if (!noiseCache.has(k)) noiseCache.set(k, makeValueNoise2D(seed, grid));
  return noiseCache.get(k)!;
}
export function getWorley(seed: number): (x: number, y: number) => number {
  const k = `w${seed}`;
  if (!noiseCache.has(k)) noiseCache.set(k, makeWorley2D(seed));
  return noiseCache.get(k)!;
}
