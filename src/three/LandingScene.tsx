import { useRef, useEffect, useMemo, useState, Suspense } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ObjectMap } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three-stdlib";

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
  Knight: "/models/characters/Knight.glb",
  Barbarian: "/models/characters/Barbarian.glb",
  Mage: "/models/characters/Mage.glb",
  Ranger: "/models/characters/Ranger.glb",
  Rogue: "/models/characters/Rogue.glb",
  Rogue_Hooded: "/models/characters/Rogue_Hooded.glb",
  Witch: "/models/characters/Witch.glb",
};
const ANIM_PATHS = {
  general: "/models/animations/Rig_Medium_General.glb",
  movement: "/models/animations/Rig_Medium_MovementBasic.glb",
  melee: "/models/animations/Rig_Medium_CombatMelee.glb",
  ranged: "/models/animations/Rig_Medium_CombatRanged.glb",
};
for (const p of Object.values(MODEL_PATHS)) useGLTF.preload(p);
for (const p of Object.values(ANIM_PATHS)) useGLTF.preload(p);

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
// Heroes in a line at x = -3.4, villains mirror at x = +3.4. Both sides
// face each other across the gap. Z varies front-to-back so the camera
// can see everyone even at a single moment.
const HERO_LINE_X = -3.4;
const VILLAIN_LINE_X = 3.4;
const RANK_Z = [-1.8, -0.6, 0.6, 1.8];
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
  mixer: THREE.AnimationMixer | null;
  targetRotY: number;
  curRotY: number;
  bobAmp: number;
  hpTint: number;       // 0..1 redness flash
  hpTintDecay: number;
}

