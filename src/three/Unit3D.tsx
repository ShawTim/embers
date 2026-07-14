import { useRef, useState, useEffect, Suspense } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { RuntimeUnit } from "../types";
import { useGame } from "../game/store";

export const MODEL_PATHS: Record<string, string> = {
  Paladin: "/models/characters/Paladin.glb", BlackKnight: "/models/characters/BlackKnight.glb",
  Witch: "/models/characters/Witch.glb", MagicalGirl: "/models/characters/MagicalGirl.glb",
  Druid: "/models/characters/Druid.glb", Ranger: "/models/characters/Ranger.glb",
  Knight: "/models/characters/Knight.glb", Mage: "/models/characters/Mage.glb",
  Rogue: "/models/characters/Rogue.glb", Barbarian: "/models/characters/Barbarian.glb",
  AvianSwordsman: "/models/characters/AvianSwordsman.glb", Protagonist_A: "/models/characters/Protagonist_A.glb",
  Protagonist_B: "/models/characters/Protagonist_B.glb", Lorekeeper: "/models/characters/Lorekeeper.glb",
  Skeleton_Warrior: "/models/characters/Skeleton_Warrior.glb", Skeleton_Mage: "/models/characters/Skeleton_Mage.glb",
  Skeleton_Rogue: "/models/characters/Skeleton_Rogue.glb", Skeleton_Minion: "/models/characters/Skeleton_Minion.glb",
};
export const ANIM_PATHS: Record<string, string> = {
  general: "/models/animations/Rig_Medium_General.glb", movement: "/models/animations/Rig_Medium_MovementBasic.glb",
  melee: "/models/animations/Rig_Medium_CombatMelee.glb", ranged: "/models/animations/Rig_Medium_CombatRanged.glb",
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
  const prevActed = useRef(unit.hasActed);
  const [dead, setDead] = useState(false);
  const [cloneObj, setCloneObj] = useState<THREE.Object3D | null>(null);

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
    const c = cloneSkeleton(gltf.scene);
    c.traverse((ch: any) => { if (ch instanceof THREE.Mesh) { const n = ch.name.toLowerCase(); if (["shield","sword","offhand","bow","staff","wand","dagger","axe","mug","spellbook","crossbow"].some(k => n.includes(k))) ch.visible = false; else { ch.castShadow = true; ch.receiveShadow = true; } } });
    const box = new THREE.Box3(); c.traverse((ch: any) => { if (ch instanceof THREE.Mesh && ch.visible) box.expandByObject(ch); });
    const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const s = TARGET_HEIGHT / size.y;
    c.scale.setScalar(s); c.position.set(-center.x * s, -box.min.y * s, -center.z * s);
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
      else if (pn.includes("windup") || pn.includes("strike")) { const wt = unit.classDef.weapons[0]; if (wt === "bow") playAnim(ANIM.bowShoot, false, 0.1); else if (wt === "fire" || wt === "thunder") playAnim(ANIM.magicShoot, false, 0.1); else playAnim(ANIM.attackSlash, false, 0.1); }
      else if (pn.includes("recoil") || pn.includes("recovery")) playAnim(ANIM.idle, true, 0.2);
    } else {
      if (pn === "approach") playAnim(ANIM.idle, true, 0.3);
      else if (pn.includes("impact")) playAnim(ANIM.hitA, false, 0.05);
      else if (pn.includes("recoil")) playAnim(ANIM.hitB || ANIM.hitA, false, 0.1);
      else if (pn.includes("recovery")) playAnim(ANIM.idle, true, 0.2);
    }
  }, [combatPhase, activeCombat, unit.uid]);

  useEffect(() => { if (isSelected && !moveTo.current && !combatPhase) playAnim(ANIM.idleB || ANIM.idle, true, 0.2); else if (!isSelected && !moveTo.current && !combatPhase) playAnim(ANIM.idle, true, 0.3); }, [isSelected]);
  useEffect(() => { if (unit.hp < prevHp.current) { setFlashRed(true); const tm = setTimeout(() => setFlashRed(false), 400); prevHp.current = unit.hp; return () => clearTimeout(tm); } prevHp.current = unit.hp; }, [unit.hp]);
  useEffect(() => { if (unit.isDead && !dead) { playAnim(ANIM.deathA, false, 0.2); const tm = setTimeout(() => setDead(true), 2000); return () => clearTimeout(tm); } }, [unit.isDead]);

  const onPointerEnter = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; hoverUnit(unit); if (selectionMode === "targeting" && unit.faction !== "player") { const sel = useGame.getState().selectedUnit; if (sel) showCombatPreview(sel, unit); } };
  const onPointerLeave = () => { setHovered(false); document.body.style.cursor = "default"; };
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => { if (e.button !== 0) return; e.stopPropagation(); if (phase !== "player") return; if (selectionMode === "targeting" && unit.faction !== "player") onTileClick(unit.pos); else if (unit.faction === "player" && !unit.hasActed) selectUnit(unit); else hoverUnit(unit); };

  useFrame((state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
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
    if (modelRef.current) { const diff = targetRotY.current - curRotY.current; const wr = ((diff + Math.PI) % (Math.PI*2)) - Math.PI; curRotY.current += wr * Math.min(1, delta * 8); modelRef.current.rotation.y = curRotY.current; }
    if (modelRef.current && isSelected && !isMoving && !combatPhase && gs.selectionMode !== "moving") modelRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.08;
    else if (modelRef.current) modelRef.current.position.y = THREE.MathUtils.lerp(modelRef.current.position.y, 0, 0.15);
    if (ringRef.current && (isSelected || hovered)) { const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.06; ringRef.current.scale.set(s, s, 1); }
  });

  if (dead) return null;
  return (
    <group ref={groupRef} position={[unit.pos.x, 0, unit.pos.y]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}><circleGeometry args={[0.42, 32]} /><meshBasicMaterial color={factionColor} transparent opacity={unit.isBoss ? 0.6 : 0.35} /></mesh>
      <mesh ref={ringRef} position={[0, 0.06, 0]} rotation={[-Math.PI/2, 0, 0]} visible={isSelected || hovered || inAttackRange}><ringGeometry args={[0.44, 0.5, 32]} /><meshBasicMaterial color={inAttackRange ? "#ff3333" : isSelected ? "#55aaff" : "#aaffee"} transparent opacity={0.9} side={THREE.DoubleSide} /></mesh>
      <group ref={modelRef}>{cloneObj && <primitive object={cloneObj} />}</group>
      {flashRed && <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.6, 8, 8]} /><meshBasicMaterial color="#ff0000" transparent opacity={0.25} depthWrite={false} /></mesh>}
      {isExhausted && <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.6, 8, 8]} /><meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} /></mesh>}
      {unit.isBoss && <mesh position={[0, TARGET_HEIGHT + 0.3, 0]}><coneGeometry args={[0.15, 0.25, 6]} /><meshStandardMaterial color="gold" metalness={0.9} roughness={0.2} emissive="gold" emissiveIntensity={0.3} /></mesh>}
      <group position={[0, TARGET_HEIGHT + 0.55, 0]}><mesh><planeGeometry args={[0.8, 0.1]} /><meshBasicMaterial color="#000" transparent opacity={0.6} /></mesh><mesh position={[-0.4 + (0.78*hpPct)/2, 0, 0.001]}><planeGeometry args={[Math.max(0.01, 0.78*hpPct), 0.06]} /><meshBasicMaterial color={hpColor} /></mesh></group>
      {selectionMode !== "moving" && <mesh position={[0, 0.7, 0]} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onPointerDown={onPointerDown}><cylinderGeometry args={[0.4, 0.4, 1.5, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
    </group>
  );
}
