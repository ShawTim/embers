import { useRef, useEffect, useMemo, useState, Suspense } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ObjectMap } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three-stdlib";
import { attachSwingWeapon, animateMelee as swingMelee, applyManualLean, type SwingState, type WeaponKind } from "./shared/SwingWeapon";
import { spawnProjectile, spawnSlashTrail, tickProjectiles, tickSlashTrails, type ProjectileKind } from "./shared/Projectile";
import { Ch1CourtyardScene } from "./shared/Ch1Courtyard";
import { PolishGroup, polishFor, applyRimLight } from "./shared/CharacterPolish";

type GltfScene = GLTF & ObjectMap;

/**
 * LandingScene — a charming 3D battle vignette for the start screen.
 *
 * Eight chibi fighters face off in a continuous cinematic loop:
 *   · Kael (Knight) ↔ Bandit (Rogue)
 *   · Borin (Knight) ↔ Garrick (Barbarian boss)
 *   · Lyra (Mage) → heals Borin
 *   · Serra (Ranger) → arrow volley
 *   · Umbral Mage (Witch) → fireballs
 *
 * No game-state interaction — the scene runs forever as ambient art.
 * Camera slowly orbits, runes pulse, embers drift, and the timeline
 * loops with a short breath between cycles.
 */

const MODEL_PATHS: Record<string, string> = {
  Knight: import.meta.env.BASE_URL + "models/characters/Knight.glb",
  Barbarian: import.meta.env.BASE_URL + "models/characters/Barbarian.glb",
  Mage: import.meta.env.BASE_URL + "models/characters/Mage.glb",
  Ranger: import.meta.env.BASE_URL + "models/characters/Ranger.glb",
  Rogue: import.meta.env.BASE_URL + "models/characters/Rogue.glb",
  Rogue_Hooded: import.meta.env.BASE_URL + "models/characters/Rogue_Hooded.glb",
  Witch: import.meta.env.BASE_URL + "models/characters/Witch.glb",
};
const ANIM_PATHS = {
  general: import.meta.env.BASE_URL + "models/animations/Rig_Medium_General.glb",
  movement: import.meta.env.BASE_URL + "models/animations/Rig_Medium_MovementBasic.glb",
  melee: import.meta.env.BASE_URL + "models/animations/Rig_Medium_CombatMelee.glb",
  ranged: import.meta.env.BASE_URL + "models/animations/Rig_Medium_CombatRanged.glb",
};
// Note: preloading is handled by App.tsx via the loading screen (see
// the loader at the top of App.tsx). We do NOT call useGLTF.preload
// here because that would trigger a parallel download of the same
// files and double the network traffic on first load.

const ANIM = {
  idle: "Idle_A",
  idleB: "Idle_B",
  walk: "Walking_A",
  attackSlash: "Melee_1H_Attack_Slice_Diagonal",
  attackChop: "Melee_1H_Attack_Chop",
  magicShoot: "Ranged_Magic_Shoot",
  bowShoot: "Ranged_Bow_Release",
  hitA: "Hit_A",
  deathA: "Death_A",
};

const TARGET_HEIGHT = 1.6;

// ---- Slot layout (8 fighters on a small circular platform) ----
// Heroes in a line at x = -2.0, villains mirror at x = +2.0 — the
// gap is small enough that a ~1.5 unit lunge from each side meets
// roughly at mid-stage, giving a clear "two lines charging at each
// other" look.
const HERO_LINE_X = -2.2;
const VILLAIN_LINE_X = 2.2;
const RANK_Z = [-2.1, -0.7, 0.7, 2.1];
const HERO_SLOTS: [number, number][] = RANK_Z.map((z) => [HERO_LINE_X, z] as [number, number]);
const VILLAIN_SLOTS: [number, number][] = RANK_Z.map((z) => [VILLAIN_LINE_X, z] as [number, number]);

type Side = "hero" | "villain";
interface Combatant {
  id: string;
  modelId: keyof typeof MODEL_PATHS;
  slot: [number, number];
  phase: number;        // idle bob phase offset
  baseY: number;
  body: THREE.Group | null;
  lunge: THREE.Group | null;  // container that handles attack lunge offset
  swing: SwingState | null;   // shared swing weapon + manual lean fields
  weaponKind: WeaponKind;     // drives swing animation + mesh
  orbColor?: number;          // glow orb color for staff/fire casters
  mixer: THREE.AnimationMixer | null;
  targetRotY: number;
  curRotY: number;
  bobAmp: number;
  hpTint: number;       // 0..1 redness flash
  hpTintDecay: number;
  nextAttackAt: number;  // world time when this character attacks next
  // Cache of materials that have an `emissive` channel. The hp-tint
  // flash only needs to mutate these (rather than `traverse` the
  // whole skeleton every frame).
  tintMats: THREE.MeshStandardMaterial[];
}

interface Spell {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t: number;
  duration: number;
  color: THREE.Color;
  kind: ProjectileKind;
  onHit?: () => void;
}

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
  color: THREE.Color;
}

