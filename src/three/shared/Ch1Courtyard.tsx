import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  makeStoneMaterial,
  makeCobbleMaterial,
  getSkyGradientMap,
  getFlameSpriteMap,
  getSmokeSpriteMap,
  getStoneNormalMap,
  getCobbleNormalMap,
} from "./SceneAssets";

/**
 * Production-quality Ch1 night-courtyard scene. Reusable across the
 * landing page and the main game's main-menu. All parts use
 * procedural materials (no external textures) so the look is
 * unique and the bundle stays small.
 *
 * Layout:
 *   - A sky dome with stars and a warm horizon glow
 *   - A cobblestone floor (instanced) inside a larger flagstone
 *   - Broken estate walls forming a U-shape behind the fighting area
 *   - One corner tower with crenellations
 *   - Four burning torches around the perimeter, each with a
 *     flickering flame, smoke wisp, and dynamic point light
 *   - Subtle haze particles drifting across the stage
 *   - Scattered debris (broken masonry) on the floor
 */
export function Ch1CourtyardScene() {
  return (
    <group>
      <SkyDome />
      <Moon />
      <CobblestoneFloor />
      <CourtyardWalls />
      <CornerTower />
      <HazeParticles />
      <Debris />
      <Torches />
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Sky and moon
// ---------------------------------------------------------------------------
function SkyDome() {
  const tex = useMemo(() => getSkyGradientMap(), []);
  return (
    <mesh>
      <sphereGeometry args={[80, 24, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function Moon() {
  return (
    <group>
      {/* Moon disc */}
      <mesh position={[12, 14, -16]}>
        <sphereGeometry args={[2.6, 24, 24]} />
        <meshBasicMaterial color="#f5f6ff" />
      </mesh>
      {/* Soft halo */}
      <mesh position={[12, 14, -16]}>
        <sphereGeometry args={[3.4, 24, 24]} />
        <meshBasicMaterial
          color="#dde2f0"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[12, 14, -16]}>
        <sphereGeometry args={[4.6, 24, 24]} />
        <meshBasicMaterial
          color="#c8d0e0"
          transparent
          opacity={0.10}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={[12, 14, -16]}
        intensity={1.6}
        color="#e8ecf6"
        distance={60}
        decay={1.3}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Floor — cobblestones on a flagstone base, with a slightly raised
//  dais where the fighting happens
// ---------------------------------------------------------------------------
function CobblestoneFloor() {
  const tile = useMemo(() => makeCobbleMaterial(), []);
  const base = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.18, 0.16, 0.14),
      roughness: 0.95,
      metalness: 0.0,
    });
    return m;
  }, []);

  // A grid of small instanced cobblestone tiles for the central dais
  const instancedRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (!instancedRef.current) return;
    const m = instancedRef.current;
    const R = 5.2;
    const step = 0.5;
    let i = 0;
    for (let x = -R; x <= R; x += step) {
      for (let z = -R; z <= R; z += step) {
        if (x * x + z * z > R * R) continue;
        dummy.position.set(x + (Math.random() - 0.5) * 0.04, 0.005, z + (Math.random() - 0.5) * 0.04);
        dummy.rotation.set(0, (Math.random() - 0.5) * 0.15, 0);
        const sx = 0.42 + Math.random() * 0.1;
        const sz = 0.42 + Math.random() * 0.1;
        dummy.scale.set(sx, 0.95, sz);
        dummy.updateMatrix();
        m.setMatrixAt(i++, dummy.matrix);
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      {/* Outer ground plane */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <primitive object={base} attach="material" />
      </mesh>
      {/* Cobble dais */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[5.4, 5.4, 0.06, 64]} />
        <primitive object={tile} attach="material" />
      </mesh>
      {/* Instanced stone tiles on top for varied cobble pattern */}
      <instancedMesh
        ref={instancedRef}
        args={[undefined, undefined, 400]}
        position={[0, 0.03, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 0.05, 1]} />
        <meshStandardMaterial
          color="#7a6e62"
          roughness={0.95}
          metalness={0.0}
          normalMap={getCobbleNormalMap()}
          normalScale={new THREE.Vector2(0.6, 0.6)}
        />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Walls — broken estate perimeter forming a C behind the fight
// ---------------------------------------------------------------------------
function CourtyardWalls() {
  // A long wall along the back, then two side walls, all made of
  // stacked stone-block segments.
  return (
    <group>
      <WallSegment pos={[-3, 0, -6]} rot={0} len={6} height={2.6} />
      <WallSegment pos={[3, 0, -6]} rot={0} len={6} height={2.6} />
      <WallSegment pos={[-7, 0, -3]} rot={Math.PI / 2} len={6} height={2.6} />
      <WallSegment pos={[7, 0, -3]} rot={Math.PI / 2} len={6} height={2.6} />
      <BrokenWall pos={[-1, 0, -6.4]} rot={0.1} len={2} height={1.0} />
      <BrokenWall pos={[5, 0, -6.2]} rot={-0.2} len={1.6} height={0.7} />
    </group>
  );
}

function WallSegment({ pos, rot, len, height }: { pos: [number, number, number]; rot: number; len: number; height: number }) {
  const mat = useMemo(() => makeStoneMaterial(0), []);
  const matDark = useMemo(() => makeStoneMaterial(0.6), []);
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {/* Main wall body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, height, 0.5]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Top trim — a slightly lighter band */}
      <mesh position={[0, height + 0.05, 0]} castShadow>
        <boxGeometry args={[len + 0.05, 0.1, 0.55]} />
        <primitive object={matDark} attach="material" />
      </mesh>
      {/* Crenellations: 4 small blocks on top, with one missing for
          a "broken" look */}
      {Array.from({ length: Math.floor(len / 0.7) }, (_, i) => i).map((i) => {
        const cx = -len / 2 + 0.35 + i * 0.7;
        // Skip every 3rd to suggest damage
        if (i % 3 === 1) return null;
        return (
          <mesh key={i} position={[cx, height + 0.22, 0]} castShadow>
            <boxGeometry args={[0.4, 0.32, 0.5]} />
            <primitive object={mat} attach="material" />
          </mesh>
        );
      })}
      {/* Arrow slit — a thin dark gap in the wall */}
      <mesh position={[len / 4, height * 0.55, 0.26]}>
        <boxGeometry args={[0.1, 0.7, 0.02]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      {/* Base step at the foot of the wall */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[len + 0.1, 0.2, 0.7]} />
        <primitive object={matDark} attach="material" />
      </mesh>
    </group>
  );
}

function BrokenWall({ pos, rot, len, height }: { pos: [number, number, number]; rot: number; len: number; height: number }) {
  const mat = useMemo(() => makeStoneMaterial(0.3), []);
  // A wall section that has collapsed — rendered as scattered blocks
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[len, height, 0.4]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Half-collapsed extra blocks at the base */}
      <mesh position={[0.6, 0.15, 0.2]} rotation={[0.3, 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.7, 0.3, 0.4]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[-0.5, 0.1, 0.15]} rotation={[-0.1, -0.4, 0.05]} castShadow>
        <boxGeometry args={[0.5, 0.2, 0.4]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}

function CornerTower() {
  const mat = useMemo(() => makeStoneMaterial(-0.1), []);
  const matDark = useMemo(() => makeStoneMaterial(0.5), []);
  return (
    <group position={[8, 0, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 3.2, 1.5]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Arrow slits */}
      {[0.4, 1.2, 2.0, 2.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0.76]}>
          <boxGeometry args={[0.08, 0.5, 0.02]} />
          <meshBasicMaterial color="#0a0a0a" />
        </mesh>
      ))}
      {/* Crenellated top */}
      {[0, 0.5, 1.0].map((z, i) => (
        <mesh key={i} position={[-0.6, 3.3, z]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.3]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
      {[0, 0.5, 1.0].map((z, i) => (
        <mesh key={`r${i}`} position={[0.6, 3.3, z]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.3]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
      {/* Dark roof cap */}
      <mesh position={[0, 3.55, 0]} castShadow>
        <boxGeometry args={[1.6, 0.1, 1.6]} />
        <primitive object={matDark} attach="material" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Debris — small rubble around the edges
// ---------------------------------------------------------------------------
function Debris() {
  const positions: { pos: [number, number, number]; rot: number; scale: number }[] = [
    { pos: [-6.5, 0.1, 1.5], rot: 0.4, scale: 0.4 },
    { pos: [6.5, 0.1, 1.8], rot: -0.3, scale: 0.35 },
    { pos: [-6, 0.1, -1], rot: 1.2, scale: 0.3 },
    { pos: [6, 0.1, -1.2], rot: 0.8, scale: 0.45 },
    { pos: [-3, 0.1, 4.5], rot: 0.1, scale: 0.5 },
    { pos: [3, 0.1, 4.8], rot: -0.5, scale: 0.4 },
    { pos: [-4, 0.1, -5.5], rot: 0.7, scale: 0.35 },
    { pos: [4.5, 0.1, -5.3], rot: -0.9, scale: 0.4 },
    { pos: [-1, 0.1, 5.5], rot: 0.3, scale: 0.3 },
    { pos: [1, 0.1, 5.3], rot: -0.2, scale: 0.35 },
  ];
  return (
    <group>
      {positions.map((d, i) => (
        <mesh
          key={i}
          position={d.pos}
          rotation={[0, d.rot, 0]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[d.scale, 0]} />
          <meshStandardMaterial color="#4a4138" roughness={1.0} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Haze — slow drifting dust motes
// ---------------------------------------------------------------------------
function HazeParticles() {
  const ref = useRef<THREE.Points>(null!);
  const flame = useMemo(() => getFlameSpriteMap(), []);
  const count = 60;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 6;
      arr[i * 3 + 0] = Math.cos(angle) * r;
      arr[i * 3 + 1] = 0.3 + Math.random() * 2.5;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3 + 0] + Math.sin(t * 0.2 + i) * 0.3;
      const y = positions[i * 3 + 1] + Math.sin(t * 0.15 + i * 0.7) * 0.2;
      const z = positions[i * 3 + 2] + Math.cos(t * 0.2 + i) * 0.3;
      ref.current.geometry.attributes.position.setXYZ(i, x, y, z);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        color="#c8b89a"
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={flame}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
//  Torches — wood pole + iron bracket + multi-layer flame + smoke wisp +
//  dynamic point light
// ---------------------------------------------------------------------------
function Torches() {
  const positions: [number, number][] = [
    [-4.5, -3.2], [4.5, -3.2], [-4.5, 3.2], [4.5, 3.2],
  ];
  return (
    <group>
      {positions.map((p, i) => (
        <Torch key={i} pos={p} seed={i} />
      ))}
    </group>
  );
}

function Torch({ pos, seed }: { pos: [number, number]; seed: number }) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const flameRef = useRef<THREE.Group>(null!);
  const smokeRef = useRef<THREE.Sprite>(null!);
  const flameTex = useMemo(() => getFlameSpriteMap(), []);
  const smokeTex = useMemo(() => getSmokeSpriteMap(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Realistic flame flicker — multiple noise bands at different freqs
    const flicker =
      0.85 +
      0.15 * Math.sin(t * 8.0 + seed * 1.3) +
      0.08 * Math.sin(t * 13.7 + seed * 2.1) +
      0.05 * Math.sin(t * 23.1 + seed * 0.7);
    if (lightRef.current) lightRef.current.intensity = 2.4 * flicker;
    if (flameRef.current) {
      flameRef.current.scale.set(0.95 + 0.1 * Math.sin(t * 6 + seed), 0.95 + 0.15 * Math.sin(t * 4 + seed * 0.5), 0.95 + 0.1 * Math.sin(t * 5 + seed));
      flameRef.current.rotation.y = Math.sin(t * 1.3 + seed) * 0.15;
    }
    if (smokeRef.current) {
      // Smoke rises and fades
      const phase = (t * 0.4 + seed * 0.7) % 4.0;
      smokeRef.current.position.y = 1.95 + phase * 0.6;
      smokeRef.current.material.opacity = 0.45 * (1 - phase / 4.0);
      smokeRef.current.scale.setScalar(0.5 + phase * 0.18);
    }
  });

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* Wooden pole */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 1.7, 8]} />
        <meshStandardMaterial color="#3d2a1a" roughness={0.95} />
      </mesh>
      {/* Iron bracket */}
      <mesh position={[0.13, 1.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.08, 0.08]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Cup at the top of the bracket */}
      <mesh position={[0.13, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Flame — multi-layer sprite planes for a more volumetric look */}
      <group ref={flameRef} position={[0.13, 1.85, 0]}>
        {/* Outer flame shell */}
        <mesh>
          <planeGeometry args={[0.6, 0.9]} />
          <meshBasicMaterial
            map={flameTex}
            color="#ff7020"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Mid flame */}
        <mesh>
          <planeGeometry args={[0.38, 0.7]} />
          <meshBasicMaterial
            map={flameTex}
            color="#ffb040"
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner core */}
        <mesh>
          <planeGeometry args={[0.22, 0.45]} />
          <meshBasicMaterial
            map={flameTex}
            color="#fff0a0"
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* Point light — flickers realistically with the flame */}
      <pointLight
        ref={lightRef}
        position={[0.13, 1.85, 0]}
        intensity={2.4}
        color="#ff9540"
        distance={9}
        decay={1.4}
        castShadow={false}
      />
      {/* Smoke wisp — rises and fades */}
      <sprite ref={smokeRef} position={[0.13, 2.0, 0]} scale={[0.6, 0.6, 0.6]}>
        <spriteMaterial
          map={smokeTex}
          color="#5a5048"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
