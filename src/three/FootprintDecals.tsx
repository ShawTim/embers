import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";

// ---------------------------------------------------------------------------
//  FootprintDecals — fades in a soft round shadow under each unit when
//  they move, then dissipates the trail over ~2s.  Implemented as a
//  single InstancedMesh so the per-tile cost is negligible.
//
//  We hook into the `lastMove` field on the game store: any time a
//  unit's pos changes, we record the source and destination tiles
//  and the current time.  Each frame we walk the recorded moves
//  and update the instance opacity + lifetime.
// ---------------------------------------------------------------------------

const MAX_DECALS = 64;
const DURATION = 2.4; // seconds visible

interface DecalEntry {
  uid: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  born: number;
  faction: string;
}

export function FootprintDecals() {
  const units = useGame((s) => s.units);
  const lastSeenPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  const entries = useRef<DecalEntry[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [, force] = useState(0);

  // Color per faction (matches FACTION_COLOR in Unit3D)
  const FACTION_COLOR: Record<string, THREE.Color> = {
    player: new THREE.Color("#3a6ad8"),
    enemy: new THREE.Color("#d83a3a"),
    ally: new THREE.Color("#3ad83a"),
    neutral: new THREE.Color("#d8d83a"),
  };

  // When a unit's pos changes, record a footprint entry.
  useEffect(() => {
    const ls = lastSeenPos.current;
    const now = performance.now() / 1000;
    for (const u of units) {
      if (u.isDead) continue;
      const prev = ls.get(u.uid);
      if (!prev) {
        ls.set(u.uid, { x: u.pos.x, y: u.pos.y });
        continue;
      }
      if (prev.x !== u.pos.x || prev.y !== u.pos.y) {
        entries.current.push({
          uid: u.uid,
          fromX: prev.x,
          fromZ: prev.y,
          toX: u.pos.x,
          toZ: u.pos.y,
          born: now,
          faction: u.faction,
        });
        // Cap stored entries
        if (entries.current.length > MAX_DECALS) {
          entries.current.splice(0, entries.current.length - MAX_DECALS);
        }
        ls.set(u.uid, { x: u.pos.x, y: u.pos.y });
        force((n) => n + 1);
      }
    }
  }, [units]);

  // Per-frame: position + opacity update
  const dummy = useRef(new THREE.Object3D()).current;
  const colorTmp = useRef(new THREE.Color()).current;
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const now = performance.now() / 1000;
    // Remove expired
    entries.current = entries.current.filter((e) => now - e.born < DURATION);
    const n = entries.current.length;
    for (let i = 0; i < n; i++) {
      const e = entries.current[i];
      const age = (now - e.born) / DURATION;
      // Lerp from source to destination across the lifetime
      const t = Math.min(1, age * 2);
      const x = e.fromX + (e.toX - e.fromX) * t;
      const z = e.fromZ + (e.toZ - e.fromZ) * t;
      dummy.position.set(x, 0.04, z);
      // Fade out: hold 0..0.4 then fall to 0
      const fade = age < 0.4 ? age / 0.4 : 1 - (age - 0.4) / 0.6;
      const scale = 0.5 + 0.3 * Math.sin(age * Math.PI) + 0.05;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = FACTION_COLOR[e.faction] || FACTION_COLOR.neutral;
      colorTmp.copy(c).multiplyScalar(0.7);
      mesh.setColorAt(i, colorTmp);
    }
    // Hide unused instances by moving them far below
    for (let i = n; i < MAX_DECALS; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = MAX_DECALS;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Mesh material has transparent:true, but InstancedMesh doesn't
    // accept per-instance opacity easily — the fade is done via the
    // instance scale shrinking to zero instead.
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_DECALS]}
      frustumCulled={false}
      renderOrder={1}
    >
      <circleGeometry args={[0.5, 24]} />
      <meshBasicMaterial
        transparent
        opacity={0.55}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
