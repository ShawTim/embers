import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// ---------------------------------------------------------------------------
//  Ambient particle systems — dust motes, embers, floating leaves, magic
//  sparkles.  Each system is a single THREE.Points object so the GPU can
//  rasterise hundreds of particles in a single draw call.
//
//  All systems share the same update pattern: per-frame mutate the position
//  attribute, then set needsUpdate = true.  The seeds + phases are baked
//  once via useMemo so the system is deterministic across renders.
//
//  Usage:
//    <AmbientParticles kind="dust"  count={120} area={[18, 8, 14]} />
//    <AmbientParticles kind="ember" count={70}  area={[12, 5, 12]} color="#ff7a30" />
//    <AmbientParticles kind="leaf"  count={40}  area={[20, 6, 20]} />
//    <AmbientParticles kind="spark" count={80}  area={[16, 5, 16]} color="#7adfff" />
//
//  All systems are centred on (0, 0, 0) by default; pass `origin` to
//  recentre (useful when placing them over a particular map cell).
// ---------------------------------------------------------------------------

type Kind = "dust" | "ember" | "leaf" | "spark";

export interface AmbientParticlesProps {
  kind: Kind;
  count?: number;
  area?: [number, number, number]; // half-extents (x, y, z) for the spawn cube
  origin?: [number, number, number];
  color?: string;
  /** particle base size in world units */
  size?: number;
  /** particle transparency peak (0..1) */
  opacity?: number;
  /** scroll speed multiplier; higher = more chaotic */
  speed?: number;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ParticleBuffers {
  positions: Float32Array;
  /** initial seed positions (for ember rising & leaf loops) */
  seeds: Float32Array;
  /** per-particle phase offset so they don't all sync */
  phases: Float32Array;
  /** per-particle speed multiplier (variation) */
  speeds: Float32Array;
}

function makeBuffers(count: number, area: [number, number, number], seed: number): ParticleBuffers {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = (rng() * 2 - 1) * area[0];
    const y = rng() * area[1];
    const z = (rng() * 2 - 1) * area[2];
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i * 3 + 0] = x;
    seeds[i * 3 + 1] = y;
    seeds[i * 3 + 2] = z;
    phases[i] = rng() * Math.PI * 2;
    speeds[i] = 0.6 + rng() * 0.8;
  }
  return { positions, seeds, phases, speeds };
}

export function AmbientParticles({
  kind,
  count = 80,
  area = [12, 6, 12],
  origin = [0, 0, 0],
  color = "#ffffff",
  size = 0.18,
  opacity = 0.85,
  speed = 1.0,
}: AmbientParticlesProps) {
  const ref = useRef<THREE.Points>(null);
  const buf = useMemo<ParticleBuffers>(
    () => makeBuffers(count, area, hashSeed(kind, count, area[0])),
    [kind, count, area[0], area[1], area[2]],
  );

  // Sprite material with a soft round dot baked in a CanvasTexture so the
  // particles look like glow puffs, not hard squares.
  const mat = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === "leaf") {
      // Slightly off-center green ellipse
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(32, 32, 18, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.7)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return new THREE.PointsMaterial({
      size,
      map: tex,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: kind === "leaf" ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
  }, [kind, color, size, opacity]);

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const pos = buf.positions;
    const seed = buf.seeds;
    const ph = buf.phases;
    const sp = buf.speeds;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const ph0 = ph[i];
      const sp0 = sp[i];
      if (kind === "ember") {
        // Slowly rise upward, looping back to the ground. The y
        // value is the seed y plus a per-particle "elapsed" time
        // modulo the column height.
        const cycleY = area[1] * 1.2;
        const y0 = seed[idx + 1];
        const lifeT = ((t * 0.35 * sp0 + ph0) % cycleY) / cycleY;
        pos[idx + 0] = seed[idx + 0] + Math.sin(t * 0.9 + ph0) * 0.4;
        pos[idx + 1] = y0 + lifeT * cycleY;
        pos[idx + 2] = seed[idx + 2] + Math.cos(t * 0.7 + ph0 * 1.3) * 0.4;
      } else if (kind === "dust") {
        // Slow, lazy drift. Almost no y change — just gentle bob.
        pos[idx + 0] = seed[idx + 0] + Math.sin(t * 0.18 + ph0) * 0.5;
        pos[idx + 1] = seed[idx + 1] + Math.sin(t * 0.22 + ph0 * 0.7) * 0.25;
        pos[idx + 2] = seed[idx + 2] + Math.cos(t * 0.16 + ph0) * 0.5;
      } else if (kind === "leaf") {
        // Falling leaves — slow descent with side-to-side flutter.
        const cycleY = area[1] * 1.5;
        const y0 = seed[idx + 1];
        const lifeT = ((t * 0.18 * sp0 + ph0) % cycleY) / cycleY;
        pos[idx + 0] = seed[idx + 0] + Math.sin(t * 0.5 + ph0) * 0.8;
        pos[idx + 1] = y0 + cycleY - lifeT * cycleY;
        pos[idx + 2] = seed[idx + 2] + Math.cos(t * 0.4 + ph0 * 1.3) * 0.8;
      } else {
        // Sparkle — fast jitter, mostly stays put.
        pos[idx + 0] = seed[idx + 0] + Math.sin(t * 1.5 + ph0) * 0.4;
        pos[idx + 1] = seed[idx + 1] + Math.sin(t * 2.0 + ph0 * 0.7) * 0.3;
        pos[idx + 2] = seed[idx + 2] + Math.cos(t * 1.7 + ph0) * 0.4;
      }
    }
    if (ref.current) {
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={ref} position={origin} material={mat}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[buf.positions, 3]}
        />
      </bufferGeometry>
    </points>
  );
}

