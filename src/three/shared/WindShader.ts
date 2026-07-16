import * as THREE from "three";

// ---------------------------------------------------------------------------
//  WindShader — vertex displacement patch for grass / foliage tiles.
//
//  Hooks into MeshStandardMaterial via onBeforeCompile and adds
//  a per-vertex wind sway driven by world-space FBM noise + a
//  slow global phase.  The displacement is strongest at the top
//  of the tile (vertex Y > 0) so flat ground doesn't ripple.
//
//  Use:
//    const mat = getTileMaterial('forest');
//    applyWind(mat, { strength: 0.04, speed: 1.2, scale: 4 });
//
//  The hook is one-shot: calling it twice on the same material
//  is a no-op.
// ---------------------------------------------------------------------------

export interface WindOptions {
  strength?: number;  // world-space max displacement (default 0.04)
  speed?: number;     // animation speed multiplier (default 1.0)
  scale?: number;     // noise frequency (default 4)
  phaseSeed?: number; // per-material phase offset
}

const windMaterials = new WeakSet<THREE.Material>();

const VERT_HEADER = `
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindScale;
uniform float uWindPhase;
varying float vWindMask;
`;

const VERT_DISPLACE = `
float windHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float windNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = windHash(i);
  float b = windHash(i + vec2(1.0, 0.0));
  float c = windHash(i + vec2(0.0, 1.0));
  float d = windHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float windFBM(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * windNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}
float windAt(vec2 worldXZ, float t) {
  // Two layers of wind: a slow large-scale sway and a fast small-scale gust
  float t1 = t * uWindSpeed * 0.7 + uWindPhase;
  float t2 = t * uWindSpeed * 1.7 + uWindPhase * 1.3;
  vec2 p1 = worldXZ * uWindScale * 0.25 + vec2(t1 * 0.18, t1 * 0.12);
  vec2 p2 = worldXZ * uWindScale * 0.6 + vec2(-t2 * 0.25, t2 * 0.20);
  float w1 = windFBM(p1) - 0.5;
  float w2 = windFBM(p2) - 0.5;
  return w1 * 0.7 + w2 * 0.3;
}
`;

export function applyWind(material: THREE.MeshStandardMaterial, opts: WindOptions = {}): void {
  if (windMaterials.has(material)) return;
  windMaterials.add(material);

  const uniforms = {
    uTime:        { value: 0 },
    uWindStrength: { value: opts.strength ?? 0.04 },
    uWindSpeed:   { value: opts.speed ?? 1.0 },
    uWindScale:   { value: opts.scale ?? 4 },
    uWindPhase:   { value: opts.phaseSeed ?? Math.random() * 100 },
  };
  // Stash for the per-frame update (see windAnimate.ts)
  (material as any).__windUniforms = uniforms;
  (material as any).__windOpts = opts;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // 1) Inject uniforms + helper functions at the top of the vertex shader
    //    (must be global scope, so we put them after #include <common>)
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
${VERT_HEADER}
${VERT_DISPLACE}`,
      );

    // 2) Apply the displacement right after `transformed = position`.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
// Wind strength scales with vertex Y so flat ground stays put.
float yMask = clamp(transformed.y * 2.0 + 0.4, 0.0, 1.0);
float w = windAt(position.xz, uTime) * uWindStrength;
transformed.x += w * yMask;
transformed.z += w * 0.7 * yMask;
transformed.y += abs(w) * 0.15 * yMask;
vWindMask = yMask;
`,
    );

    // 3) Declare a varying in the fragment shader so we can modulate
    //    color slightly with the wind mask (subtle "leaves rustle" hue).
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vWindMask;`,
      );
    // Slight color modulation at the very end of the fragment shader
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
gl_FragColor.rgb += vec3(0.05, 0.08, 0.04) * vWindMask * 0.5;`,
    );
  };
  // Force recompile
  material.needsUpdate = true;
}

// Per-frame update for all wind-tagged materials in a scene.
export function updateWindMaterials(scene: THREE.Scene, t: number) {
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const u = (mat as any)?.__windUniforms;
      if (u) u.uTime.value = t;
    }
  });
}