const HEROES: Array<{ id: string; modelId: keyof typeof MODEL_PATHS; accent: string; weaponKind: WeaponKind; orbColor?: number }> = [
  // Kael — young lord with iron sword
  { id: "kael",   modelId: "Knight", accent: "#3a6ad8", weaponKind: "sword" },
  // Borin — veteran knight with iron lance
  { id: "borin",  modelId: "Knight", accent: "#5a78a0", weaponKind: "lance" },
  // Lyra — cleric with heal staff
  { id: "lyra",   modelId: "Mage",   accent: "#d8c060", weaponKind: "staff", orbColor: 0xfff0a0 },
  // Serra — archer with bow
  { id: "serra",  modelId: "Ranger", accent: "#3aa050", weaponKind: "bow" },
];
const VILLAINS: Array<{ id: string; modelId: keyof typeof MODEL_PATHS; accent: string; isBoss?: boolean; weaponKind: WeaponKind; orbColor?: number }> = [
  // Garrick — boss with steel axe (heavy-hitter)
  { id: "garrick",  modelId: "Barbarian", accent: "#a02828", isBoss: true, weaponKind: "axe" },
  // Bandit A — mercenary with iron sword
  { id: "bandit_a", modelId: "Rogue",      accent: "#7a4828", weaponKind: "sword" },
  // Umbral Acolyte — mage with fire magic
  { id: "umbral",   modelId: "Witch",      accent: "#5828a0", weaponKind: "fire", orbColor: 0xff5530 },
  // Bandit B — fighter with iron axe
  { id: "bandit_b", modelId: "Rogue_Hooded", accent: "#643c20", weaponKind: "axe" },
];

// ---- Independent per-character attack schedules -------------------
// Each character has its own cooldown so the two lines attack
// independently and continuously — no rounds, no sync, no
// "wait for the other one to finish". A character picks a random
// action (melee/cast/ranged), targets a random opponent on the
// opposite line, then waits 0.4-0.9s before its next attack.
type Event =
  | { kind: "melee"; side: Side; attacker: number; target: number }
  | { kind: "cast"; side: Side; attacker: number; target: number; color: string }
  | { kind: "ranged"; side: Side; attacker: number; target: number }
  | { kind: "heal"; attacker: number; target: number };

// Drop the round system entirely. We use per-combatant cooldowns below.

export function LandingScene() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 3.4, 9.0], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }: { gl: THREE.WebGLRenderer }) => gl.setClearColor("#0a0e18")}
      >
        <LandingLighting />
        <fog attach="fog" args={["#0a0e18", 22, 65]} />
        <Ch1CourtyardScene />
        <Suspense fallback={null}>
          <Combatants />
        </Suspense>
        <OrbitCamera />
      </Canvas>
    </div>
  );
}

// ----------------------------------------------------------------
// Lighting
// ----------------------------------------------------------------
function LandingLighting() {
  return (
    <>
      {/* Soft cool ambient — moonlit night but still readable */}
      <ambientLight intensity={1.0} color="#8090b0" />
      <hemisphereLight args={["#a8b8d8", "#3a2a1a", 0.6]} />
      {/* Strong key light from the moon direction — gives shape.
          Shadows are opt-in (controlled by the Canvas's `shadows` prop);
          when disabled, the light still contributes to shading but
          nothing is rendered to the shadow map. */}
      <directionalLight
        position={[10, 16, -18]}
        intensity={1.8}
        color="#d0d8e8"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />
      {/* Fill from camera-back for silhouette readability */}
      <directionalLight position={[-6, 8, 8]} intensity={0.7} color="#9aa5c0" />
      {/* Warm torch glow over the fighting area — counter the cold blue */}
      <pointLight position={[0, 2.5, 0]} intensity={1.8} color="#ff8030" distance={18} decay={1.2} />
      {/* A second warm light from the right, suggesting an off-screen torch */}
      <pointLight position={[4, 2, 3]} intensity={1.0} color="#ffaa50" distance={14} decay={1.3} />
      <pointLight position={[-4, 2, -3]} intensity={0.8} color="#ff7030" distance={12} decay={1.4} />
    </>
  );
}

// ----------------------------------------------------------------
// Camera
// ----------------------------------------------------------------
// Camera — slow side-to-side pan within a "good" arc so the floor
// never dominates the frame and the back wall is always behind the
// characters. A full 360° orbit makes the camera go behind the wall
// at some angles, which is bad. We oscillate ±20° around the
// starting angle instead.
// ----------------------------------------------------------------
function OrbitCamera() {
  const { camera } = useThree();
  const t = useRef(0);
  useEffect(() => {
    camera.position.set(-1.8, 3.0, 8.5);
    camera.lookAt(-1.8, 0.7, 0);
  }, [camera]);
  useFrame((_, delta) => {
    t.current += delta;
    // Oscillate ±20° around the +Z axis. Slow and never goes
    // behind the back wall.
    const baseAngle = Math.sin(t.current * 0.18) * 0.30;
    const r = 8.5;
    const sway = Math.sin(t.current * 0.4) * 0.20;
    const height = 3.0 + Math.sin(t.current * 0.22) * 0.20;
    // Camera orbits around a target that's offset to the LEFT
    // of world origin so the heroes (left side, x ≈ -2.2) end up
    // near the screen center / right, clear of the start-screen
    // card on the left.
    const tx = -1.6;
    const tz = 0;
    const x = tx + Math.sin(baseAngle) * r;
    const z = tz + Math.cos(baseAngle) * r;
    camera.position.set(x, height + sway, z);
    camera.lookAt(tx, 0.7, 0);
  });
  return null;
}

