import * as THREE from "three";
import { getSetForTerrain, PBRSet } from "./PBRTextures";
import { applyWind } from "./WindShader";
import { applyWater } from "./WaterShader";

// ---------------------------------------------------------------------------
//  SceneAssets — production-quality procedural scene parts for the
//  Ch1 night-courtyard setting. These components are shared between
//  the landing page and the main game's main-menu scene so the
//  visual quality is consistent.
//
//  Every component is built from primitives plus procedural
//  materials (no external textures) so the bundle stays small and
//  the look is unique.
//
//  Now using AAA PBR pipeline: per-pixel color + matching
//  normal/roughness/AO/height maps from a single FBM height field.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Backwards-compatible simple procedural stone / cobble / wood / sky /
//  flame / smoke maps.  Kept for legacy LandingScene walls & decorative
//  props.  For the tile map itself see getTileMaterial() below which
//  uses the new PBR set.
// ---------------------------------------------------------------------------

let stoneNormalMap: THREE.CanvasTexture | null = null;
export function getStoneNormalMap(): THREE.CanvasTexture {
  if (stoneNormalMap) return stoneNormalMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    data.data[i] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  ctx.strokeStyle = "rgba(60,60,60,0.6)";
  ctx.lineWidth = 2;
  for (let y = 16; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 32; x < size; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  stoneNormalMap = tex;
  return tex;
}

let cobbleNormalMap: THREE.CanvasTexture | null = null;
export function getCobbleNormalMap(): THREE.CanvasTexture {
  if (cobbleNormalMap) return cobbleNormalMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 50;
    data.data[i] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  ctx.strokeStyle = "rgba(20,20,20,0.7)";
  ctx.lineWidth = 3;
  const cell = 40;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      ctx.beginPath();
      const ox = (Math.floor(y / cell) % 2) * (cell / 2);
      ctx.ellipse(x + ox + cell / 2, y + cell / 2, cell * 0.45, cell * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  cobbleNormalMap = tex;
  return tex;
}

let stoneColorMap: THREE.CanvasTexture | null = null;
export function getStoneColorMap(): THREE.CanvasTexture {
  if (stoneColorMap) return stoneColorMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6b6058";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(30,25,20,0.7)";
  ctx.lineWidth = 3;
  for (let y = 0; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 16; x < size; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const bx = Math.floor(Math.random() * 4) * 96 + 16;
    const by = Math.floor(Math.random() * 4) * 64 + 4;
    ctx.fillStyle = `rgba(${60 + Math.random() * 30}, ${50 + Math.random() * 25}, ${40 + Math.random() * 20}, ${0.3 + Math.random() * 0.3})`;
    ctx.fillRect(bx, by, 80, 56);
  }
  for (let i = 0; i < 8; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 24);
    grad.addColorStop(0, "rgba(0,0,0,0.5)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 24, sy - 24, 48, 48);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  stoneColorMap = tex;
  return tex;
}

let cobbleColorMap: THREE.CanvasTexture | null = null;
export function getCobbleColorMap(): THREE.CanvasTexture {
  if (cobbleColorMap) return cobbleColorMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3a3530";
  ctx.fillRect(0, 0, size, size);
  const cell = 40;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const ox = (Math.floor(y / cell) % 2) * (cell / 2);
      const cx = x + ox + cell / 2;
      const cy = y + cell / 2;
      ctx.fillStyle = "#1a1814";
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.48, cell * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = 25 + Math.floor(Math.random() * 30);
      const b = 20 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${g + 30}, ${g + 20}, ${b + 15})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.42, cell * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.ellipse(cx, cy - cell * 0.1, cell * 0.3, cell * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  cobbleColorMap = tex;
  return tex;
}

let skyGradientMap: THREE.CanvasTexture | null = null;
export function getSkyGradientMap(): THREE.CanvasTexture {
  if (skyGradientMap) return skyGradientMap;
  const w = 64, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.00, "#040611");
  grad.addColorStop(0.35, "#0a1424");
  grad.addColorStop(0.55, "#1a2238");
  grad.addColorStop(0.75, "#2a2640");
  grad.addColorStop(1.00, "#3a2a3c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.55;
    const r = Math.random() * 0.6 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const horizon = ctx.createLinearGradient(0, h * 0.7, 0, h);
  horizon.addColorStop(0, "rgba(120,40,20,0)");
  horizon.addColorStop(0.5, "rgba(180,80,30,0.08)");
  horizon.addColorStop(1, "rgba(80,30,20,0.2)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  skyGradientMap = tex;
  return tex;
}

let flameSpriteMap: THREE.CanvasTexture | null = null;
export function getFlameSpriteMap(): THREE.CanvasTexture {
  if (flameSpriteMap) return flameSpriteMap;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,200,1.0)");
  grad.addColorStop(0.2, "rgba(255,180,80,0.9)");
  grad.addColorStop(0.5, "rgba(255,90,30,0.5)");
  grad.addColorStop(1.0, "rgba(120,30,10,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  flameSpriteMap = tex;
  return tex;
}

let smokeSpriteMap: THREE.CanvasTexture | null = null;
export function getSmokeSpriteMap(): THREE.CanvasTexture {
  if (smokeSpriteMap) return smokeSpriteMap;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(180,170,160,0.6)");
  grad.addColorStop(0.5, "rgba(120,115,110,0.3)");
  grad.addColorStop(1.0, "rgba(80,75,70,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  smokeSpriteMap = tex;
  return tex;
}

// ---------------------------------------------------------------------------
//  Reusable materials (legacy simple stone / cobble for LandingScene)
// ---------------------------------------------------------------------------
export function makeStoneMaterial(extraDark: number = 0): THREE.MeshStandardMaterial {
  const map = getStoneColorMap();
  const normalMap = getStoneNormalMap();
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: new THREE.Color(0.55 + extraDark * 0.05, 0.5 + extraDark * 0.04, 0.45 + extraDark * 0.03),
    roughness: 0.92,
    metalness: 0.05,
  });
  return mat;
}

export function makeCobbleMaterial(): THREE.MeshStandardMaterial {
  const map = getCobbleColorMap();
  const normalMap = getCobbleNormalMap();
  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: new THREE.Color(0.85, 0.82, 0.78),
    roughness: 0.85,
    metalness: 0.05,
  });
}

// ---------------------------------------------------------------------------
//  AAA Tile material factory — one PBR material per terrain type.
//
//  Each material is built from the PBRTexture set:
//   - color (sRGB)
//   - normal (linear)  for surface detail
//   - roughness (linear) for material specularity
//   - ao (linear) for ambient occlusion
//   - displacement would need vertex displacement; we keep a height
//     map exposed for future use
//
//  Tile meshes use a slightly bevelled box for natural edge catch.
// ---------------------------------------------------------------------------

const tileMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
let activeChapterId: string = "default";

export function setTileMaterialChapter(chapterId: string) {
  // If the chapter changed, force-refresh the materials so we get the
  // right envMap / lighting combo per chapter.
  if (activeChapterId !== chapterId) {
    activeChapterId = chapterId;
    tileMaterialCache.clear();
  }
}

function assembleTileMaterial(
  set: PBRSet,
  color: THREE.Color,
  roughnessMul: number,
  metalness: number,
  envMap: THREE.Texture | null,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: set.color,
    normalMap: set.normal,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: set.roughness,
    aoMap: set.ao,
    aoMapIntensity: 1.0,
    color,
    roughness: roughnessMul,
    metalness,
    envMap: envMap ?? null,
    envMapIntensity: envMap ? 1.0 : 0.0,
  });
  return mat;
}