interface Spell {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t: number;
  duration: number;
  color: THREE.Color;
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

const HEROES: Array<{ id: string; modelId: keyof typeof MODEL_PATHS; accent: string }> = [
  { id: "kael", modelId: "Knight", accent: "#3a6ad8" },
  { id: "borin", modelId: "Knight", accent: "#5a78a0" },
  { id: "lyra", modelId: "Mage", accent: "#d8c060" },
  { id: "serra", modelId: "Ranger", accent: "#3aa050" },
];
const VILLAINS: Array<{ id: string; modelId: keyof typeof MODEL_PATHS; accent: string; isBoss?: boolean }> = [
  { id: "garrick", modelId: "Barbarian", accent: "#a02828", isBoss: true },
  { id: "bandit_a", modelId: "Rogue", accent: "#7a4828" },
  { id: "umbral", modelId: "Witch", accent: "#5828a0" },
  { id: "bandit_b", modelId: "Rogue_Hooded", accent: "#643c20" },
];

// ---- Round-based sync battle --------------------------------------
// Both sides are lined up. Every `ROUND_DURATION` seconds a new round
// fires and EVERY character on the field attacks simultaneously. To
// keep it from being boring, half the attackers use a melee lunge and
// the other half use a cast/arrow, and the target pairings rotate each
// round so the same characters aren't always trading blows.
type Event =
  | { kind: "melee"; side: Side; attacker: number; target: number }
  | { kind: "cast"; side: Side; attacker: number; target: number; color: string }
  | { kind: "ranged"; side: Side; attacker: number; target: number }
  | { kind: "heal"; attacker: number; target: number };

const ROUND_DURATION = 1.05;
const ROUND_COUNT = 4; // 4 attackers per side fire per round
const NUM_ROUNDS = 12; // total rounds before the cycle restarts

// One pre-computed round: which attackers fire, what kind of attack,
// and which target they aim at. Heroes ALWAYS target a villain and
// villains ALWAYS target a hero — never their own side. Target offset
// rotates per round so the pairings change (Kael vs Garrick, then Kael
// vs Umbral, then Kael vs Bandit…).
function buildRounds(): Event[][] {
  const rng = mulberry32(0xB12D);
  const rounds: Event[][] = [];
  for (let r = 0; r < NUM_ROUNDS; r++) {
    const evts: Event[] = [];
    const mode = r % 4;
    // Pairings: hero[i] fights villain[(i + offset) % 4].
    // Offset rotates so each round the matchups are different.
    const offset = r % 4;
    for (let i = 0; i < ROUND_COUNT; i++) {
      const heroKind = pickKind("hero", i, mode, rng);
      const villainKind = pickKind("villain", i, mode, rng);
      // GUARANTEE cross-side: hero attacks villain, villain attacks hero
      const hTarget = (i + offset) % VILLAINS.length;
      const vTarget = (i + offset) % HEROES.length;
      if (heroKind === "heal") {
        const t = (i + 1) % HEROES.length;
        evts.push({ kind: "heal", attacker: i, target: t } as Event);
      } else if (heroKind === "cast") {
        evts.push({ kind: "cast", side: "hero", attacker: i, target: hTarget, color: heroColor("cast", i) } as Event);
      } else if (heroKind === "ranged") {
        evts.push({ kind: "ranged", side: "hero", attacker: i, target: hTarget } as Event);
      } else if (heroKind === "melee") {
        evts.push({ kind: "melee", side: "hero", attacker: i, target: hTarget } as Event);
      }
      if (villainKind === "cast") {
        evts.push({ kind: "cast", side: "villain", attacker: i, target: vTarget, color: villainColor("cast", i) } as Event);
      } else if (villainKind === "ranged") {
        evts.push({ kind: "ranged", side: "villain", attacker: i, target: vTarget } as Event);
      } else if (villainKind === "melee") {
        evts.push({ kind: "melee", side: "villain", attacker: i, target: vTarget } as Event);
      }
    }
    rounds.push(evts);
  }
  return rounds;
}
function pickKind(side: "hero" | "villain", i: number, mode: number, rng: () => number): "melee" | "cast" | "ranged" | "heal" | null {
  if (side === "hero" && i === 2) {
    // Lyra (healer) sometimes heals
    if (mode === 0 || mode === 2) return "melee";
    if (rng() < 0.4) return "heal";
  }
  if (side === "hero" && i === 3) {
    // Serra (archer) often shoots
    if (mode === 1) return "melee";
    return rng() < 0.7 ? "ranged" : "cast";
  }
  if (side === "villain" && i === 2) {
    // Umbral mage almost always casts
    return "cast";
  }
  if (mode === 0) return "melee";
  if (mode === 1) return side === "hero" ? "melee" : "cast";
  if (mode === 2) return side === "hero" ? "cast" : "melee";
  // mode 3 — mixed
  if (i % 2 === 0) return "melee";
  return side === "hero" ? "ranged" : "cast";
}
function heroColor(kind: string, i: number): string {
  if (kind === "cast") return i === 2 ? "#7adfff" : "#aeefff";
  return "#ffe070";
}
function villainColor(kind: string, i: number): string {
  if (kind === "cast") return "#ff5530";
  if (i === 0) return "#ff2244"; // Garrick's heavy hits
  return "#ff7a3a";
}
const ROUNDS: Event[][] = buildRounds();

export function LandingScene() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Canvas
        shadows
        camera={{ position: [1, 5.5, 11], fov: 42, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }: { gl: THREE.WebGLRenderer }) => gl.setClearColor("#0a0e16")}
      >
        <LandingLighting />
        <fog attach="fog" args={["#0a0e16", 22, 75]} />
        <StarField />
        <FloatingEmbers />
        <BattleStage />
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
      <ambientLight intensity={0.85} color="#d0dceb" />
      <directionalLight
        position={[6, 14, -4]}
        intensity={1.4}
        color="#ffe8c0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, 6, 8]} intensity={0.55} color="#6080a0" />
      <hemisphereLight args={["#a0b8d8", "#3a2818", 0.4]} />
      <pointLight position={[0, 3, 0]} intensity={1.4} color="#c08aff" distance={12} decay={1.6} />
    </>
  );
}