// ----------------------------------------------------------------
// Battle stage (platform + glowing rune ring)
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Battle stage — Ch1 "Embers in the Night" courtyard of Ashwood
// estate. A cobblestone ground with broken wall segments behind,
// burning torches around the perimeter, and a full moon overhead.
// ----------------------------------------------------------------
function BattleStage() {
  // Torches flicker
  const torch1 = useRef<THREE.PointLight>(null);
  const torch2 = useRef<THREE.PointLight>(null);
  const torch3 = useRef<THREE.PointLight>(null);
  const torch4 = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (torch1.current) torch1.current.intensity = 1.6 + Math.sin(t * 4.1) * 0.4;
    if (torch2.current) torch2.current.intensity = 1.6 + Math.sin(t * 3.7 + 1.3) * 0.4;
    if (torch3.current) torch3.current.intensity = 1.6 + Math.sin(t * 4.5 + 2.7) * 0.4;
    if (torch4.current) torch4.current.intensity = 1.6 + Math.sin(t * 3.3 + 0.5) * 0.4;
  });
  // Torches: position closer to the stage so they're visible behind
  // the fighting area and not lost in the fog.
  const torchPositions: [number, number][] = [
    [-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3],
  ];
  return (
    <group>
      {/* Sky dome — dark night */}
      <mesh>
        <sphereGeometry args={[80, 16, 16]} />
        <meshBasicMaterial color="#0c1424" side={THREE.BackSide} />
      </mesh>
      {/* Full moon — emissive sphere up high */}
      <mesh position={[12, 14, -16]}>
        <sphereGeometry args={[3.0, 24, 24]} />
        <meshBasicMaterial color="#f5f6ff" />
      </mesh>
      {/* Soft moon halo */}
      <mesh position={[12, 14, -16]}>
        <sphereGeometry args={[4.0, 24, 24]} />
        <meshBasicMaterial color="#dde2f0" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <pointLight position={[12, 14, -16]} intensity={1.8} color="#e8ecf6" distance={60} decay={1.3} />
      {/* Cobblestone ground — extends out to camera */}
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#3a3530" roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Stone floor detail — slightly raised flagstones in fighting area */}
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <cylinderGeometry args={[5.8, 5.8, 0.04, 56]} />
        <meshStandardMaterial color="#4d4842" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <cylinderGeometry args={[5.4, 5.4, 0.04, 56]} />
        <meshStandardMaterial color="#3a3530" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Broken estate wall — back arc behind the fighting area */}
      <CourtyardWall />
      {/* Burning torches around the perimeter */}
      {torchPositions.map(([x, z], i) => (
        <Torch key={i} pos={[x, z]} lightRef={[torch1, torch2, torch3, torch4][i]} index={i} />
      ))}
    </group>
  );
}

// A broken stone wall segment — looks like a section of the
// estate's outer wall. Each segment is a Box with crenellations
// on top and a few rough stones scattered around its base.
function WallSegment({ pos, rot, len = 4, height = 2.4 }: { pos: [number, number, number]; rot: number; len?: number; height?: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, height, 0.4]} />
        <meshStandardMaterial color="#5a5045" roughness={0.95} />
      </mesh>
      {/* Crenellation: 3 small blocks on top */}
      {[-len / 2 + 0.4, 0, len / 2 - 0.4].map((cx, i) => (
        <mesh key={i} position={[cx, height + 0.18, 0]} castShadow>
          <boxGeometry args={[0.6, 0.36, 0.5]} />
          <meshStandardMaterial color="#5a5045" roughness={0.95} />
        </mesh>
      ))}
      {/* A few small rubble stones at the base */}
      {[[0.7, 0.12, 0.35], [-0.6, 0.08, 0.4], [0.1, 0.15, -0.4]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <dodecahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#4a4138" roughness={1.0} />
        </mesh>
      ))}
    </group>
  );
}

function CourtyardWall() {
  // Wall segments arranged in a C-shape behind the fighting area,
  // leaving an open gap in the front (camera side) so we can see in.
  return (
    <group>
      <WallSegment pos={[-3, 0, -6]} rot={0} len={5} />
      <WallSegment pos={[3, 0, -6]} rot={0} len={5} />
      <WallSegment pos={[-7, 0, -3]} rot={Math.PI / 2} len={5} />
      <WallSegment pos={[7, 0, -3]} rot={Math.PI / 2} len={5} />
      {/* A taller section on the right — a small tower */}
      <group position={[8, 0, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 3, 1.4]} />
          <meshStandardMaterial color="#5a5045" roughness={0.95} />
        </mesh>
        {/* Battlements on top */}
        {[0, 0.5, 1.0].map((z, i) => (
          <mesh key={i} position={[-0.5, 3.18, z]} castShadow>
            <boxGeometry args={[0.3, 0.36, 0.3]} />
            <meshStandardMaterial color="#5a5045" roughness={0.95} />
          </mesh>
        ))}
        {[0, 0.5, 1.0].map((z, i) => (
          <mesh key={`r-${i}`} position={[0.5, 3.18, z]} castShadow>
            <boxGeometry args={[0.3, 0.36, 0.3]} />
            <meshStandardMaterial color="#5a5045" roughness={0.95} />
          </mesh>
        ))}
      </group>
      {/* Scattered broken masonry around the floor edges */}
      {[[-7, 0.1, 2], [7, 0.1, 2], [-7, 0.1, -1], [7, 0.1, -1], [0, 0.1, -7], [-4, 0.1, 5], [4, 0.1, 5]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <dodecahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial color="#4a4138" roughness={1.0} />
        </mesh>
      ))}
    </group>
  );
}

