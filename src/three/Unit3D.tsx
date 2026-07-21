import { useRef, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { RuntimeUnit, WeaponType } from "../types";
import { useGame } from "../game/store";
import { attachSwingWeapon, applyManualLean, animateMelee as swingMelee, type SwingState, type WeaponKind } from "./shared/SwingWeapon";

/** Map the data-side WeaponType to the rendering-side WeaponKind. */
function weaponKindOf(wt: WeaponType | undefined): WeaponKind {
  switch (wt) {
    case "lance": return "lance";
    case "axe":   return "axe";
    case "bow":   return "bow";
    case "staff": return "staff";
    case "fire":  return "fire";
    case "light": return "staff";
    case "dark":  return "fire";
    case "sword":
    default:      return "sword";
  }
}
function orbColorFor(wt: WeaponType | undefined): number {
  switch (wt) {
    case "fire":  return 0xff5530;
    case "light": return 0xfff5b0;
    case "dark":  return 0x8030c0;
    case "staff": return 0xfff0a0;
    default:      return 0xfff0a0;
  }
}

const B = import.meta.env.BASE_URL;
export const MODEL_PATHS: Record<string, string> = {
  Paladin: B + "models/characters/Paladin.glb",
  Paladin_with_Helmet: B + "models/characters/Paladin_with_Helmet.glb",
  BlackKnight: B + "models/characters/BlackKnight.glb",
  Witch: B + "models/characters/Witch.glb",
  MagicalGirl: B + "models/characters/MagicalGirl.glb",
  Druid: B + "models/characters/Druid.glb",
  Ranger: B + "models/characters/Ranger.glb",
  Cleric: B + "models/characters/Cleric.glb",
  Lorekeeper: B + "models/characters/Lorekeeper.glb",
  Marksman: B + "models/characters/Marksman.glb",
  Knight: B + "models/characters/Knight.glb",
  Mage: B + "models/characters/Mage.glb",
  Rogue: B + "models/characters/Rogue.glb",
  Rogue_Hooded: B + "models/characters/Rogue_Hooded.glb",
  Barbarian: B + "models/characters/Barbarian.glb",
  Protagonist_A: B + "models/characters/Protagonist_A.glb",
  Protagonist_B: B + "models/characters/Protagonist_B.glb",
  AvianSwordsman: B + "models/characters/AvianSwordsman.glb",
  Vampire: B + "models/characters/Vampire.glb",
  Tiefling: B + "models/characters/Tiefling.glb",
  OrcBrute: B + "models/characters/OrcBrute.glb",
  FrostGolem: B + "models/characters/FrostGolem.glb",
  Monstrosity: B + "models/characters/Monstrosity.glb",
  CombatMech: B + "models/characters/CombatMech.glb",
  Werewolf_Man: B + "models/characters/Werewolf_Man.glb",
  Werewolf_Wolf: B + "models/characters/Werewolf_Wolf.glb",
  PlantWarrior: B + "models/characters/PlantWarrior.glb",
  ToySoldier: B + "models/characters/ToySoldier.glb",
  Skeleton_Warrior: B + "models/characters/Skeleton_Warrior.glb",
  Skeleton_Mage: B + "models/characters/Skeleton_Mage.glb",
  Skeleton_Rogue: B + "models/characters/Skeleton_Rogue.glb",
  Skeleton_Minion: B + "models/characters/Skeleton_Minion.glb",
};
export const ANIM_PATHS: Record<string, string> = {
  general: B + "models/animations/Rig_Medium_General.glb",
  movement: B + "models/animations/Rig_Medium_MovementBasic.glb",
  melee: B + "models/animations/Rig_Medium_CombatMelee.glb",
  ranged: B + "models/animations/Rig_Medium_CombatRanged.glb",
};
for (const p of Object.values(MODEL_PATHS)) useGLTF.preload(p);
for (const p of Object.values(ANIM_PATHS)) useGLTF.preload(p);

const FACTION_COLOR: Record<string, string> = { player: "#3a6ad8", enemy: "#d83a3a", ally: "#3ad83a", neutral: "#d8d83a" };
const TARGET_HEIGHT = 1.6;
const ANIM = { idle: "Idle_A", idleB: "Idle_B", walk: "Walking_A", attackSlash: "Melee_1H_Attack_Slice_Diagonal", attackChop: "Melee_1H_Attack_Chop", magicShoot: "Ranged_Magic_Shoot", bowShoot: "Ranged_Bow_Release", hitA: "Hit_A", hitB: "Hit_B", deathA: "Death_A" };

export function Unit3D({ unit }: { unit: RuntimeUnit }) {
  return <Suspense fallback={<Placeholder unit={unit} />}><UnitModel unit={unit} /></Suspense>;
}

function Placeholder({ unit }: { unit: RuntimeUnit }) {
  const c = FACTION_COLOR[unit.faction];
  return <group position={[unit.pos.x, 0, unit.pos.y]}><mesh position={[0, 0.65, 0]}><capsuleGeometry args={[0.22, 0.5, 4, 12]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.2} /></mesh></group>;
}

function UnitModel({ unit }: { unit: RuntimeUnit }) {
  const groupRef = useRef<THREE.Group>(null);
  const lungeGroupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const [hovered, setHovered] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const moveFrom = useRef<{x:number;z:number}|null>(null);
  const moveTo = useRef<{x:number;z:number}|null>(null);
  const moveStartTime = useRef(0);
  const lastPos = useRef({ x: unit.pos.x, y: unit.pos.y });
  const targetRotY = useRef(0);
  const curRotY = useRef(0);
  const prevHp = useRef(unit.hp);
  const deathStyle = useRef<"melee" | "magic" | "pierce">("melee");
  const deathAge = useRef(0);
  // Shared swing state (weapon mesh + manual lean override). The
  // attack animation (attackSlash) sets leanX/leanZ; the useFrame
  // here applies them after the mixer so the GLB idle animation
  // can't push the body into a weird pose.
  const swing = useRef<SwingState | null>(null);
  const prevActed = useRef(unit.hasActed);
  const [dead, setDead] = useState(false);
  const [cloneObj, setCloneObj] = useState<THREE.Object3D | null>(null);
  // LOD: at long camera distance the GLB is swapped for a single
  // billboarded sprite so we don't keep animating dozens of skeletons
  // when the player is zoomed out.
  const billboardRef = useRef<THREE.Mesh>(null);
  const isFarLod = useRef(false);

  const selectUnit = useGame(s => s.selectUnit);
  const onTileClick = useGame(s => s.onTileClick);
  const phase = useGame(s => s.phase);
  const selectedUnitId = useGame(s => s.selectedUnit?.uid);
  const showCombatPreview = useGame(s => s.showCombatPreview);
  const selectionMode = useGame(s => s.selectionMode);
  const hoverUnit = useGame(s => s.hoverUnit);
  const attackRange = useGame(s => s.attackRange);
  const activeCombat = useGame(s => s.activeCombat);
  const combatPhase = useGame(s => s.combatPhase);

  const gltf = useGLTF(MODEL_PATHS[unit.modelId] || MODEL_PATHS.Knight);
  const animGeneral = useGLTF(ANIM_PATHS.general);
  const animMovement = useGLTF(ANIM_PATHS.movement);
  const animMelee = useGLTF(ANIM_PATHS.melee);
  const animRanged = useGLTF(ANIM_PATHS.ranged);

  const clips = { ...Object.fromEntries([...animGeneral.animations, ...animMovement.animations, ...animMelee.animations, ...animRanged.animations].map(c => [c.name, c])) };

  useEffect(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    c.traverse((ch: any) => { if (ch instanceof THREE.Mesh) { const n = ch.name.toLowerCase(); if (["shield","sword","offhand","bow","staff","wand","dagger","axe","mug","spellbook","crossbow"].some(k => n.includes(k))) ch.visible = false; else { ch.castShadow = true; ch.receiveShadow = true; } } });
    const box = new THREE.Box3(); c.traverse((ch: any) => { if (ch instanceof THREE.Mesh && ch.visible) box.expandByObject(ch); });
    const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const s = TARGET_HEIGHT / size.y;
    c.scale.setScalar(s); c.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    // Attach a stand-alone weapon so the swing animation has
    // something visible to rotate. The kind is driven by the
    // equipped weapon (or the first weapon in the class) so a
    // knight actually wields a lance, a fighter wields an axe,
    // an archer wields a bow, etc.
    const wt: WeaponType | undefined = (unit.equippedWeapon?.type) ?? (unit.weapons?.[0]?.type);
    swing.current = attachSwingWeapon(c, weaponKindOf(wt), { orbColor: orbColorFor(wt) });
    setCloneObj(c);
  }, [gltf]);

  useEffect(() => {
    if (!modelRef.current) return;
    const mixer = new THREE.AnimationMixer(modelRef.current); mixerRef.current = mixer;
    playAnim(ANIM.idle, true); return () => { mixer.stopAllAction(); mixerRef.current = null; };
  }, [cloneObj]);

  function playAnim(name: string, loop = false, fade = 0.2) {
    if (!mixerRef.current) return; const clip = (clips as any)[name]; if (!clip) return;
    const action = mixerRef.current.clipAction(clip);
    if (currentAction.current && currentAction.current !== action) currentAction.current.fadeOut(fade);
    action.reset(); action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); action.clampWhenFinished = !loop; action.fadeIn(fade).play(); currentAction.current = action;
  }

  const isSelected = selectedUnitId === unit.uid;
  const factionColor = FACTION_COLOR[unit.faction] || "#888";
  const isExhausted = unit.hasActed && unit.faction === "player";
  const inAttackRange = selectionMode === "targeting" && attackRange.includes(`${unit.pos.x},${unit.pos.y}`);
  const hpPct = unit.hp / unit.maxHp;
  const hpColor = hpPct > 0.5 ? "#3afa3a" : hpPct > 0.25 ? "#fafa3a" : "#fa3a3a";
  // Smoothed HP percentage — the actual unit.hp jumps on hit; this
  // ref tweens over ~0.3s so the bar drains like a real RPG.
  const displayedHp = useRef(hpPct);
  const hpBarMesh = useRef<THREE.Mesh>(null);
  const hpGhostMesh = useRef<THREE.Mesh>(null);
  const MOVE_DURATION = 500;

  useEffect(() => {
    if (lastPos.current.x !== unit.pos.x || lastPos.current.y !== unit.pos.y) {
      const dx = unit.pos.x - lastPos.current.x, dz = unit.pos.y - lastPos.current.y;
      if (dx || dz) targetRotY.current = Math.atan2(dx, dz);
      moveFrom.current = { x: lastPos.current.x, z: lastPos.current.y }; moveTo.current = { x: unit.pos.x, z: unit.pos.y };
      moveStartTime.current = Date.now(); playAnim(ANIM.walk, true); lastPos.current = { x: unit.pos.x, y: unit.pos.y };
    }
  }, [unit.pos.x, unit.pos.y]);

  useEffect(() => {
    if (!combatPhase || !activeCombat) { if (!moveTo.current) playAnim(ANIM.idle, true, 0.3); return; }
    const isAtk = combatPhase.attackerId === unit.uid, isDef = combatPhase.defenderId === unit.uid;
    if (!isAtk && !isDef) return;
    const other = isAtk ? activeCombat.defender : activeCombat.attacker;
    targetRotY.current = Math.atan2(other.pos.x - unit.pos.x, other.pos.y - unit.pos.y);
    const pn = combatPhase.phase;
    if (isAtk) {
      if (pn === "approach") playAnim(ANIM.idleB || ANIM.idle, true, 0.3);
      else if (pn.includes("windup") || pn.includes("strike")) {
        const kind: WeaponKind = swing.current?.kind ?? "sword";
        if (kind === "bow") playAnim(ANIM.bowShoot, false, 0.1);
        else if (kind === "staff" || kind === "fire") playAnim(ANIM.magicShoot, false, 0.1);
        else {
          // Sword / lance / axe — all physical melee. We play the
          // slash animation and run the shared swing so the stand-
          // alone weapon mesh performs a visible raise + slash + back.
          playAnim(ANIM.attackSlash, false, 0.1);
          if (modelRef.current && lungeGroupRef.current && swing.current) {
            // Run a lunge toward the defender's position (visual only;
            // the real hit is handled by the combat system).
            const len = Math.max(0.001, Math.hypot(other.pos.x - unit.pos.x, other.pos.y - unit.pos.y));
            const ux = (other.pos.x - unit.pos.x) / len, uz = (other.pos.y - unit.pos.y) / len;
            const reach = Math.min(0.8, len * 0.3);
            swingMelee({
              body: modelRef.current,
              lunge: lungeGroupRef.current,
              slot: [unit.pos.x, unit.pos.y],
              hitX: unit.pos.x + ux * reach,
              hitZ: unit.pos.y + uz * reach,
              state: swing.current,
            });
          }
        }
      }
      else if (pn.includes("recoil") || pn.includes("recovery")) playAnim(ANIM.idle, true, 0.2);
    } else {
      if (pn === "approach") playAnim(ANIM.idle, true, 0.3);
      else if (pn.includes("impact")) playAnim(ANIM.hitA, false, 0.05);
      else if (pn.includes("recoil")) playAnim(ANIM.hitB || ANIM.hitA, false, 0.1);
      else if (pn.includes("recovery")) playAnim(ANIM.idle, true, 0.2);
    }
  }, [combatPhase, activeCombat, unit.uid]);

  useEffect(() => { if (isSelected && !moveTo.current && !combatPhase) playAnim(ANIM.idleB || ANIM.idle, true, 0.2); else if (!isSelected && !moveTo.current && !combatPhase) playAnim(ANIM.idle, true, 0.3); }, [isSelected]);
  useEffect(() => { if (unit.hp < prevHp.current) { setFlashRed(true); const tm = setTimeout(() => setFlashRed(false), 120); prevHp.current = unit.hp; return () => clearTimeout(tm); } prevHp.current = unit.hp; }, [unit.hp]);
  useEffect(() => { if (unit.isDead && !dead) {
    // Death style: pierce (lance/bow) → lean back with a stuck weapon;
    // magic → float up + dissolve; else → melee tumble.
    const w = unit._lastKilledByWeapon;
    const style: "melee" | "magic" | "pierce" =
      w === "lance" || w === "bow" ? "pierce"
      : w && (w === "fire" || w === "light" || w === "dark") ? "magic"
      : "melee";
    deathStyle.current = style;
    playAnim(ANIM.deathA, false, 0.2);
    if (style === "magic") {
      const tm = setTimeout(() => setDead(true), 1400);
      return () => clearTimeout(tm);
    }
    if (style === "pierce") {
      // Pierce: model stays upright briefly, then slumps — slightly
      // longer total so the impalement reads clearly.
      const tm = setTimeout(() => setDead(true), 1800);
      return () => clearTimeout(tm);
    }
    const tm = setTimeout(() => setDead(true), 2000);
    return () => clearTimeout(tm);
  } }, [unit.isDead]);

  const onPointerEnter = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; hoverUnit(unit); if (selectionMode === "targeting") { const sel = useGame.getState().selectedUnit; if (sel && (unit.faction !== "player" || sel.equippedWeapon?.type === "staff")) showCombatPreview(sel, unit); } };
  const onPointerLeave = () => { setHovered(false); document.body.style.cursor = "default"; const cur = useGame.getState().hoveredUnit; if (cur === unit) hoverUnit(null); };
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (phase !== "player") return;
    if (selectionMode === "targeting") {
      // In targeting mode, the click only counts if the unit is a valid
      // target: enemy for normal weapons, wounded ally for staff.
      const sel = useGame.getState().selectedUnit;
      const isStaff = sel?.equippedWeapon?.type === "staff";
      if (isStaff) {
        if (unit.faction === "player" && !unit.isDead && unit !== sel) onTileClick(unit.pos);
        else if (unit.faction !== "player") onTileClick(unit.pos);
      } else {
        if (unit.faction !== "player" && !unit.isDead) onTileClick(unit.pos);
      }
      return;
    }
    if (unit.faction === "player" && !unit.hasActed) selectUnit(unit);
    else hoverUnit(unit);
  };

  useFrame((state, delta) => {
    const st = useGame.getState();
    const now = performance.now();
    let scale = st.timeScale;
    if (st.slowMoUntil && now >= st.slowMoUntil) {
      scale = 1;
      if (st.timeScale !== 1) useGame.setState({ timeScale: 1, slowMoUntil: 0 });
    }
    const sd = delta * scale;
    if (mixerRef.current && !isFarLod.current) mixerRef.current.update(sd);
    // Apply the manual lean override so the GLB idle animation can't
    // push the body into a weird pose (e.g. -π headstand). The
    // shared melee animation writes to swing.current.leanX/Z; here we
    // force the body rotation after the mixer so the override sticks.
    if (swing.current && modelRef.current) {
      applyManualLean(modelRef.current, swing.current.leanX, swing.current.leanZ);
    }
    const gs = useGame.getState();
    const hTile = gs.hoveredTile; const mRange = gs.moveRange;
    if (groupRef.current && isSelected && gs.selectionMode === "moving" && !moveFrom.current && hTile) {
      const hk = `${hTile.x},${hTile.y}`;
      if (mRange.has(hk)) { groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, hTile.x, 0.15); groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, hTile.y, 0.15); }
      else { groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, unit.pos.x, 0.15); groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, unit.pos.y, 0.15); }
    }
    let isMoving = false;
    if (groupRef.current && moveFrom.current && moveTo.current) {
      const el = Date.now() - moveStartTime.current; const t = Math.min(1, el / MOVE_DURATION); const et = t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
      groupRef.current.position.x = THREE.MathUtils.lerp(moveFrom.current.x, moveTo.current.x, et); groupRef.current.position.z = THREE.MathUtils.lerp(moveFrom.current.z, moveTo.current.z, et); isMoving = t < 1;
      if (t >= 1) { moveFrom.current = null; moveTo.current = null; playAnim(isSelected ? (ANIM.idleB || ANIM.idle) : ANIM.idle, true, 0.2); }
    }
    if (modelRef.current) { const diff = targetRotY.current - curRotY.current; const wr = ((diff + Math.PI) % (Math.PI*2)) - Math.PI; curRotY.current += wr * Math.min(1, sd * 8); modelRef.current.rotation.y = curRotY.current; }
    // Death animation: once the unit is flagged dead but the model is
    // still visible (between isDead && !dead), drive either a melee
    // collapse (forward tumble) or a magic dissolve (float up + fade).
    if (modelRef.current && unit.isDead) {
      deathAge.current += sd;
      const t = Math.min(1, deathAge.current / 1.6);
      if (deathStyle.current === "magic") {
        // Magic: float up, spin, dissolve + brief bright emissive flash
        // that fades as the body disappears.  The flash sells the
        // "soul leaves the body" beat better than opacity alone.
        const flash = Math.max(0, 1 - Math.abs(t - 0.2) * 3); // peak at t=0.2
        modelRef.current.position.y = 0.05 + t * 0.8;
        modelRef.current.rotation.x = t * 0.3;
        modelRef.current.rotation.y = t * 1.5;
        modelRef.current.traverse((c: any) => {
          if (c.isMesh && c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach((m: any) => {
              m.transparent = true;
              m.opacity = 1 - t;
              if (m.emissive) {
                m.emissiveIntensity = (m.emissiveIntensity || 0) + flash * 2.0;
              }
            });
          }
        });
      } else if (deathStyle.current === "pierce") {
        // Pierce — model stays upright, then slumps forward and slightly
        // to one side as if a lance/arrow is stuck in it.
        if (t < 0.4) {
          // Brief stagger before the slump
          modelRef.current.rotation.x = -t * 0.15;
        } else {
          const t2 = (t - 0.4) / 0.6;
          modelRef.current.rotation.x = -0.06 - t2 * 0.6;
          modelRef.current.rotation.z = t2 * 0.3;
          modelRef.current.position.y = -t2 * 0.08;
        }
      } else {
        // Melee — collapse backward (away from the camera) over 1.2s.
        modelRef.current.rotation.x = -t * Math.PI / 2;
        modelRef.current.position.y = -t * 0.1;
      }
    }
    // Smooth the HP bar toward the current value (~0.3s ease) and
    // track the previous displayed value so we can draw a "ghost"
    // red tick at the old HP position.  This makes HP loss much more
    // visible than a smooth colour gradient alone.
    const prevDisp = displayedHp.current;
    displayedHp.current = THREE.MathUtils.lerp(displayedHp.current, hpPct, Math.min(1, sd * 5));
    if (hpBarMesh.current) {
      const w = Math.max(0.01, 0.78 * displayedHp.current);
      hpBarMesh.current.scale.x = w / 0.78;
      hpBarMesh.current.position.x = -0.4 + (0.78 * displayedHp.current) / 2;
    }
    if (hpGhostMesh.current) {
      // The ghost bar is anchored at the *current* HP position and
      // extends to the right toward where the bar used to be.  Its
      // opacity decays so the visual reads as "you just lost this
      // much HP".
      const dx = prevDisp - displayedHp.current;
      if (dx > 0.005) {
        hpGhostMesh.current.visible = true;
        hpGhostMesh.current.position.x = -0.4 + (0.78 * displayedHp.current) + (0.78 * dx) / 2;
        hpGhostMesh.current.scale.x = dx;
        const m = hpGhostMesh.current.material as THREE.MeshBasicMaterial;
        m.opacity = Math.min(0.8, m.opacity + sd * 4);
      } else {
        // Decay the ghost so it fades out a moment after damage stops.
        const m = hpGhostMesh.current.material as THREE.MeshBasicMaterial;
        m.opacity = Math.max(0, m.opacity - sd * 1.5);
        if (m.opacity < 0.01) hpGhostMesh.current.visible = false;
      }
    }
    if (modelRef.current) {
      // Idle breathing: every unit gets a per-uid phase so they don't
      // all bob in sync.  6cm is enough to read as "alive" without
      // distracting from combat.  Selected units get a punchier
      // selected-bob (15cm) in addition so they read as "ready to act".
      const phase = unit.uid.charCodeAt(unit.uid.length - 1) * 0.31;
      const breath = (Math.sin(state.clock.elapsedTime * 1.5 + phase) * 0.5 + 0.5) * 0.06;
      if (isSelected && !isMoving && !combatPhase && gs.selectionMode !== "moving") {
        modelRef.current.position.y = breath + Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.15;
      } else {
        modelRef.current.position.y = THREE.MathUtils.lerp(modelRef.current.position.y, breath, 0.18);
      }
    }
    if (ringRef.current && (isSelected || hovered)) { const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.06; ringRef.current.scale.set(s, s, 1); }
    // LOD: at long camera distance, swap the GLB for a cheap billboard
    // so we don't keep animating dozens of skeletons. The billboard is
    // a coloured circle facing the camera — good enough to read as a
    // "unit" placeholder from across the map.
    //
    // We use *true 3D distance* (XZ + Y) rather than horizontal distance
    // alone, so units directly under the camera don't suddenly pop into
    // billboard mode as the camera rotates around the map.  Threshold is
    // raised from 12 to 18 — the model is still cheap enough at this
    // distance, and avoids a jarring swap mid-orbit.
    if (groupRef.current) {
      const cam = state.camera;
      const camPos = cam.position;
      const uPos = groupRef.current.position;
      const dx = camPos.x - uPos.x;
      const dy = camPos.y - 0;  // unit sits on the ground
      const dz = camPos.z - uPos.z;
      const dist = Math.hypot(dx, dy, dz);
      const far = dist > 18;
      if (far !== isFarLod.current) {
        isFarLod.current = far;
        if (modelRef.current) modelRef.current.visible = !far;
        if (lungeGroupRef.current) {
          // The far-LOD hides the model group; the ring still shows
          // for selected/hovered.
          lungeGroupRef.current.visible = !far;
        }
        if (billboardRef.current) billboardRef.current.visible = far;
      }
      if (far && billboardRef.current) {
        // Face the camera horizontally so the plane stays readable from
        // any camera angle (including straight-down).  When the camera is
        // directly above the unit the forward vector is zero — in that
        // case fall back to the default orientation.
        const dx = camPos.x - uPos.x;
        const dz = camPos.z - uPos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          billboardRef.current.lookAt(uPos.x + dx, billboardRef.current.position.y, uPos.z + dz);
        }
      }
    }
  });

  if (dead) return null;
  return (
    <group ref={groupRef} position={[unit.pos.x, 0, unit.pos.y]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}><circleGeometry args={[0.42, 32]} /><meshBasicMaterial color={factionColor} transparent opacity={unit.isBoss ? 0.6 : 0.35} /></mesh>
      <mesh ref={ringRef} position={[0, 0.06, 0]} rotation={[-Math.PI/2, 0, 0]} visible={isSelected || hovered || inAttackRange}><ringGeometry args={[0.44, 0.5, 32]} /><meshBasicMaterial color={inAttackRange ? "#ff3333" : isSelected ? "#55aaff" : "#aaffee"} transparent opacity={0.9} side={THREE.DoubleSide} /></mesh>
      <group ref={lungeGroupRef}>
        <group ref={modelRef}>{cloneObj && <primitive object={cloneObj} />}</group>
      </group>
      <mesh ref={billboardRef} position={[0, 0.7, 0]} visible={false} renderOrder={2}>
        <planeGeometry args={[0.7, 1.3]} />
        <meshBasicMaterial color={factionColor} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {flashRed && <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.6, 12, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} /></mesh>}
      {isExhausted && <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.6, 8, 8]} /><meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} /></mesh>}
      {unit.isBoss && <BossCrown />}
      <group position={[0, TARGET_HEIGHT + 0.55, 0]}><mesh><planeGeometry args={[0.8, 0.1]} /><meshBasicMaterial color="#000" transparent opacity={0.6} /></mesh><mesh ref={hpBarMesh} position={[-0.4 + (0.78*displayedHp.current)/2, 0, 0.001]}><planeGeometry args={[0.78, 0.06]} /><meshBasicMaterial color={hpColor} /></mesh><mesh ref={hpGhostMesh} position={[-0.4 + (0.78*displayedHp.current)/2, 0, 0.002]}><planeGeometry args={[0.78, 0.06]} /><meshBasicMaterial color="#ff4040" transparent opacity={0} depthWrite={false} /></mesh></group>
      {selectionMode !== "moving" && <mesh position={[0, 0.7, 0]} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onPointerDown={onPointerDown}><cylinderGeometry args={[0.4, 0.4, 1.5, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
    </group>
  );
}

// Boss crown — gold ring + spikes + soft glow. The material is marked
// `__bloom = true` so the selective-bloom pass picks it up and the
// crown reads as a glowing point of light, not a dark cone.
function BossCrown() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const crackRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (matRef.current) (matRef.current as any).__bloom = true;
  }, []);
  useFrame((state) => {
    if (crackRef.current) {
      // Slow rotation + breathing scale on the ground crack ring so it
      // reads as a "this is dangerous" aura rather than a static decal.
      crackRef.current.rotation.z = state.clock.elapsedTime * 0.3;
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.04;
      crackRef.current.scale.setScalar(s);
    }
  });
  return (
    <>
      <group position={[0, TARGET_HEIGHT + 0.3, 0]}>
        <mesh>
          <coneGeometry args={[0.18, 0.28, 6]} />
          <meshStandardMaterial
            ref={matRef}
            color="#ffd060"
            metalness={0.9}
            roughness={0.2}
            emissive="#ffaa22"
            emissiveIntensity={1.4}
          />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.18, 12, 8]} />
          <meshBasicMaterial color="#ffd060" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={crackRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.4, 0.55, 32]} />
        <meshBasicMaterial color="#ffaa22" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <ringGeometry args={[0.55, 0.62, 6]} />
        <meshBasicMaterial color="#ff8030" transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
