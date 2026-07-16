import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useGame } from "../game/store";
import { TileMap } from "./TileMap";
import { Unit3D } from "./Unit3D";
import { CombatEffects } from "./CombatEffects";
import { DamageNumbers } from "./DamageNumbers";
import { CameraController } from "./CameraController";
import { getEnvMap, envForChapter } from "./shared/EnvMap";
import { setTileMaterialChapter } from "./shared/SceneAssets";
import { updateWindMaterials } from "./shared/WindShader";
import { updateWaterMaterials } from "./shared/WaterShader";
import { PostFX } from "./PostFX";
import { ChapterParticles } from "./AmbientParticles";
import { VolumetricFog } from "./VolumetricFog";
import { FootprintDecals } from "./FootprintDecals";

export function Scene() {
  const grid = useGame(s => s.grid);
  const units = useGame(s => s.units);
  const chapter = useGame(s => s.chapter);
  const hitEffects = useGame(s => s.hitEffects);
  const removeHitEffect = useGame(s => s.removeHitEffect);
  const damageNumbers = useGame(s => s.damageNumbers);
  const removeDamageNumber = useGame(s => s.removeDamageNumber);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Refresh the tile-material cache & env map when the chapter changes
  useEffect(() => {
    if (chapter) setTileMaterialChapter(chapter.id);
  }, [chapter]);

  const envMap = useMemo(() => getEnvMap(chapter?.id ?? "default"), [chapter]);
  const envCfg = useMemo(() => envForChapter(chapter?.id ?? "default"), [chapter]);

  if (!grid) return null;
  const cx = (grid.w - 1) / 2, cz = (grid.h - 1) / 2;
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 1.5]}
      camera={{ position: [cx, grid.h * 0.9, cz + grid.h * 0.65], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#0c0e16", 1);
        scene.environment = envMap;
        scene.environmentIntensity = 0.6;
        sceneRef.current = scene;
      }}
    >
      <CameraController w={grid.w} h={grid.h} />
      <ambientLight intensity={0.45} color="#b0c4de" />
      <directionalLight
        position={[cx + 4, 18, cz - 4]}
        intensity={envCfg.sunIntensity * 0.5}
        color={`rgb(${Math.floor(envCfg.sunColor.r * 255)}, ${Math.floor(envCfg.sunColor.g * 255)}, ${Math.floor(envCfg.sunColor.b * 255)})`}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[cx - 8, 8, cz + 6]} intensity={0.3} color="#6080a0" />
      <hemisphereLight args={["#a0b8d8", "#3a2818", 0.3]} />
      <fog attach="fog" args={[envCfg.fogColor, 28, 70]} />
      <VolumetricFog w={grid.w} h={grid.h} chapterId={chapter?.id ?? "default"} />
      <ChapterParticles chapterId={chapter?.id ?? "default"} w={grid.w} h={grid.h} />
      <TileMap grid={grid} />
      <FootprintDecals />
      {units.filter(u => !u.isDead).map(u => <Unit3D key={u.uid} unit={u} />)}
      <CombatEffects effects={hitEffects} onDone={removeHitEffect} />
      <DamageNumbers numbers={damageNumbers} onDone={removeDamageNumber} />
      <ShaderAnimationRunner sceneRef={sceneRef} />
      <PostFX />
    </Canvas>
  );
}

// Single useFrame hook for both wind & water shader updates
function ShaderAnimationRunner({ sceneRef }: { sceneRef: React.MutableRefObject<THREE.Scene | null> }) {
  useFrame((state) => {
    const s = sceneRef.current;
    if (!s) return;
    const t = state.clock.elapsedTime;
    updateWindMaterials(s, t);
    updateWaterMaterials(s, t);
  });
  return null;
}
