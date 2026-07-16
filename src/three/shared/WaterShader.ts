import * as THREE from "three";

// ---------------------------------------------------------------------------
//  WaterShader — animated water surface patch for water / deep_water tiles.
//
//  Hooks into MeshStandardMaterial via onBeforeCompile.  Adds:
//   - Two scrolling normal layers (sine + cosine, cross directions)
//   - Caustic sparkle based on dot(sin(...), cos(...))
//   - Fresnel rim for shallow → deep transition
//   - Subtle time-based color drift (deep cold → bright surface)
//
//  Use:
//    applyWater(mat, { deep: false });
// ---------------------------------------------------------------------------

export interface WaterOptions {
  deep?: boolean;       // deep_water tint
  speed?: number;       // animation speed (default 1.0)
  rippleStrength?: number; // ripple amplitude (default 0.6)
}

const tagged = new WeakSet<THREE.Material>();

const VERT_HEADER = `
uniform float uTime;
uniform float uWaterSpeed;
uniform float uWaterRipple;
varying vec2 vWaterUv;
varying float vWaterDepth;
`;

const FRAG_HEADER = `
uniform float uTime;
uniform float uWaterSpeed;
uniform float uWaterRipple;
varying vec2 vWaterUv;
varying float vWaterDepth;

float waterHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float waterNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(waterHash(i), waterHash(i + vec2(1, 0)), u.x),
             mix(waterHash(i + vec2(0, 1)), waterHash(i + vec2(1, 1)), u.x), u.y);
}
// Caustic: two layers of noise whose product creates bright bands
float waterCaustic(vec2 p, float t) {
  vec2 q1 = p * 1.5 + vec2(t * 0.18, -t * 0.12);
  vec2 q2 = p * 2.0 + vec2(-t * 0.13, t * 0.20);
  float n1 = waterNoise(q1);
  float n2 = waterNoise(q2);
  return pow(n1 * n2, 0.5) * 4.0;
}
`;

export function applyWater(material: THREE.MeshStandardMaterial, opts: WaterOptions = {}): void {
  if (tagged.has(material)) return;
  tagged.add(material);

  const deep = opts.deep ?? false;
  const uniforms = {
    uTime:           { value: 0 },
    uWaterSpeed:     { value: opts.speed ?? 1.0 },
    uWaterRipple:    { value: opts.rippleStrength ?? 0.6 },
  };
  (material as any).__waterUniforms = uniforms;

  material.transparent = true;
  material.opacity = deep ? 0.96 : 0.88;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // ---------- Vertex ----------
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
${VERT_HEADER}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vWaterUv = uv;
vWaterDepth = clamp(position.y / 1.0, 0.0, 1.0);`,
    );

    // ---------- Fragment ----------
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
${FRAG_HEADER}`,
    );

    // Inject normal-map UV scroll & caustic into the normal map chunk
    // so the perturbed normal still lights correctly.  We abuse the
    // normalMap_pars chunk by overriding `normalScale` would be ideal
    // but injecting a procedural normal works in the next chunk.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
// Two scrolling normal samples
vec2 nuv1 = vWaterUv * 3.0 + vec2(uTime * uWaterSpeed * 0.18, uTime * uWaterSpeed * 0.12);
vec2 nuv2 = vWaterUv * 6.0 + vec2(-uTime * uWaterSpeed * 0.25, uTime * uWaterSpeed * 0.18);
float h1 = sin(nuv1.x * 6.28 + nuv1.y * 4.0) * cos(nuv1.y * 5.0 - nuv1.x * 3.0);
float h2 = sin(nuv2.x * 7.0 + nuv2.y * 3.0) * cos(nuv2.y * 4.0 + nuv2.x * 2.0);
vec3 nOffset = vec3((h1 + h2 * 0.5) * uWaterRipple * 0.15, 0.0, (h2 - h1 * 0.5) * uWaterRipple * 0.15);
normal = normalize(normal + nOffset);`,
    );

    // Add caustic sparkle to the diffuse color
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
float caust = waterCaustic(vWaterUv * 4.0, uTime * uWaterSpeed);
caust = clamp(caust, 0.0, 1.5);
${deep
  ? "diffuseColor.rgb += vec3(0.10, 0.18, 0.30) * caust * 0.5;"
  : "diffuseColor.rgb += vec3(0.20, 0.30, 0.40) * caust * 0.6;"}
`,
    );

    // Fresnel rim brightening — bright at glancing angles
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `
float fres = pow(1.0 - max(0.0, dot(normalize(vViewPosition), normal)), 3.0);
${deep
  ? "gl_FragColor.rgb += vec3(0.05, 0.10, 0.20) * fres;"
  : "gl_FragColor.rgb += vec3(0.10, 0.18, 0.30) * fres;"}
#include <output_fragment>
`,
    );
  };
  material.needsUpdate = true;
}

export function updateWaterMaterials(scene: THREE.Scene, t: number) {
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const u = (mat as any)?.__waterUniforms;
      if (u) u.uTime.value = t;
    }
  });
}