export function getTileMaterial(type: string): THREE.MeshStandardMaterial {
  const cacheKey = `${activeChapterId}_${type}`;
  if (tileMaterialCache.has(cacheKey)) return tileMaterialCache.get(cacheKey)!;
  const set = getSetForTerrain(type);
  let mat: THREE.MeshStandardMaterial;
  // Light-weight envMap: only need to read from a small equirect, but
  // for performance we use the default scene env.  Per-material
  // envMap is left null so the global scene env is used automatically.
  const env = null;
  switch (type) {
    case "forest":
    case "thicket":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.95, 1.0, 0.85),
        0.98, 0.0, env,
      );
      // Forest / thicket = grass swaying in the wind
      applyWind(mat, { strength: 0.006, speed: 1.0, scale: 3, phaseSeed: type === "forest" ? 1 : 17 });
      break;
    case "deployment":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.85, 1.0, 0.80),
        0.95, 0.0, env,
      );
      applyWind(mat, { strength: 0.003, speed: 0.8, scale: 4, phaseSeed: 31 });
      break;
    case "plain":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.0, 1.0, 1.0),
        0.95, 0.0, env,
      );
      applyWind(mat, { strength: 0.004, speed: 0.9, scale: 4, phaseSeed: 5 });
      break;
    case "sand":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.05, 0.98, 0.82),
        0.92, 0.0, env,
      );
      break;
    case "road":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.10, 0.98, 0.80),
        0.92, 0.0, env,
      );
      break;
    case "bridge":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.95, 0.82, 0.60),
        0.85, 0.0, env,
      );
      break;
    case "water":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.10, 1.20, 1.40),
        0.20, 0.30, env,
      );
      applyWater(mat, { deep: false, speed: 1.0, rippleStrength: 0.6 });
      break;
    case "deep_water":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.70, 0.85, 1.10),
        0.15, 0.40, env,
      );
      applyWater(mat, { deep: true, speed: 0.7, rippleStrength: 0.4 });
      break;
    case "mountain":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.10, 1.05, 0.95),
        0.95, 0.05, env,
      );
      break;
    case "cliff":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.85, 0.82, 0.78),
        0.95, 0.05, env,
      );
      break;
    case "fort":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.10, 1.05, 0.95),
        0.85, 0.10, env,
      );
      break;
    case "wall":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(0.80, 0.78, 0.78),
        0.85, 0.15, env,
      );
      break;
    case "floor":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.10, 0.95, 0.80),
        0.75, 0.10, env,
      );
      break;
    case "throne":
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(1.4, 1.2, 0.5),
        roughness: 0.4,
        metalness: 0.3,
        emissive: new THREE.Color(0.6, 0.4, 0.0),
        emissiveIntensity: 0.2,
        envMap: env,
        envMapIntensity: 1.0,
      });
      break;
    case "snow":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.05, 1.10, 1.20),
        0.85, 0.0, env,
      );
      break;
    case "lava":
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.40, 0.55, 0.20),
        0.85, 0.0, env,
      );
      (mat as any).emissive = new THREE.Color(1.0, 0.30, 0.05);
      (mat as any).emissiveIntensity = 0.6;
      (mat as any).__bloom = true;
      break;
    default:
      mat = assembleTileMaterial(
        set,
        new THREE.Color(1.0, 1.0, 1.0),
        0.92, 0.0, env,
      );
  }
  tileMaterialCache.set(cacheKey, mat);
  return mat;
}