// A burning torch on a wooden pole
function Torch({ pos, lightRef, index }: { pos: [number, number]; lightRef: React.MutableRefObject<THREE.PointLight | null>; index: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* Wooden pole */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 1.6, 6]} />
        <meshStandardMaterial color="#3d2a1a" roughness={0.95} />
      </mesh>
      {/* Iron bracket */}
      <mesh position={[0.1, 1.55, 0]} castShadow>
        <boxGeometry args={[0.18, 0.08, 0.08]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Flame — emissive sphere */}
      <mesh position={[0.1, 1.7, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#ffb84a" />
      </mesh>
      <mesh position={[0.1, 1.8, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#fff0a0" />
      </mesh>
      {/* Point light (registered via ref so BattleStage can flicker it) */}
      <pointLight ref={lightRef} position={[0.1, 1.8, 0]} intensity={1.6} color="#ff9040" distance={9} decay={1.5} castShadow={false} />
    </group>
  );
}

// ----------------------------------------------------------------
// Ember sparks (kept from old scene — fits the burning estate)
// ----------------------------------------------------------------
function FloatingEmbers() {
  const ref = useRef<THREE.Points>(null);
  const { positions, phases, count } = useMemo(() => {
    const N = 70;
    const positions = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    const rng = mulberry32(0xE4BE12);
    for (let i = 0; i < N; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * 4.2;
      positions[i * 3 + 0] = Math.cos(angle) * dist;
      positions[i * 3 + 1] = rng() * 6;
      positions[i * 3 + 2] = Math.sin(angle) * dist;
      phases[i] = rng() * Math.PI * 2;
    }
    return { positions, phases, count: N };
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = phases[i];
      const baseY = (Math.sin(t * 0.6 + p) * 0.4 + t * 0.25) % 6;
      ref.current.geometry.attributes.position.setXYZ(
        i,
        positions[i * 3] + Math.sin(t * 0.8 + p) * 0.3,
        baseY,
        positions[i * 3 + 2] + Math.cos(t * 0.6 + p * 1.3) * 0.3,
      );
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.18} sizeAttenuation color="#ff9a3a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ----------------------------------------------------------------
// Combatants + timeline choreography
// ----------------------------------------------------------------
function Combatants() {
  // Shared clip dictionary
  const animG = useGLTF(ANIM_PATHS.general);
  const animM = useGLTF(ANIM_PATHS.movement);
  const animMe = useGLTF(ANIM_PATHS.melee);
  const animR = useGLTF(ANIM_PATHS.ranged);
  const clips = useMemo(() => {
    const all = [...animG.animations, ...animM.animations, ...animMe.animations, ...animR.animations];
    return Object.fromEntries(all.map((c) => [c.name, c]));
  }, [animG, animM, animMe, animR]);
  const clipsRef = useRef<Record<string, THREE.AnimationClip>>({});
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  // Pre-loaded GLB scenes per model id (shared, cloned per combatant)
  const knightGltf = useGLTF(MODEL_PATHS.Knight);
  const barbarianGltf = useGLTF(MODEL_PATHS.Barbarian);
  const mageGltf = useGLTF(MODEL_PATHS.Mage);
  const rangerGltf = useGLTF(MODEL_PATHS.Ranger);
  const rogueGltf = useGLTF(MODEL_PATHS.Rogue);
  const rogueHGltf = useGLTF(MODEL_PATHS.Rogue_Hooded);
  const witchGltf = useGLTF(MODEL_PATHS.Witch);

  const gltfById = useMemo(
    () => ({
      Knight: knightGltf,
      Barbarian: barbarianGltf,
      Mage: mageGltf,
      Ranger: rangerGltf,
      Rogue: rogueGltf,
      Rogue_Hooded: rogueHGltf,
      Witch: witchGltf,
    }) as Record<keyof typeof MODEL_PATHS, GltfScene>,
    [knightGltf, barbarianGltf, mageGltf, rangerGltf, rogueGltf, rogueHGltf, witchGltf],
  );

  // Build combatant entries. Each character gets a unique initial
  // cooldown so they attack at staggered times, not all at once.
  const [heroes] = useState<Combatant[]>(() =>
    HEROES.map((d, i) => ({
      id: d.id,
      modelId: d.modelId,
      slot: HERO_SLOTS[i],
      phase: i * 0.7,
      baseY: 0,
      body: null,
      lunge: null,
      swing: null,
      weaponKind: d.weaponKind,
      orbColor: d.orbColor,
      mixer: null,
      targetRotY: Math.PI / 2,
      curRotY: Math.PI / 2,
      bobAmp: 0.025,
      hpTint: 0,
      hpTintDecay: 0,
      nextAttackAt: 0.4 + i * 0.45 + Math.random() * 0.5,
      tintMats: [],
    })),
  );
  const [villains] = useState<Combatant[]>(() =>
    VILLAINS.map((d, i) => ({
      id: d.id,
      modelId: d.modelId as keyof typeof MODEL_PATHS,
      slot: VILLAIN_SLOTS[i],
      phase: i * 0.7,
      baseY: 0,
      body: null,
      lunge: null,
      swing: null,
      weaponKind: d.weaponKind,
      orbColor: d.orbColor,
      mixer: null,
      targetRotY: -Math.PI / 2,
      curRotY: -Math.PI / 2,
      bobAmp: 0.025,
      hpTint: 0,
      hpTintDecay: 0,
      nextAttackAt: 0.7 + i * 0.45 + Math.random() * 0.5,
      tintMats: [],
    })),
  );

  // The root group that all projectiles, sparks, and slash trails
  // are added to. The LandingActor sub-component places characters
  // under stageRoot, so they live alongside the projectiles.
  const stageRoot = useRef<THREE.Group | null>(null);
  const activeSpells = useRef<Spell[]>([]);
  const activeSparks = useRef<Spark[]>([]);
  // Per-character attack RNG (deterministic but advances each call)
  const attackRng = useRef(mulberry32(0xA7B1));

  // Spell meshes
  const spellGroup = useRef<THREE.Group>(null);
  // Spark group
  const sparkGroup = useRef<THREE.Group>(null);

  // -- dispatch/state held in refs so useFrame callback can read fresh values --
  const heroesRef = useRef(heroes);
  const villainsRef = useRef(villains);
  heroesRef.current = heroes;
  villainsRef.current = villains;

  function getClip(name: string) {
    return clipsRef.current[name] as THREE.AnimationClip | undefined;
  }

  function playAnim(c: Combatant, name: string, loop = false, fade = 0.2) {
    if (!c.mixer || !c.body) return;
    const clip = getClip(name);
    if (!clip) return;
    const action = c.mixer.clipAction(clip, c.body);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.fadeIn(fade).play();
  }

  function setIdle(c: Combatant) {
    if (!c.mixer || !c.body) return;
    playAnim(c, ANIM.idle, true, 0.25);
  }

  function dispatch(evt: Event) {
    // Resolve attacker / target from their respective side arrays
    // (they are always on opposite sides)
    const side: Side = (evt as any).side ?? "hero";
    const attackerArr = side === "hero" ? heroesRef.current : villainsRef.current;
    const targetArr = side === "hero" ? villainsRef.current : heroesRef.current;
    switch (evt.kind) {
      case "melee": {
        const a = attackerArr[evt.attacker];
        const b = targetArr[evt.target];
        if (!a || !b || a === b) return;
        const ax = a.slot[0], az = a.slot[1];
        const bx = b.slot[0], bz = b.slot[1];
        const dx = bx - ax, dz = bz - az;
        const len = Math.max(0.001, Math.hypot(dx, dz));
        const ux = dx / len, uz = dz / len;
        const reach = Math.min(1.8, len * 0.45);
        const hitX = ax + ux * reach, hitZ = az + uz * reach;
        a.targetRotY = Math.atan2(ux, uz);
        faceTarget(a, bx, bz);
        // Slash trail color depends on the character — heroes get a
        // bright silver slash, villains get a red one. Boss gets gold.
        const slashColor = a.id === "garrick"
          ? new THREE.Color(0xffc850)
          : a.id === "kael"
            ? new THREE.Color(0xc8e0ff)
            : new THREE.Color(0xfff0a0);
        animateMelee(a, hitX, hitZ, () => {
          if (!b.lunge || !b.lunge.parent) return;
          b.hpTint = 1;
          // Glowing arc at the impact point, facing the strike
          // direction. Rotated so the arc opens away from the
          // attacker.
          spawnSlashTrail(stageRoot.current!, new THREE.Vector3(bx, 0, bz), slashColor, 0.4);
          spawnSparksAt(b, slashColor);
          playAnim(b, ANIM.hitA, false, 0.05);
          setTimeout(() => setIdle(b), 220);
        });
        setTimeout(() => setIdle(a), 360);
        break;
      }
      case "cast": {
        const a = attackerArr[evt.attacker];
        const b = targetArr[evt.target];
        if (!a || !b) return;
        const start = worldPos(a).clone().add(new THREE.Vector3(0, 1.2, 0));
        const end = worldPos(b).clone().add(new THREE.Vector3(0, 1.0, 0));
        const color = new THREE.Color(evt.color);
        // Determine projectile kind from the attacker. Heroes (Lyra)
        // and Serra use a magic bolt, Umbral uses a fireball. Most
        // villains use a fireball. Anyone with garrick uses a fireball.
        let kind: ProjectileKind = "fireball";
        if (a.id === "lyra" || a.id === "serra") kind = "spark";
        else if (a.id === "garrick") kind = "fireball";
        else if (a.id === "umbral") kind = "fireball";
        else kind = "fireball";
        a.targetRotY = Math.atan2(end.x - a.slot[0], end.z - a.slot[1]);
        faceTarget(a, end.x, end.z);
        playAnim(a, ANIM.magicShoot, false, 0.08);
        spawnProjectile({
          parent: stageRoot.current!,
          start,
          end,
          color,
          kind,
          duration: kind === "fireball" ? 0.5 : 0.4,
          onImpact: () => {
            b.hpTint = 1;
            spawnSparksAt(b, color);
            playAnim(b, ANIM.hitA, false, 0.05);
            setTimeout(() => setIdle(b), 220);
          },
        });
        setTimeout(() => setIdle(a), 360);
        break;
      }
      case "ranged": {
        const a = attackerArr[evt.attacker];
        const b = targetArr[evt.target];
        if (!a || !b) return;
        // Determine the arrow color. Heroes shoot green arrows,
        // villains shoot dull red. Serra (hero archer) and any
        // villain archer get the arrow shape.
        const color = a.id === "serra"
          ? new THREE.Color(0x7aff80)
          : new THREE.Color(0xff7060);
        const start = worldPos(a).clone().add(new THREE.Vector3(0, 1.0, 0));
        const end = worldPos(b).clone().add(new THREE.Vector3(0, 0.8, 0));
        a.targetRotY = Math.atan2(end.x - a.slot[0], end.z - a.slot[1]);
        faceTarget(a, end.x, end.z);
        playAnim(a, ANIM.bowShoot, false, 0.08);
        // Small lead time before the arrow leaves the bow
        setTimeout(() => {
          spawnProjectile({
            parent: stageRoot.current!,
            start,
            end,
            color,
            kind: "arrow",
            duration: 0.28,
            onImpact: () => {
              b.hpTint = 1;
              spawnSparksAt(b, color);
              playAnim(b, ANIM.hitA, false, 0.05);
              setTimeout(() => setIdle(b), 220);
            },
          });
        }, 110);
        setTimeout(() => setIdle(a), 360);
        break;
      }
      case "heal": {
        // Heal targets an ally on the same side. attackerArr is the
        // hero array (heals only happen for heroes).
        const a = attackerArr[evt.attacker];
        const b = attackerArr[evt.target];
        if (!a || !b || a === b) return;
        playAnim(a, ANIM.magicShoot, false, 0.08);
        const end = worldPos(b);
        end.y = 0.9;
        a.targetRotY = Math.atan2(b.slot[0] - a.slot[0], b.slot[1] - a.slot[1]);
        faceTarget(a, b.slot[0], b.slot[1]);
        setTimeout(() => {
          for (let i = 0; i < 7; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 0.3 + Math.random() * 0.3;
            const p0 = _sparkTmp.set(end.x + Math.cos(angle) * r, end.y, end.z + Math.sin(angle) * r);
            const v = _sparkVel.set(Math.cos(angle) * 0.4, 1.2 + Math.random() * 0.4, Math.sin(angle) * 0.4);
            spawnSpark(p0, v, _HEAL_COLOR, 0.7);
          }
        }, 150);
        setTimeout(() => setIdle(a), 360);
        break;
      }
    }
  }

  function animateMelee(c: Combatant, hitX: number, hitZ: number, onImpact?: () => void) {
    if (!c.body || !c.lunge || !c.swing) return;
    swingMelee({
      body: c.body,
      lunge: c.lunge,
      slot: c.slot,
      hitX,
      hitZ,
      state: c.swing,
      onImpact,
    });
  }

  function faceTarget(c: Combatant, targetX: number, targetZ: number) {
    if (!c.body) return;
    const wp = new THREE.Vector3();
    c.body.getWorldPosition(wp);
    c.body.lookAt(targetX, wp.y, targetZ);
  }

  function worldPos(c: Combatant) {
    return new THREE.Vector3(c.slot[0], 0, c.slot[1]);
  }

  // Per-character independent scheduler. Called every frame for each
  // side. For every character whose cooldown has elapsed, fire an
  // event and reschedule.
  function triggerDueAttacks(arr: Combatant[], side: Side, t: number) {
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      if (!c.body) continue;
      if (t < c.nextAttackAt) continue;
      // Pick an action. Target is the OPPOSITE side's combatant array
      // — never our own side.
      const enemyArr = side === "hero" ? villainsRef.current : heroesRef.current;
      const target = Math.floor(attackRng.current() * enemyArr.length);
      const kind = pickAttackKind(c, attackRng.current());
      if (kind === "heal" && side === "hero") {
        // Lyra-style heal: aim at a random ally instead of an enemy
        const ally = (i + 1 + Math.floor(attackRng.current() * (arr.length - 1))) % arr.length;
        dispatchRef.current({ kind: "heal", attacker: i, target: ally } as Event);
      } else {
        const color = kind === "cast" ? pickCastColor(c) : undefined;
        dispatchRef.current({ kind: kind as any, side, attacker: i, target, color } as Event);
      }
      const base = kind === "cast" ? 0.75 : kind === "ranged" ? 0.6 : 0.5;
      const jitter = (attackRng.current() - 0.5) * 0.4;
      c.nextAttackAt = t + base + jitter;
    }
  }
  function pickAttackKind(c: Combatant, r: number): "melee" | "cast" | "ranged" | "heal" {
    // Weapon kind drives the action. Physical melee (sword/lance/axe)
    // → swing. Bow → shoot. Staff/fire → cast. Lyra sometimes heals
    // instead of casting offensively.
    if (c.id === "lyra" && r < 0.25) return "heal";
    switch (c.weaponKind) {
      case "bow":   return "ranged";
      case "staff":
      case "fire":  return "cast";
      case "sword":
      case "lance":
      case "axe":
      default:      return "melee";
    }
  }
  function pickCastColor(c: Combatant): string {
    if (c.weaponKind === "staff") return "#7adfff";
    if (c.id === "garrick") return "#ff2244";
    return "#ff5530";
  }

  function spawnSparksAt(c: Combatant, color: THREE.Color) {
    const base = worldPos(c);
    base.y = 1.0;
    for (let i = 0; i < 6; i++) {
      const dir = _sparkDir.set((Math.random() - 0.5) * 2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
      const v = _sparkVel.copy(dir).multiplyScalar(1.4 + Math.random() * 0.6);
      spawnSpark(_sparkTmp.copy(base), v, color, 0.5);
    }
  }

  function spawnSparks(pos: THREE.Vector3, color: THREE.Color) {
    for (let i = 0; i < 10; i++) {
      const dir = _sparkDir.set((Math.random() - 0.5) * 2, Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
      const v = _sparkVel.copy(dir).multiplyScalar(1.5 + Math.random() * 1.0);
      spawnSpark(_sparkTmp.copy(pos), v, color, 0.55);
    }
    if (sparkGroup.current) {
      const ring = makeShockRing(pos, color);
      sparkGroup.current.add(ring);
    }
  }

  function spawnSpark(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color, life: number) {
    if (!sparkGroup.current) return;
    const geo = SHARED_SPARK_GEO;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    sparkGroup.current.add(mesh);
    activeSparks.current.push({ pos: pos.clone(), vel, life: 0, maxLife: life, mesh, color });
  }

  // -- Held in ref so useFrame callback always sees the latest version --
  const dispatchRef = useRef<(e: Event) => void>(() => {});
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    for (const arr of [heroesRef.current, villainsRef.current]) {
      for (const c of arr) {
        if (!c.body) continue;
        c.body.position.y = Math.sin(t * 1.4 + c.phase) * c.bobAmp;
        // Smooth turn toward target rotation
        let diff = c.targetRotY - c.curRotY;
        diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        c.curRotY += diff * Math.min(1, delta * 8);
        c.body.rotation.y = c.curRotY;
        if (c.mixer) c.mixer.update(delta);
        // Apply manual lean AFTER the mixer so the GLB idle animation
        // cannot push the body into a weird pose (e.g. -π headstand).
        if (c.swing) applyManualLean(c.body, c.swing.leanX, c.swing.leanZ);
        // HP-tint flash: mutate the cached materials instead of
        // traversing the skeleton every frame.
        if (c.hpTint > 0) {
          c.hpTint = Math.max(0, c.hpTint - delta * 2.2);
          const e = 0.4 * c.hpTint;
          const mats = c.tintMats;
          for (let i = 0; i < mats.length; i++) mats[i].emissiveIntensity = e;
        }
      }
    }

    // Drive projectile + slash-trail + shock-ring animations from the
    // single r3f frame loop (replaces per-spawn requestAnimationFrame).
    tickProjectiles(delta);
    tickSlashTrails(delta);
    tickShockRings();

    // Independent per-character attack schedule. Each character has
    // its own cooldown; as soon as t crosses nextAttackAt, the
    // character attacks and we schedule its next one 0.4-0.9s later.
    // This gives a continuous, desynced brawl.
    triggerDueAttacks(heroesRef.current, "hero", t);
    triggerDueAttacks(villainsRef.current, "villain", t);

    // Projectiles animate themselves via the shared module's
    // requestAnimationFrame loop, so there's no per-frame work to do
    // here for them. We only need to update sparks (debris from
    // impacts).
    for (let i = activeSparks.current.length - 1; i >= 0; i--) {
      const sp = activeSparks.current[i];
      sp.life += delta;
      sp.pos.addScaledVector(sp.vel, delta);
      sp.vel.y -= delta * 1.5;
      sp.mesh.position.copy(sp.pos);
      const life = 1 - sp.life / sp.maxLife;
      (sp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, life);
      if (sp.life >= sp.maxLife) {
        sp.mesh.parent?.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        (sp.mesh.material as THREE.Material).dispose();
        activeSparks.current.splice(i, 1);
      }
    }
  });

  return (
    <group ref={stageRoot}>
      <group ref={spellGroup}>
        <SpellRenderer spells={activeSpells} />
      </group>
      <group ref={sparkGroup} />
      {HEROES.map((d, i) => (
        <LandingActor
          key={`h-${d.id}`}
          def={d}
          slot={HERO_SLOTS[i]}
          gltf={gltfById[d.modelId]}
          combatant={heroes[i]}
          idleClip={getClip(ANIM.idle)}
        />
      ))}
      {VILLAINS.map((d, i) => (
        <LandingActor
          key={`v-${d.id}`}
          def={d as any}
          slot={VILLAIN_SLOTS[i]}
          gltf={gltfById[d.modelId as keyof typeof MODEL_PATHS]}
          combatant={villains[i]}
          idleClip={getClip(ANIM.idle)}
        />
      ))}
    </group>
  );
}

// ----------------------------------------------------------------
// One combatant — clones the GLB scene, sets up mixer, runs idle
// ----------------------------------------------------------------
function LandingActor({
  def,
  slot,
  gltf,
  combatant,
  idleClip,
}: {
  def: { id: string; modelId: keyof typeof MODEL_PATHS; accent: string; isBoss?: boolean };
  slot: [number, number];
  gltf: any;
  combatant: Combatant;
  idleClip?: THREE.AnimationClip;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lungeRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!gltf || !groupRef.current || !lungeRef.current) return;
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    c.traverse((ch: any) => {
      if (ch instanceof THREE.Mesh) {
        const n = ch.name.toLowerCase();
        // Hide only secondary gear (offhand, mug, spellbook). Keep the
        // primary weapon visible so it can be animated during attacks.
        if (["offhand","mug","spellbook","crossbow"].some(k => n.includes(k))) {
          ch.visible = false;
        } else {
          ch.castShadow = true;
          ch.receiveShadow = true;
        }
      }
    });
    // Faction tint: add a slight emissive based on accent. Also
    // build a flat cache of the materials so the hp-tint flash in
    // useFrame doesn't have to traverse the skeleton every frame.
    const tintMats: THREE.MeshStandardMaterial[] = [];
    c.traverse((ch: any) => {
      if (ch instanceof THREE.Mesh) {
        const m = ch.material as THREE.MeshStandardMaterial;
        if (m && m.color && def.accent) {
          m.emissive = new THREE.Color(def.accent);
          m.emissiveIntensity = 0.18;
          tintMats.push(m);
        }
      }
    });
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = TARGET_HEIGHT / size.y;
    c.scale.setScalar(s);
    c.position.set(-box.getCenter(new THREE.Vector3()).x * s, -box.min.y * s, -box.getCenter(new THREE.Vector3()).z * s);
    lungeRef.current.add(c);
    // Mixer
    const mixer = new THREE.AnimationMixer(c);
    combatant.body = c as unknown as THREE.Group;
    combatant.lunge = lungeRef.current;
    combatant.mixer = mixer;
    combatant.slot = slot;
    combatant.tintMats = tintMats;
    // Attach a stand-alone weapon so the swing animation has something
    // visible to rotate. The shared module also tracks a manual lean
    // override so the GLB idle animation can't push the body into a
    // weird pose.
    combatant.swing = attachSwingWeapon(c, combatant.weaponKind, { orbColor: combatant.orbColor });
    // Start idle anim
    if (idleClip) {
      const action = mixer.clipAction(idleClip, c);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.fadeIn(0.3).play();
    }
    // Boss crown — a glowing golden ring + cone. Emissive intensity
    // is high so the crown stays bright in the dim courtyard, instead
    // of reading as a black silhouette.
    if (def.isBoss) {
      const crownGroup = new THREE.Group();
      // A small spiked ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.04, 6, 16),
        new THREE.MeshStandardMaterial({
          color: "#ffcc44",
          emissive: "#ffaa22",
          emissiveIntensity: 1.6,
          metalness: 0.8,
          roughness: 0.2,
        }),
      );
      ring.position.set(0, TARGET_HEIGHT + 0.05, 0);
      ring.rotation.x = Math.PI / 2;
      crownGroup.add(ring);
      // Three small spikes on top
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.04, 0.16, 4),
          new THREE.MeshStandardMaterial({
            color: "#ffcc44",
            emissive: "#ffaa22",
            emissiveIntensity: 1.4,
            metalness: 0.9,
            roughness: 0.2,
          }),
        );
        spike.position.set(
          Math.cos(ang) * 0.18,
          TARGET_HEIGHT + 0.12,
          Math.sin(ang) * 0.18,
        );
        crownGroup.add(spike);
      }
      // Inner glow — emissive sphere so the crown reads from far away
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 12),
        new THREE.MeshBasicMaterial({
          color: "#ffcc44",
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        }),
      );
      glow.position.set(0, TARGET_HEIGHT + 0.05, 0);
      crownGroup.add(glow);
      lungeRef.current.add(crownGroup);
    }
    // Boost the model's emissive so the polished character reads
    // clearly even in the dim courtyard. Cheap fresnel-rim stand-in.
    if (c) applyRimLight(c, new THREE.Color(def.accent));
    return () => {
      mixer.stopAllAction();
      c.parent?.remove(c);
    };
  }, [gltf, def.accent, def.isBoss, combatant, slot, idleClip]);
  return (
    <group ref={groupRef} position={[slot[0], 0, slot[1]]}>
      <group ref={lungeRef}>
        <PolishGroup spec={polishFor(def.id)} />
      </group>
    </group>
  );
}

