import { useMemo, Suspense, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GameGrid, Pos } from "../game/grid";
import { posKey } from "../game/grid";
import { useGame } from "../game/store";
import { getTileMaterial } from "./shared/SceneAssets";
import { makeHoverMaterial, HoverMode } from "./shared/HoverShader";

// Tile geometry / height per type. The visual material comes from
// the cached procedural material in SceneAssets (grass, sand, wood,
// stone, water) so every tile of the same type shares one texture
// atlas. This keeps draw calls down and the textures crisp.
const TERRAIN_CFG: Record<string, { height: number; roughness: number; metalness: number }> = {
  plain: { height: 0.1, roughness: 0.95, metalness: 0 },
  forest: { height: 0.12, roughness: 0.95, metalness: 0 },
  mountain: { height: 0.5, roughness: 0.95, metalness: 0.05 },
  fort: { height: 0.2, roughness: 0.75, metalness: 0.1 },
  road: { height: 0.08, roughness: 0.92, metalness: 0 },
  water: { height: 0.04, roughness: 0.15, metalness: 0.4 },
  deep_water: { height: 0.02, roughness: 0.1, metalness: 0.4 },
  cliff: { height: 1.2, roughness: 0.95, metalness: 0 },
  sand: { height: 0.1, roughness: 0.92, metalness: 0 },
  thicket: { height: 0.15, roughness: 0.95, metalness: 0 },
  floor: { height: 0.1, roughness: 0.75, metalness: 0.1 },
  wall: { height: 1.0, roughness: 0.85, metalness: 0.15 },
  throne: { height: 0.2, roughness: 0.4, metalness: 0.3 },
  deployment: { height: 0.1, roughness: 0.95, metalness: 0 },
  bridge: { height: 0.1, roughness: 0.85, metalness: 0 },
};

const B = import.meta.env.BASE_URL;

const DECOR_MODELS: Record<string, string[]> = {
  forest: [B + "models/decorations/tree_single_A.gltf", B + "models/decorations/trees_A_small.gltf", B + "models/decorations/trees_A_medium.gltf"],
  thicket: [B + "models/decorations/trees_A_medium.gltf", B + "models/decorations/trees_A_small.gltf"],
  mountain: [B + "models/decorations/mountain_A_grass.gltf", B + "models/decorations/mountain_B_grass.gltf", B + "models/decorations/rock_single_A.gltf", B + "models/decorations/rock_single_B.gltf"],
  fort: [B + "models/decorations/flag_blue.gltf"],
};

export function TileMap({ grid }: { grid: GameGrid }) {
  const tiles = useMemo(() => { const r: { pos: Pos; type: string }[] = []; for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) r.push({ pos: { x, y }, type: grid.terrain[y][x] }); return r; }, [grid]);
  return (
    <group>
      <mesh position={[grid.w / 2 - 0.5, -0.08, grid.h / 2 - 0.5]} receiveShadow><boxGeometry args={[grid.w + 0.4, 0.15, grid.h + 0.4]} /><meshStandardMaterial color="#1a2436" roughness={0.95} /></mesh>
      {tiles.map(tl => <Tile key={`${tl.pos.x},${tl.pos.y}`} grid={grid} tile={tl} />)}
      <GridLines grid={grid} />
    </group>
  );
}

function Tile({ grid, tile }: { grid: GameGrid; tile: { pos: Pos; type: string } }) {
  const moveRange = useGame(s => s.moveRange);
  const attackRange = useGame(s => s.attackRange);
  const onTileClick = useGame(s => s.onTileClick);
  const hoverTile = useGame(s => s.hoverTile);
  const hoveredTile = useGame(s => s.hoveredTile);
  const selectionMode = useGame(s => s.selectionMode);
  const key = posKey(tile.pos);
  const inMoveRange = moveRange.has(key);
  const inAttackRange = attackRange.includes(key);
  const isHovered = !!(hoveredTile && hoveredTile.x === tile.pos.x && hoveredTile.y === tile.pos.y);
  const cfg = TERRAIN_CFG[tile.type] || TERRAIN_CFG.plain;
  const isWall = tile.type === "wall" || tile.type === "cliff";
  const height = cfg.height;
  const onEnter = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hoverTile(tile.pos); };
  const onDown = (e: ThreeEvent<PointerEvent>) => { if (e.button !== 0) return; e.stopPropagation(); onTileClick(tile.pos); };
  // Use a slightly larger (1.0) plane with beveled edges so neighbouring
  // tiles visually blend (no 0.05 gap). For walls / cliffs we keep the
  // box silhouette so the elevated face is clear.
  if (isWall) {
    return (
      <group position={[tile.pos.x, 0, tile.pos.y]}>
        <mesh position={[0, height / 2, 0]} onPointerEnter={onEnter} onPointerDown={onDown} castShadow={!isWall} receiveShadow>
          <boxGeometry args={[0.95, height, 0.95]} />
          <primitive object={getTileMaterial(tile.type)} attach="material" />
        </mesh>
        <Suspense fallback={null}><TileDecorations type={tile.type} height={height} pos={tile.pos} /></Suspense>
        <TileHoverOverlay pos={tile.pos} height={height} mode={hoverModeForTile(inMoveRange, inAttackRange, selectionMode, isHovered)} />
      </group>
    );
  }
  // Flat / low terrain — use a subdivided 1.0×1.0 plane with the height
  // map's AO driving a slight vertex displacement.  Tiles are
  // expanded to 1.0 wide so they share edges (vertex blending).
  return (
    <group position={[tile.pos.x, 0, tile.pos.y]}>
      <mesh
        position={[0, height / 2, 0]}
        onPointerEnter={onEnter}
        onPointerDown={onDown}
        castShadow={!isWall}
        receiveShadow
      >
        <boxGeometry args={[1.0, height, 1.0]} />
        <primitive object={getTileMaterial(tile.type)} attach="material" />
      </mesh>
      <Suspense fallback={null}><TileDecorations type={tile.type} height={height} pos={tile.pos} /></Suspense>
      <TileHoverOverlay pos={tile.pos} height={height} mode={hoverModeForTile(inMoveRange, inAttackRange, selectionMode, isHovered)} />
    </group>
  );
}

