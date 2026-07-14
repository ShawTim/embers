import { useMemo, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GameGrid, Pos } from "../game/grid";
import { posKey } from "../game/grid";
import { useGame } from "../game/store";

const TERRAIN_CFG: Record<string, { height: number; color: THREE.Color; roughness: number; metalness: number }> = {
  plain: { height: 0.1, color: new THREE.Color(0.32, 0.52, 0.26), roughness: 0.85, metalness: 0 },
  forest: { height: 0.12, color: new THREE.Color(0.16, 0.34, 0.14), roughness: 0.9, metalness: 0 },
  mountain: { height: 0.5, color: new THREE.Color(0.52, 0.44, 0.35), roughness: 0.95, metalness: 0.05 },
  fort: { height: 0.2, color: new THREE.Color(0.46, 0.46, 0.50), roughness: 0.7, metalness: 0.1 },
  road: { height: 0.08, color: new THREE.Color(0.64, 0.58, 0.44), roughness: 0.8, metalness: 0 },
  water: { height: 0.04, color: new THREE.Color(0.10, 0.32, 0.56), roughness: 0.12, metalness: 0.6 },
  deep_water: { height: 0.02, color: new THREE.Color(0.06, 0.16, 0.38), roughness: 0.08, metalness: 0.7 },
  cliff: { height: 1.2, color: new THREE.Color(0.40, 0.34, 0.28), roughness: 0.95, metalness: 0 },
  sand: { height: 0.1, color: new THREE.Color(0.80, 0.74, 0.50), roughness: 0.9, metalness: 0 },
  thicket: { height: 0.15, color: new THREE.Color(0.10, 0.26, 0.10), roughness: 0.9, metalness: 0 },
  floor: { height: 0.1, color: new THREE.Color(0.44, 0.39, 0.35), roughness: 0.7, metalness: 0.05 },
  wall: { height: 1.0, color: new THREE.Color(0.26, 0.26, 0.30), roughness: 0.8, metalness: 0.1 },
  throne: { height: 0.2, color: new THREE.Color(0.56, 0.46, 0.14), roughness: 0.4, metalness: 0.3 },
  deployment: { height: 0.1, color: new THREE.Color(0.20, 0.50, 0.20), roughness: 0.8, metalness: 0 },
  bridge: { height: 0.1, color: new THREE.Color(0.52, 0.40, 0.24), roughness: 0.85, metalness: 0 },
};

const DECOR_MODELS: Record<string, string[]> = {
  forest: ["/models/decorations/tree_single_A.gltf", "/models/decorations/trees_A_small.gltf", "/models/decorations/trees_A_medium.gltf"],
  thicket: ["/models/decorations/trees_A_medium.gltf", "/models/decorations/trees_A_small.gltf"],
  mountain: ["/models/decorations/mountain_A_grass.gltf", "/models/decorations/mountain_B_grass.gltf", "/models/decorations/rock_single_A.gltf", "/models/decorations/rock_single_B.gltf"],
  fort: ["/models/decorations/flag_blue.gltf"],
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
  const isHovered = hoveredTile && hoveredTile.x === tile.pos.x && hoveredTile.y === tile.pos.y;
  const cfg = TERRAIN_CFG[tile.type] || TERRAIN_CFG.plain;
  const isWall = tile.type === "wall" || tile.type === "cliff";
  const height = cfg.height;
  let oc: THREE.Color | null = null, oo = 0;
  if (inAttackRange && selectionMode === "targeting") { oc = new THREE.Color(0xff2222); oo = 0.5; }
  else if (inAttackRange) { oc = new THREE.Color(0xff5533); oo = 0.22; }
  else if (inMoveRange) { oc = new THREE.Color(0x3377ff); oo = 0.32; }
  const onEnter = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hoverTile(tile.pos); };
  const onDown = (e: ThreeEvent<PointerEvent>) => { if (e.button !== 0) return; e.stopPropagation(); onTileClick(tile.pos); };
  return (
    <group position={[tile.pos.x, 0, tile.pos.y]}>
      <mesh position={[0, height / 2, 0]} onPointerEnter={onEnter} onPointerDown={onDown} castShadow={!isWall} receiveShadow><boxGeometry args={[0.95, height, 0.95]} /><meshStandardMaterial color={cfg.color} roughness={cfg.roughness} metalness={cfg.metalness} /></mesh>
      <Suspense fallback={null}><TileDecorations type={tile.type} height={height} pos={tile.pos} /></Suspense>
      {oc && <mesh position={[0, height + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.92, 0.92]} /><meshBasicMaterial color={oc} transparent opacity={oo + (isHovered ? 0.15 : 0)} side={THREE.DoubleSide} /></mesh>}
      {isHovered && !oc && <mesh position={[0, height + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.92, 0.92]} /><meshBasicMaterial color="white" transparent opacity={0.12} side={THREE.DoubleSide} /></mesh>}
    </group>
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