// ----------------------------------------------------------------
// Spell (projectile) renderer — small glowing sphere with point light
// ----------------------------------------------------------------
function SpellRenderer({ spells }: { spells: React.MutableRefObject<Spell[]> }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<Map<Spell, THREE.Mesh>>(new Map());
  useFrame(() => {
    if (!groupRef.current) return;
    // Add new meshes
    for (const s of spells.current) {
      if (!meshesRef.current.has(s)) {
        const geo = new THREE.SphereGeometry(0.15, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        groupRef.current.add(mesh);
        const light = new THREE.PointLight(s.color, 2.0, 4, 1.5);
        mesh.add(light);
        meshesRef.current.set(s, mesh);
      }
    }
    // Sync positions
    for (const [s, mesh] of meshesRef.current) {
      mesh.position.copy(s.pos);
    }
    // Remove finished
    for (const [s, mesh] of [...meshesRef.current.entries()]) {
      if (!spells.current.includes(s)) {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        meshesRef.current.delete(s);
      }
    }
  });
  return <group ref={groupRef} />;
}

// ----------------------------------------------------------------
// Utils
// ----------------------------------------------------------------
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------
// Module-scope scratch + shared resources. Allocating THREE.Vector3 /
// new THREE.SphereGeometry inside a hot loop creates a lot of GC
// pressure on the landing page where 8 fighters attack every
// 0.5s. We share a single small spark geometry and a few scratch
// vectors, and drive the shock-ring expansion from a tiny registry
// updated in useFrame.
// ----------------------------------------------------------------
const SHARED_SPARK_GEO = new THREE.SphereGeometry(0.05, 6, 6);
const SHARED_RING_GEO = new THREE.RingGeometry(0.1, 0.4, 24);
const _sparkDir = new THREE.Vector3();
const _sparkVel = new THREE.Vector3();
const _sparkTmp = new THREE.Vector3();
const _HEAL_COLOR = new THREE.Color("#3aff90");

interface ActiveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t0: number;
  duration: number;
}
const ACTIVE_RINGS: ActiveRing[] = [];

function makeShockRing(pos: THREE.Vector3, color: THREE.Color): THREE.Mesh {
  // Each ring needs its own material because the colour is per
  // impact and the opacity animates per-ring. The geometry is
  // shared (SHARED_RING_GEO).
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(SHARED_RING_GEO, mat);
  ring.position.copy(pos);
  ring.rotation.x = -Math.PI / 2;
  ACTIVE_RINGS.push({ mesh: ring, mat, t0: performance.now() / 1000, duration: 0.5 });
  return ring;
}

function tickShockRings() {
  const now = performance.now() / 1000;
  for (let i = ACTIVE_RINGS.length - 1; i >= 0; i--) {
    const r = ACTIVE_RINGS[i];
    const k = Math.min(1, (now - r.t0) / r.duration);
    r.mesh.scale.setScalar(1 + k * 4);
    r.mat.opacity = 0.9 * (1 - k);
    if (k >= 1) {
      r.mesh.parent?.remove(r.mesh);
      r.mat.dispose();
      ACTIVE_RINGS.splice(i, 1);
    }
  }
}