// ----------------------------------------------------------------
// Camera
// ----------------------------------------------------------------
// Camera — full 360° orbit so every character gets screen time
// ----------------------------------------------------------------
function OrbitCamera() {
  const { camera } = useThree();
  const t = useRef(0);
  useEffect(() => {
    camera.position.set(0, 5.5, 12);
    camera.lookAt(0, 0.8, 0);
  }, [camera]);
  useFrame((_, delta) => {
    t.current += delta;
    // Continuous orbit, plus a small bob and a tilt
    const baseAngle = t.current * 0.28;
    const r = 12;
    const sway = Math.sin(t.current * 0.4) * 0.5;
    const height = 5.5 + Math.sin(t.current * 0.22) * 0.6;
    const x = Math.sin(baseAngle) * r;
    const z = Math.cos(baseAngle) * r;
    camera.position.set(x, height + sway, z);
    camera.lookAt(0, 0.7, 0);
  });
  return null;
}

// ----------------------------------------------------------------
// Battle stage (platform + glowing rune ring)
// ----------------------------------------------------------------
function BattleStage() {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (ringRef.current) ringRef.current.rotation.y += 0.4 * state.clock.getDelta() / 2;
    if (ringMat.current) {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 1.6) * 0.35;
      ringMat.current.opacity = 0.35 * pulse;
    }
  });
  const R = 5.6;
  return (
    <group position={[0, 0, 0]}>
      {/* Stone disc — top at y=0 */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[R, R + 0.2, 0.36, 56]} />
        <meshStandardMaterial color="#4a4858" roughness={0.65} metalness={0.2} />
      </mesh>
      {/* Golden trim ring at top edge */}
      <mesh position={[0, 0.0, 0]}>
        <torusGeometry args={[R, 0.07, 8, 80]} />
        <meshStandardMaterial color="#d4a850" emissive="#a07020" emissiveIntensity={0.8} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Top inlay */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[R - 0.2, R - 0.2, 0.04, 56]} />
        <meshStandardMaterial color="#3a3848" roughness={0.5} metalness={0.25} />
      </mesh>
      {/* Animated rune ring */}
      <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[R - 0.6, R - 0.3, 80]} />
        <meshBasicMaterial ref={ringMat} color="#5aa8ff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------
