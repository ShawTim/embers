import * as THREE from "three";

/**
 * SceneAssets — production-quality procedural scene parts for the
 * Ch1 night-courtyard setting. These components are shared between
 * the landing page and the main game's main-menu scene so the
 * visual quality is consistent.
 *
 * Every component is built from primitives plus procedural
 * materials (no external textures) so the bundle stays small and
 * the look is unique. Materials use a hand-built noise normal map
 * so the stone and cobbles have surface detail without needing a
 * texture file.
 */

// ---------------------------------------------------------------------------
//  Procedural stone normal map
// ---------------------------------------------------------------------------
// Cached so we don't recreate the texture for every wall segment.
let stoneNormalMap: THREE.CanvasTexture | null = null;
export function getStoneNormalMap(): THREE.CanvasTexture {
  if (stoneNormalMap) return stoneNormalMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Base mid-gray
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  // Add random bumps
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    data.data[i] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  // A few darker mortar lines
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

// Cached cobblestone normal map (smaller bumps, more regular)
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
  // Per-pixel noise
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 50;
    data.data[i] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 1] = Math.max(0, Math.min(255, 128 + n));
    data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  // Cobble pattern — round stones in a grid with mortar gaps
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

// Color textures for variation
let stoneColorMap: THREE.CanvasTexture | null = null;
export function getStoneColorMap(): THREE.CanvasTexture {
  if (stoneColorMap) return stoneColorMap;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Base — warm grey
  ctx.fillStyle = "#6b6058";
  ctx.fillRect(0, 0, size, size);
  // Block outlines
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
  // Per-block color variation
  for (let i = 0; i < 60; i++) {
    const bx = Math.floor(Math.random() * 4) * 96 + 16;
    const by = Math.floor(Math.random() * 4) * 64 + 4;
    ctx.fillStyle = `rgba(${60 + Math.random() * 30}, ${50 + Math.random() * 25}, ${40 + Math.random() * 20}, ${0.3 + Math.random() * 0.3})`;
    ctx.fillRect(bx, by, 80, 56);
  }
  // Some soot / scorch marks
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
  // Base ground colour
  ctx.fillStyle = "#3a3530";
  ctx.fillRect(0, 0, size, size);
  // Cobble stones — each one slightly different shade
  const cell = 40;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const ox = (Math.floor(y / cell) % 2) * (cell / 2);
      const cx = x + ox + cell / 2;
      const cy = y + cell / 2;
      // Dark mortar border
      ctx.fillStyle = "#1a1814";
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.48, cell * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // Stone body
      const g = 25 + Math.floor(Math.random() * 30);
      const b = 20 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${g + 30}, ${g + 20}, ${b + 15})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.42, cell * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight on top
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

// Sky gradient texture
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
  // Stars
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.55;
    const r = Math.random() * 0.6 + 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A subtle warm glow at the horizon
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

// Soft circular flame sprite (additive blend)
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
//  Reusable materials
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
