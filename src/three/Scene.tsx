import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../game/store";
import { TileMap } from "./TileMap";
import { Unit3D } from "./Unit3D";
import { CombatEffects } from "./CombatEffects";
import { DamageNumbers } from "./DamageNumbers";
import { CameraController } from "./CameraController";

export function Scene() {
  const grid = useGame(s => s.grid);
  const units = useGame(s => s.units);
  const hitEffects = useGame(s => s.hitEffects);
  const removeHitEffect = useGame(s => s.removeHitEffect);
  const damageNumbers = useGame(s => s.damageNumbers);
  const removeDamageNumber = useGame(s => s.removeDamageNumber);
  if (!grid) return null;
  const cx = (grid.w - 1) / 2, cz = (grid.h - 1) / 2;
  return (
    <Canvas shadows camera={{ position: [cx, grid.h * 0.9, cz + grid.h * 0.65], fov: 50, near: 0.1, far: 200 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }} onCreated={({ gl }) => { gl.setClearColor("#141a26"); }}>
      <CameraController w={grid.w} h={grid.h} />
      <ambientLight intensity={0.6} color="#b0c4de" />
      <directionalLight position={[cx + 4, 18, cz - 4]} intensity={1.4} color="#ffe8c0" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={1} shadow-camera-far={60} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.0005} />
      <directionalLight position={[cx - 8, 8, cz + 6]} intensity={0.3} color="#6080a0" />
      <hemisphereLight args={["#a0b8d8", "#3a2818", 0.3]} />
      <fog attach="fog" args={["#141a26", 30, 80]} />
      <TileMap grid={grid} />
      {units.filter(u => !u.isDead).map(u => <Unit3D key={u.uid} unit={u} />)}
      <CombatEffects effects={hitEffects} onDone={removeHitEffect} />
      <DamageNumbers numbers={damageNumbers} onDone={removeDamageNumber} />
    </Canvas>
  );
}