// ---------------------------------------------------------------------------
//  Chapter-keyed ambient layer — picks the right particle mix for each
//  chapter's theme. Used as <ChapterParticles chapterId="ch01" .../>.
// ---------------------------------------------------------------------------
export function ChapterParticles({ chapterId, w = 16, h = 12 }: { chapterId: string; w?: number; h?: number }) {
  const ax = Math.max(8, w * 0.7);
  const az = Math.max(8, h * 0.7);
  const ay = 5;

  if (chapterId === "ch12" || chapterId === "ch20") {
    // Lava / volcanic — heavy embers
    return (
      <>
        <AmbientParticles kind="ember" count={140} area={[ax, ay, az]} color="#ff7a30" size={0.22} opacity={0.95} speed={1.4} />
        <AmbientParticles kind="ember" count={70} area={[ax, ay, az]} color="#ffd060" size={0.14} opacity={0.9} speed={1.8} />
        <AmbientParticles kind="dust" count={60} area={[ax, ay, az]} color="#ff5530" opacity={0.4} speed={0.6} />
      </>
    );
  }
  if (chapterId === "ch14" || chapterId === "ch16" || chapterId === "ch11") {
    // Frozen / ice / winter — drifting snow-ish dust + sparkles
    return (
      <>
        <AmbientParticles kind="dust" count={180} area={[ax, ay + 2, az]} color="#e8f0ff" size={0.16} opacity={0.7} speed={0.5} />
        <AmbientParticles kind="spark" count={60} area={[ax, ay, az]} color="#a0e0ff" size={0.12} opacity={0.85} speed={0.8} />
      </>
    );
  }
  if (chapterId === "ch08" || chapterId === "ch18") {
    // Forest / dungeon — drifting leaves + dust
    return (
      <>
        <AmbientParticles kind="leaf" count={50} area={[ax, ay + 1, az]} color="#9ad86a" size={0.22} opacity={0.8} speed={0.7} />
        <AmbientParticles kind="dust" count={90} area={[ax, ay, az]} color="#d8e8c0" opacity={0.45} speed={0.4} />
      </>
    );
  }
  if (chapterId === "ch09" || chapterId === "ch13" || chapterId === "ch19") {
    // Magic / arcane — sparkles + dust
    return (
      <>
        <AmbientParticles kind="spark" count={120} area={[ax, ay, az]} color="#7adfff" size={0.15} opacity={0.85} speed={0.9} />
        <AmbientParticles kind="spark" count={50} area={[ax, ay, az]} color="#c080ff" size={0.12} opacity={0.8} speed={1.1} />
        <AmbientParticles kind="dust" count={60} area={[ax, ay, az]} color="#a0c0e8" opacity={0.35} speed={0.4} />
      </>
    );
  }
  // Default — ch01..07, ch10, ch15, ch17: dusk / generic
  return (
    <>
      <AmbientParticles kind="dust" count={100} area={[ax, ay, az]} color="#d8d0c0" opacity={0.4} speed={0.35} />
      <AmbientParticles kind="spark" count={30} area={[ax, ay, az]} color="#fff0c0" size={0.1} opacity={0.7} speed={0.6} />
    </>
  );
}

function hashSeed(...args: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const a of args) {
    const s = String(a);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