function hoverModeForTile(inMove: boolean, inAttack: boolean, selMode: string | undefined, isHovered: boolean): HoverMode | null {
  if (selMode === "targeting" && inAttack) return "attack";
  if (inAttack) return "attack";
  if (inMove) return "move";
  if (isHovered) return "hover";
  return null;
}

function TileHoverOverlay({ pos, height, mode }: { pos: Pos; height: number; mode: HoverMode | null }) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const mat = useMemo(() => mode ? makeHoverMaterial(mode) : null, [mode]);
  useFrame((state) => {
    if (mat) mat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  if (!mat) return null;
  return (
    <mesh position={[pos.x, height + 0.005, pos.y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <planeGeometry args={[0.96, 0.96]} />
      <primitive object={mat} attach="material" ref={matRef as any} />
    </mesh>
  );
}

function TileDecorations({ type, height, pos }: { type: string; height: number; pos: Pos }) {
  const models = DECOR_MODELS[type];
  if (!models?.length) {
    if (type === "throne") return <group position={[0, height, 0]}><mesh position={[0,0.1,0]} castShadow><boxGeometry args={[0.4,0.2,0.4]} /><meshStandardMaterial color="#8a7020" metalness={0.6} roughness={0.3} /></mesh><mesh position={[0,0.35,-0.15]} castShadow><boxGeometry args={[0.4,0.5,0.1]} /><meshStandardMaterial color="#7a6018" metalness={0.6} roughness={0.3} /></mesh><pointLight position={[0,0.5,0]} color="gold" intensity={0.5} distance={2} /></group>;
    if (type === "bridge") return <group position={[0, height, 0]}>{[0,0.25,-0.25].map((z,i) => <mesh key={i} position={[0,0.005,z]}><boxGeometry args={[0.9,0.02,0.08]} /><meshStandardMaterial color="#6a4e2e" roughness={0.9} /></mesh>)}</group>;
    return null;
  }
  const seed = (pos.x * 73 + pos.y * 31) % models.length;
  return <ModelDeco modelPath={models[seed]} height={height} />;
}

function ModelDeco({ modelPath, height }: { modelPath: string; height: number }) {
  const [loaded, setLoaded] = useState<THREE.Group | null>(null);
  useEffect(() => {
    new GLTFLoader().load(modelPath, (gltf: any) => {
      const obj = gltf.scene; const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const maxDim = Math.max(size.x, size.y, size.z); const sc = 0.8 / maxDim; obj.scale.setScalar(sc); const c = box.getCenter(new THREE.Vector3()); obj.position.set(-c.x * sc, height - box.min.y * sc, -c.z * sc); obj.traverse((ch: any) => { if (ch instanceof THREE.Mesh) { ch.castShadow = true; ch.receiveShadow = true; } }); setLoaded(obj);
    }, undefined, () => {});
  }, [modelPath, height]);
  if (!loaded) return null;
  return <primitive object={loaded} />;
}

function GridLines({ grid }: { grid: GameGrid }) {
  const geo = useMemo(() => { const pts: number[] = []; const y = 0.07; for (let x = 0; x <= grid.w; x++) pts.push(x-0.5,y,-0.5, x-0.5,y,grid.h-0.5); for (let z = 0; z <= grid.h; z++) pts.push(-0.5,y,z-0.5, grid.w-0.5,y,z-0.5); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); return g; }, [grid]);
  return <lineSegments geometry={geo}><lineBasicMaterial color="#000" transparent opacity={0.12} /></lineSegments>;
}
