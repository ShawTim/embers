import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { envForChapter } from "./shared/EnvMap";

// ---------------------------------------------------------------------------
//  SkyDome — a giant inverted sphere that surrounds the whole map.  Its
//  shader produces a vertical gradient (top -> mid -> bottom), a few
//  twinkling stars, and an optional moon position.  We pull colours
//  and star count from the chapter's EnvConfig so each chapter gets
//  the right mood (ch01 deep night, ch04 dawn, ch12 fire-red, etc).
//
//  The dome is rendered with the camera inside, so we set side =
//  BackSide and disable depth writes so the floor draws on top.
// ---------------------------------------------------------------------------

const VERT = /* glsl */`
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uHorizonGlow;
  uniform float uHorizonStrength;
  uniform float uStarCount;
  uniform float uTime;
  varying vec3 vWorldDir;

  // Hash + 3D Voronoi stars
  float hash3(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yxz + 19.27);
    return fract((p.x + p.y) * p.z);
  }
  float starLayer(vec3 dir, float scale, float threshold, float twinkleSpeed) {
    vec3 p = dir * scale;
    vec3 ip = floor(p);
    vec3 fp = fract(p) - 0.5;
    float minDist = 1.0;
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 cell = ip + vec3(float(x), float(y), float(z));
          vec3 jitter = vec3(hash3(cell), hash3(cell + 7.1), hash3(cell + 13.7)) - 0.5;
          vec3 d = vec3(float(x), float(y), float(z)) + jitter - fp;
          minDist = min(minDist, length(d));
        }
      }
    }
    float s = 1.0 - smoothstep(0.0, threshold, minDist);
    // Twinkle: each star modulates brightness with its own phase
    float ph = hash3(ip) * 6.28;
    float tw = 0.55 + 0.45 * sin(uTime * twinkleSpeed + ph);
    return s * tw;
  }

  void main() {
    vec3 d = normalize(vWorldDir);
    float y = d.y;                       // -1 (down) .. 1 (up)
    // 3-stop gradient: bottom (down) -> mid (horizon) -> top (zenith)
    vec3 col;
    if (y > 0.0) {
      float t = pow(y, 0.6);
      col = mix(uMid, uTop, t);
    } else {
      float t = pow(-y, 0.7);
      col = mix(uMid, uBottom, t);
    }
    // Horizon glow (slight brightening near y == 0)
    float horizon = exp(-abs(y) * 5.0) * uHorizonStrength;
    col += uHorizonGlow * horizon;

    // Stars — only above horizon, density falls off near horizon
    if (uStarCount > 0.0 && y > 0.05) {
      float twinkle = starLayer(d, 80.0, 0.06, 3.0) * smoothstep(0.05, 0.4, y);
      col += vec3(1.0, 0.95, 0.85) * twinkle * uStarCount;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SkyDome({ chapterId }: { chapterId: string }) {
  const cfg = useMemo(() => envForChapter(chapterId), [chapterId]);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTop: { value: new THREE.Color(cfg.topColor.r, cfg.topColor.g, cfg.topColor.b) },
          uMid: { value: new THREE.Color(cfg.midColor.r, cfg.midColor.g, cfg.midColor.b) },
          uBottom: { value: new THREE.Color(cfg.bottomColor.r, cfg.bottomColor.g, cfg.bottomColor.b) },
          uHorizonGlow: { value: new THREE.Color(cfg.sunColor.r, cfg.sunColor.g, cfg.sunColor.b).multiplyScalar(0.4) },
          uHorizonStrength: { value: cfg.horizonGlow },
          // 0..1: scale the star contribution by 1/starCount so we
          // get the same brightness regardless of count.
          uStarCount: { value: cfg.starCount > 0 ? Math.min(1.2, cfg.starCount / 200) : 0 },
          uTime: { value: 0 },
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    [cfg],
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[80, 32, 24]} />
      <primitive object={mat} ref={matRef as any} attach="material" />
    </mesh>
  );
}
