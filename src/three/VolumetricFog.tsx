import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// ---------------------------------------------------------------------------
//  VolumetricFog — a lightweight "fake" volumetric / sun-shaft effect.
//
//  Real volumetric fog would require a 3D noise field sampled along the
//  view ray. We get a similar look with a billboarded plane that fills
//  the camera's view: the fragment shader computes:
//    1. a soft radial gradient anchored at the screen-space sun position
//       (this reads as god-rays / sun shafts)
//    2. layered scrolling noise (this reads as drifting fog volume)
//    3. a depth-based fade so close tiles aren't washed out
//
//  Cost: one full-screen quad, one fragment shader, ~5% frame overhead.
// ---------------------------------------------------------------------------

export interface VolumetricFogProps {
  /** Logical map size — used to size the fog volume */
  w: number;
  h: number;
  /** Chapter id — picks fog density + color theme */
  chapterId: string;
  /** Density multiplier (0 = no fog, 1 = normal, 2 = heavy) */
  density?: number;
}

interface FogProfile {
  color: THREE.Color;
  density: number;
  sunStrength: number;
  sunSize: number;       // screen-space radius of the radial sun glow
  noiseStrength: number; // contrast of the drifting noise
  speed: number;         // noise scroll speed
}

function profileFor(chapterId: string): FogProfile {
  if (chapterId === "ch12" || chapterId === "ch20") {
    // Lava — deep red, low sun, hot noise
    return {
      color: new THREE.Color("#3a0a08"),
      density: 1.2,
      sunStrength: 0.4,
      sunSize: 0.32,
      noiseStrength: 0.6,
      speed: 0.6,
    };
  }
  if (chapterId === "ch14" || chapterId === "ch11") {
    // Frozen / ice — cold pale, soft sun
    return {
      color: new THREE.Color("#bcd6e8"),
      density: 0.9,
      sunStrength: 0.55,
      sunSize: 0.5,
      noiseStrength: 0.35,
      speed: 0.3,
    };
  }
  if (chapterId === "ch08" || chapterId === "ch18") {
    // Forest / dungeon — deep teal, very low sun
    return {
      color: new THREE.Color("#0a1814"),
      density: 1.3,
      sunStrength: 0.15,
      sunSize: 0.2,
      noiseStrength: 0.7,
      speed: 0.25,
    };
  }
  if (chapterId === "ch09" || chapterId === "ch13" || chapterId === "ch19") {
    // Arcane — purple
    return {
      color: new THREE.Color("#1a0a30"),
      density: 1.0,
      sunStrength: 0.5,
      sunSize: 0.4,
      noiseStrength: 0.5,
      speed: 0.5,
    };
  }
  // Default — ch01-07, ch10, ch15, ch17: dusk / generic
  return {
    color: new THREE.Color("#1a1e2a"),
    density: 0.85,
    sunStrength: 0.45,
    sunSize: 0.4,
    noiseStrength: 0.45,
    speed: 0.35,
  };
}

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uDensity;
  uniform float uSunStrength;
  uniform float uSunSize;
  uniform float uNoiseStrength;
  uniform float uSpeed;
  uniform vec2  uSun;        // screen-space sun position (0..1)
  uniform float uAspect;
  varying vec2  vUv;

  // ---- hash + value noise (cheap, smooth, GLSL ES 3.0 friendly) ----
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    // Aspect-corrected uv for the radial sun
    vec2 auv = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
    vec2 asun = vec2((uSun.x - 0.5) * uAspect, uSun.y - 0.5);
    float d = length(auv - asun);

    // Soft radial sun glow + god rays
    float core = exp(-d * d / (uSunSize * uSunSize)) * uSunStrength;
    // god-ray streaks: a stretched high-frequency FBM aligned to the sun
    vec2 rayUv = vec2(auv.x * 4.0 + auv.y * 0.8, auv.y * 2.0);
    float rays = fbm(rayUv + vec2(uTime * 0.04 * uSpeed, 0.0));
    rays = pow(rays, 2.4) * smoothstep(0.6, 0.0, d) * uSunStrength * 0.6;

    // Drifting fog noise — full-screen
    vec2 fogUv = uv * vec2(3.0, 2.0);
    float n = fbm(fogUv * 1.4 + vec2(uTime * 0.05 * uSpeed, uTime * 0.03 * uSpeed));
    n = smoothstep(0.35, 0.85, n);

    // Compose: base density (uniform haze) + noise modulation + sun glow
    float alpha = uDensity * (0.18 + n * uNoiseStrength);
    alpha = clamp(alpha + core + rays, 0.0, 1.0);

    // The fog colour: lit by the sun toward warm tone, shadow side toward
    // pure base colour. This gives a subtle directional wash.
    vec3 sunCol = vec3(1.0, 0.85, 0.65);
    float warmth = clamp(core * 1.5 + rays * 1.5, 0.0, 1.0);
    vec3 col = mix(uColor, uColor * 1.6 + sunCol * 0.4, warmth);

    gl_FragColor = vec4(col, alpha);
  }
`;

export function VolumetricFog({ w, h, chapterId, density = 1.0 }: VolumetricFogProps) {
  const { size, camera } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const profile = useMemo(() => profileFor(chapterId), [chapterId]);

  // Compute the world-space sun position based on the directional light
  // we already set in Scene.tsx. We project that vector into screen
  // space every frame and pass it to the shader.
  const sunWorld = useMemo(() => new THREE.Vector3(), []);

  const uniforms = useMemo(
    () => ({
      uColor: { value: profile.color.clone() },
      uTime: { value: 0 },
      uDensity: { value: profile.density * density },
      uSunStrength: { value: profile.sunStrength },
      uSunSize: { value: profile.sunSize },
      uNoiseStrength: { value: profile.noiseStrength },
      uSpeed: { value: profile.speed },
      uSun: { value: new THREE.Vector2(0.7, 0.78) },
      uAspect: { value: 16 / 9 },
    }),
    [profile, density],
  );

  useFrame((state) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uAspect.value = state.size.width / Math.max(1, state.size.height);

    // Sun comes from the same direction the directional light is
    // placed. We mirror the Scene's directional light here.
    const cx = (w - 1) / 2;
    const cz = (h - 1) / 2;
    sunWorld.set(cx + 4, 18, cz - 4);
    // Push it 40 units further so it acts as a "sky" position for
    // projection. Don't need the full distance; just enough that it
    // sits beyond the camera frustum.
    sunWorld.project(camera);
    // project() returns NDC (-1..1). Convert to uv (0..1).
    const sx = sunWorld.x * 0.5 + 0.5;
    const sy = sunWorld.y * 0.5 + 0.5;
    // If the sun is behind the camera, hide the sun glow (keep the
    // noise-only fog).
    if (sunWorld.z > 1) {
      u.uSunStrength.value = 0.0;
    } else {
      u.uSunStrength.value = profile.sunStrength;
    }
    (u.uSun.value as THREE.Vector2).set(sx, sy);
  });

  return (
    // A 2x2 plane that always covers the screen. We bypass the
    // projection matrix in the vertex shader so it sits on the
    // far plane (depth = 1).
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
