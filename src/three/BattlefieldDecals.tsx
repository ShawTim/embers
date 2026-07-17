import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";

// ---------------------------------------------------------------------------
//  BattlefieldDecals — two short-lived ground decals:
//    - blood:    a dark crimson splat under a unit that just died
//    - heal:     a green pulse that radiates outward and fades
//
//  We pool a single InstancedMesh of 32 slots and walk it every frame
//  to pick the oldest decal type for each slot.  The store keeps a
//  small list of live decals; we just need to draw them.
// ---------------------------------------------------------------------------

const MAX = 32;
const BLOOD_DURATION = 30;   // 30s on the ground
const HEAL_DURATION = 1.4;   // pulse that fades fast

interface Decal {
  id: number;
  x: number;
  z: number;
  born: number;
  kind: "blood" | "heal";
}

export function BattlefieldDecals() {
  const bloodDecals = useGame((s) => s.bloodDecals);
  const healAuras = useGame((s) => s.healAuras);
  const removeBlood = useGame((s) => s.removeBloodDecal);
  const removeHeal = useGame((s) => s.removeHealAura);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorTmp = useMemo(() => new THREE.Color(), []);

  // Build the geometry and material once.  The material uses
  // per-instance colors so we can mix blood and heal decals in the
  // same mesh.
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(1, 24);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      }),
    [],
  );

  // Initialise the instance color buffer and park every instance far
  // below the floor so the first frame doesn't show a stack of discs
  // at the origin.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX * 3),
        3,
      );
    }
    dummy.position.set(0, -1000, 0);
    dummy.scale.set(0.0001, 0.0001, 0.0001);
    dummy.updateMatrix();
    for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.count = MAX;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const now = performance.now() / 1000;

    // Build a single flat list of live decals and sort newest-first
    // so the cap is on the oldest entries.  We mutate the store from
    // here so cap-expired decals are removed.
    const list: Decal[] = [];
    for (const b of bloodDecals) {
      const age = now - b.born;
      if (age >= BLOOD_DURATION) { removeBlood(b.id); continue; }
      list.push({ id: b.id, x: b.position[0], z: b.position[2], born: b.born, kind: "blood" });
    }
    for (const h of healAuras) {
      const age = now - h.born;
      if (age >= HEAL_DURATION) { removeHeal(h.id); continue; }
      list.push({ id: h.id, x: h.position[0], z: h.position[2], born: h.born, kind: "heal" });
    }
    // Newest first (cap removes oldest)
    list.sort((a, b) => b.born - a.born);
    const shown = list.slice(0, MAX);

    for (let i = 0; i < MAX; i++) {
      if (i < shown.length) {
        const d = shown[i];
        const age = now - d.born;
        if (d.kind === "blood") {
          // Static dark crimson splotch that sits on the floor.
          dummy.position.set(d.x, 0.20, d.z);
          const r = 0.45;
          dummy.scale.set(r, 1, r);
          dummy.rotation.set(0, d.id * 0.317, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          // Dark crimson, slight darken as it dries.
          const dry = 1 - age / BLOOD_DURATION;
          colorTmp.setRGB(0.35 * dry + 0.10, 0.04, 0.04);
          mesh.setColorAt(i, colorTmp);
        } else {
          // Heal: green ring expanding outward and fading.
          const t = age / HEAL_DURATION;
          const r = 0.25 + t * 0.85;
          dummy.position.set(d.x, 0.21, d.z);
          dummy.scale.set(r, 1, r);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          // Bright green fading to transparent (we can't fade alpha
          // per-instance easily, so we fade the colour).
          const fade = 1 - t;
          colorTmp.setRGB(0.22 * fade, 1.0 * fade, 0.30 * fade);
          mesh.setColorAt(i, colorTmp);
        }
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