// Star field (a dome of twinkling billboarded points)
// ----------------------------------------------------------------
function StarField() {
  const ref = useRef<THREE.Points>(null);
  const { positions, baseColors, phases, count } = useMemo(() => {
    const N = 320;
    const positions = new Float32Array(N * 3);
    const baseColors = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    const rng = mulberry32(0xA57E2D);
    for (let i = 0; i < N; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - 2 * rng());
      const r = 60 * (0.6 + rng() * 0.4);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.55 + 6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const hue = rng();
      let r2 = 0.95, g2 = 0.95, b2 = 1.0;
      if (hue < 0.15) { r2 = 1.0; g2 = 0.85; b2 = 0.65; }
      else if (hue < 0.35) { r2 = 0.7; g2 = 0.85; b2 = 1.0; }
      const brightness = 0.4 + rng() * 0.6;
      baseColors[i * 3 + 0] = r2 * brightness;
      baseColors[i * 3 + 1] = g2 * brightness;
      baseColors[i * 3 + 2] = b2 * brightness;
      phases[i] = rng() * Math.PI * 2;
    }
    return { positions, baseColors, phases, count: N };
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.attributes.color as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const tw = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 + phases[i]));
      attr.setXYZ(i, baseColors[i * 3] * tw, baseColors[i * 3 + 1] * tw, baseColors[i * 3 + 2] * tw);
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[baseColors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.55} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ----------------------------------------------------------------
// Floating embers (glowing motes drifting upward)
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

  // Build combatant entries
  const [heroes] = useState<Combatant[]>(() =>
    HEROES.map((d, i) => ({
      id: d.id,
      modelId: d.modelId,
      slot: HERO_SLOTS[i],
      phase: i * 0.7,
      baseY: 0,
      body: null,
      lunge: null,
      mixer: null,
      targetRotY: -Math.PI / 2,
      curRotY: -Math.PI / 2,
      bobAmp: 0.025,
      hpTint: 0,
      hpTintDecay: 0,
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
      mixer: null,
      targetRotY: Math.PI / 2,
      curRotY: Math.PI / 2,
      bobAmp: 0.025,
      hpTint: 0,
      hpTintDecay: 0,
    })),
  );

  // For spawning spells / sparks
  const sceneRef = useRef<THREE.Group | null>(null);
  const activeSpells = useRef<Spell[]>([]);
  const activeSparks = useRef<Spark[]>([]);
  const cycleStart = useRef(0);
  const pausedUntil = useRef(0);
  const lastFiredRound = useRef(-1);

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
    switch (evt.kind) {
      case "melee": {
        const arr = evt.side === "hero" ? heroesRef.current : villainsRef.current;
        const a = arr[evt.attacker];
        const b = arr[evt.target];
        if (!a || !b || a === b) return;
        const ax = a.slot[0], az = a.slot[1];
        const bx = b.slot[0], bz = b.slot[1];
        const dx = bx - ax, dz = bz - az;
        const len = Math.max(0.001, Math.hypot(dx, dz));
        const ux = dx / len, uz = dz / len;
        // Lunge at most 35% of the way to the target — stops well short
        // of the opposite line, no chance of crossing over.
        const reach = Math.min(1.8, len * 0.35);
        const hitX = ax + ux * reach, hitZ = az + uz * reach;
        a.targetRotY = Math.atan2(ux, uz);
        animateMelee(a, hitX, hitZ);
        // Quick impact: hit-react + spark at target
        setTimeout(() => {
          if (!b.lunge || !b.lunge.parent) return;
          b.hpTint = 1;
          spawnSparksAt(b, new THREE.Color(1, 0.85, 0.4));
          playAnim(b, ANIM.hitA, false, 0.05);
          setTimeout(() => setIdle(b), 220);
        }, 110);
        setTimeout(() => setIdle(a), 320);
        break;
      }
      case "cast": {
        const arr = evt.side === "hero" ? heroesRef.current : villainsRef.current;
        const a = arr[evt.attacker];
        const b = arr[evt.target];
        if (!a || !b) return;
        const start = worldPos(a).clone().add(new THREE.Vector3(0, 1.2, 0));
        const end = worldPos(b).clone().add(new THREE.Vector3(0, 1.0, 0));
        const color = new THREE.Color(evt.color);
        activeSpells.current.push({
          pos: start.clone(), vel: new THREE.Vector3(), start, end,
          t: 0, duration: 0.35, color,
          onHit: () => {
            b.hpTint = 1;
            spawnSparksAt(b, color);
            playAnim(b, ANIM.hitA, false, 0.05);
            setTimeout(() => setIdle(b), 220);
          },
        });
        a.targetRotY = Math.atan2(end.x - a.slot[0], end.z - a.slot[1]);
        playAnim(a, ANIM.magicShoot, false, 0.08);
        setTimeout(() => setIdle(a), 320);
        break;
      }
      case "ranged": {
        const arr = evt.side === "hero" ? heroesRef.current : villainsRef.current;
        const a = arr[evt.attacker];
        const b = arr[evt.target];
        if (!a || !b) return;
        const start = worldPos(a).clone().add(new THREE.Vector3(0, 1.0, 0));
        const end = worldPos(b).clone().add(new THREE.Vector3(0, 0.8, 0));
        a.targetRotY = Math.atan2(end.x - a.slot[0], end.z - a.slot[1]);
        playAnim(a, ANIM.bowShoot, false, 0.08);
        setTimeout(() => {
          activeSpells.current.push({
            pos: start.clone(), vel: new THREE.Vector3(), start, end,
            t: 0, duration: 0.25, color: new THREE.Color("#a0ff80"),
            onHit: () => {
              b.hpTint = 1;
              spawnSparksAt(b, new THREE.Color("#a0ff80"));
              playAnim(b, ANIM.hitA, false, 0.05);
              setTimeout(() => setIdle(b), 220);
            },
          });
        }, 110);
        setTimeout(() => setIdle(a), 320);
        break;
      }
      case "heal": {
        const a = heroesRef.current[evt.attacker];
        const b = heroesRef.current[evt.target];
        if (!a || !b || a === b) return;
        playAnim(a, ANIM.magicShoot, false, 0.08);
        const end = worldPos(b).clone().add(new THREE.Vector3(0, 0.9, 0));
        a.targetRotY = Math.atan2(b.slot[0] - a.slot[0], b.slot[1] - a.slot[1]);
        setTimeout(() => {
          for (let i = 0; i < 7; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 0.3 + Math.random() * 0.3;
            const p0 = new THREE.Vector3(end.x + Math.cos(angle) * r, end.y, end.z + Math.sin(angle) * r);
            const v = new THREE.Vector3(Math.cos(angle) * 0.4, 1.2 + Math.random() * 0.4, Math.sin(angle) * 0.4);
            spawnSpark(p0, v, new THREE.Color("#3aff90"), 0.7);
          }
        }, 150);
        setTimeout(() => setIdle(a), 320);
        break;
      }
    }
  }

  function animateMelee(c: Combatant, hitX: number, hitZ: number) {
    if (!c.body || !c.lunge) return;
    // Fast lunge: 0..0.18s step forward to hit, 0.18..0.32s bounce back
    const dur = 0.32;
    const sx = c.slot[0], sz = c.slot[1];
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const k = Math.min(1, t / dur);
      let x: number, z: number;
      if (k < 0.55) {
        const u = k / 0.55;
        const e = 1 - Math.pow(1 - u, 3); // ease-out cubic
        x = sx + (hitX - sx) * e;
        z = sz + (hitZ - sz) * e;
      } else {
        const u = (k - 0.55) / 0.45;
        const e = 1 - Math.pow(1 - u, 2);
        x = hitX + (sx - hitX) * e;
        z = hitZ + (sz - hitZ) * e;
      }
      if (c.lunge) {
        c.lunge.position.x = x - sx;
        c.lunge.position.z = z - sz;
      }
      if (k < 1) requestAnimationFrame(tick);
      else if (c.lunge) {
        c.lunge.position.x = 0;
        c.lunge.position.z = 0;
      }
    };
    tick();
  }

  function worldPos(c: Combatant) {
    return new THREE.Vector3(c.slot[0], 0, c.slot[1]);
  }

  function spawnSparksAt(c: Combatant, color: THREE.Color) {
    const base = worldPos(c).add(new THREE.Vector3(0, 1.0, 0));
    for (let i = 0; i < 6; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
      const v = dir.multiplyScalar(1.4 + Math.random() * 0.6);
      spawnSpark(base.clone(), v, color, 0.5);
    }
  }

  function spawnSparks(pos: THREE.Vector3, color: THREE.Color) {
    for (let i = 0; i < 10; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
      const v = dir.multiplyScalar(1.5 + Math.random() * 1.0);
      spawnSpark(pos.clone(), v, color, 0.55);
    }
    if (sparkGroup.current) {
      const ringGeo = new THREE.RingGeometry(0.1, 0.4, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.rotation.x = -Math.PI / 2;
      sparkGroup.current.add(ring);
      const t0 = performance.now();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        const k = Math.min(1, t / 0.5);
        ring.scale.setScalar(1 + k * 4);
        ringMat.opacity = 0.9 * (1 - k);
        if (k < 1) requestAnimationFrame(tick);
        else { ring.parent?.remove(ring); ringGeo.dispose(); ringMat.dispose(); }
      };
      tick();
    }
  }

  function spawnSpark(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color, life: number) {
    if (!sparkGroup.current) return;
    const geo = new THREE.SphereGeometry(0.05, 6, 6);
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
        // The model itself is the body (gets bob & rotation). The lunge
        // group is its parent — we use that for the attack lunge offset
        // so the bob doesn't fight the lunge.
        c.body.position.y = Math.sin(t * 1.4 + c.phase) * c.bobAmp;
        let diff = c.targetRotY - c.curRotY;
        diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        c.curRotY += diff * Math.min(1, delta * 8);
        c.body.rotation.y = c.curRotY;
        if (c.mixer) c.mixer.update(delta);
        if (c.hpTint > 0) {
          c.hpTint = Math.max(0, c.hpTint - delta * 2.2);
          c.body.traverse((ch) => {
            const m = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (m && m.emissive) m.emissiveIntensity = 0.4 * c.hpTint;
          });
        }
      }
    }

    if (t < pausedUntil.current) return;
    const localT = t - cycleStart.current;
    const currentRound = Math.floor(localT / ROUND_DURATION);
    const withinRound = localT - currentRound * ROUND_DURATION;
    // Fire all events for the current round as soon as the round starts
    // (within the first 80ms) so every character animates at the same time
    if (currentRound < ROUNDS.length && currentRound !== lastFiredRound.current) {
      lastFiredRound.current = currentRound;
      const round = ROUNDS[currentRound];
      for (const evt of round) dispatchRef.current(evt);
    }
    // Once we've played all rounds, the cycle restarts on its own
    if (currentRound >= ROUNDS.length) {
      cycleStart.current = t;
      pausedUntil.current = t;
      lastFiredRound.current = -1;
    }

    for (let i = activeSpells.current.length - 1; i >= 0; i--) {
      const s = activeSpells.current[i];
      s.t += delta;
      const p = Math.min(1, s.t / s.duration);
      const mid = new THREE.Vector3().addVectors(s.start, s.end).multiplyScalar(0.5);
      mid.y += 1.4;
      const u = 1 - p;
      s.pos.copy(s.start).multiplyScalar(u * u)
        .add(mid.clone().multiplyScalar(2 * u * p))
        .add(s.end.clone().multiplyScalar(p * p));
      if (p >= 1) {
        spawnSparks(s.end, s.color);
        s.onHit?.();
        activeSpells.current.splice(i, 1);
      }
    }

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
    <group ref={sceneRef}>
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
        if (["shield","sword","offhand","bow","staff","wand","dagger","axe","mug","spellbook","crossbow"].some(k => n.includes(k))) ch.visible = false;
        else { ch.castShadow = true; ch.receiveShadow = true; }
      }
    });
    // Faction tint: add a slight emissive based on accent
    c.traverse((ch: any) => {
      if (ch instanceof THREE.Mesh) {
        const m = ch.material as THREE.MeshStandardMaterial;
        if (m && m.color && def.accent) {
          m.emissive = new THREE.Color(def.accent);
          m.emissiveIntensity = 0.18;
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
    // Start idle anim
    if (idleClip) {
      const action = mixer.clipAction(idleClip, c);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.fadeIn(0.3).play();
    }
    // Boss crown
    if (def.isBoss) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.28, 6),
        new THREE.MeshStandardMaterial({ color: "gold", metalness: 0.95, roughness: 0.15, emissive: "gold", emissiveIntensity: 0.5 }),
      );
      crown.position.set(0, TARGET_HEIGHT + 0.25, 0);
      crown.castShadow = true;
      lungeRef.current.add(crown);
    }
    return () => {
      mixer.stopAllAction();
      c.parent?.remove(c);
    };
  }, [gltf, def.accent, def.isBoss, combatant, slot, idleClip]);
  return (
    <group ref={groupRef} position={[slot[0], 0, slot[1]]}>
      <group ref={lungeRef} />
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
