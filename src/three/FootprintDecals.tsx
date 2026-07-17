import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../game/store";

// ---------------------------------------------------------------------------
//  FootprintDecals — fades in a soft round shadow under each unit when
//  they move, then dissipates the trail over ~2.4s.  Implemented as a
//  single InstancedMesh so the per-tile cost is negligible.
//
//  We poll the game store's `units` array: when a unit's pos changes
//  we record the source and destination tiles plus the current time.
//  Each frame we walk the recorded moves and update the instance
//  position, scale and color.
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
      // Quick 0.3s lerp from source to destination, then sit at
      // destination for the rest of the lifetime.
      const t = Math.min(1, age * 3.3);
      const x = e.fromX + (e.toX - e.fromX) * t;
      const z = e.fromZ + (e.toZ - e.fromZ) * t;
      // Sit just above the tile surface. Tiles render up to y=0.18
      // (PBR y-offset on thick tiles), so y=0.20 keeps the decal
      // reliably above all tile surfaces.
      dummy.position.set(x, 0.20, z);
      // Soft pop-in: starts small, grows to full size, then fades.
      const grow = Math.min(1, age * 6);
      const fade = 1 - age;
      const radius = 0.45 * grow;
      dummy.scale.set(radius, radius, radius);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = FACTION_COLOR[e.faction] || FACTION_COLOR.neutral;
      // Bake the fade into the per-instance brightness (alpha is the
      // material's transparent opacity, but the discs read better when
      // they darken into the floor as they age).
      colorTmp.copy(c).multiplyScalar(0.4 + 0.6 * fade);
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
  });

  // Build the geometry and material once. Sharing them across the
  // InstancedMesh is the cheapest way to render 64 decals.
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(1, 24);
    g.rotateX(-Math.PI / 2); // bake the floor-rotation into the geo
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // Faction-tinted soft disc, drawn on top of tiles (no depth
        // test) so the player can read unit trails at a glance. We
        // keep depthWrite off so the disc doesn't poke through walls
        // it overlaps.
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      }),
    [],
  );

  // Allocate the per-instance color buffer once (the constructor does
  // *not* do this for you).  Without it, the first setColorAt() is a
  // silent no-op, which is exactly the bug we were chasing.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_DECALS * 3),
        3,
      );
    }
    // Push every instance far below the floor until a real entry
    // comes in — otherwise the very first frame shows 64 magenta
    // discs at the origin.
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -1000, 0);
    dummy.scale.set(0.0001, 0.0001, 0.0001);
    dummy.updateMatrix();
    for (let i = 0; i < MAX_DECALS; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = MAX_DECALS;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_DECALS]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
