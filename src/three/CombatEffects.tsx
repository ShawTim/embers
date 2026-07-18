import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface CombatEffect {
  id: number;
  position: [number, number, number];
  isCrit: boolean;
  weaponType?: string;   // e.g. "fire" | "ice" | "lightning" | "dark" | "lance" | "axe" | "sword" | "bow" | "staff" | "thunder" | "wind"
}

export function CombatEffects({ effects, onDone }: { effects: CombatEffect[]; onDone: (id: number) => void }) {
  return <>{effects.map(e => <HitBurst key={e.id} data={e} onDone={() => onDone(e.id)} />)}</>;
}

// ---------------------------------------------------------------------------
//  Per-weapon color palette.  Mirrors `colorForWeapon` in Projectile.ts so
//  the impact and the projectile look like the same spell.  Crit always
//  saturates toward red for an extra punch.
// ---------------------------------------------------------------------------
function paletteFor(wt?: string, crit = false) {
  const core = (() => {
    switch (wt) {
      case "fire":    return "#ff5530";
      case "light":   return "#fff5b0";
      case "thunder": return "#fff060";
      case "dark":    return "#a040d0";
      case "lance":   return "#a0d0ff";
      case "axe":     return "#ff8030";
      case "bow":     return "#d8b070";
      case "staff":   return "#3aff8a";
      case "wind":    return "#a0ffd0";
      case "sword":   return "#ffe080";
      default:        return "#ffaa33";
    }
  })();
  return { core, ring: crit ? "#ff3030" : core };
}

function HitBurst({ data, onDone }: { data: CombatEffect; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const parts = useRef<THREE.Mesh[]>([]);
  const ringRef = useRef<THREE.Mesh>(null);
  const shardsRef = useRef<THREE.Mesh[]>([]);
  const start = useRef(Date.now());
  const [done, setDone] = useState(false);
  const n = data.isCrit ? 24 : 14;
  const dur = data.isCrit ? 0.9 : 0.55;
  useEffect(() => { const t = setTimeout(() => { setDone(true); onDone(); }, dur * 1000 + 60); return () => clearTimeout(t); }, []);
  useFrame(() => {
    const e = (Date.now() - start.current) / 1000;
    const p = Math.min(1, e / dur);
    if (ref.current) ref.current.scale.setScalar(1 + p * 1.8);
    for (let i = 0; i < parts.current.length; i++) {
      const m = parts.current[i];
      if (!m) continue;
      const a = (i / n) * Math.PI * 2;
      const s = data.isCrit ? 2.2 : 1.4;
      m.position.x = Math.cos(a) * s * p;
      m.position.z = Math.sin(a) * s * p;
      m.position.y = Math.sin(p * Math.PI) * 0.8;
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p);
    }
    // Shards (for ice / dark / lightning) — slower expansion, slightly later
    for (let i = 0; i < shardsRef.current.length; i++) {
      const m = shardsRef.current[i];
      if (!m) continue;
      const a = (i / shardsRef.current.length) * Math.PI * 2 + p * 0.6;
      const r = 0.4 + p * 1.2;
      m.position.x = Math.cos(a) * r;
      m.position.z = Math.sin(a) * r;
      m.position.y = 0.3 + Math.sin(p * Math.PI) * 0.6;
      m.rotation.x += 0.05;
      m.rotation.y += 0.07;
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p);
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      const s = 1 + p * (data.isCrit ? 2.4 : 1.4);
      ringRef.current.scale.set(s, s, s);
      mat.opacity = Math.max(0, 0.7 * (1 - p));
    }
  });
  if (done) return null;
  const { core, ring } = paletteFor(data.weaponType, data.isCrit);

  // Per-weapon variant: ice / dark / lightning get extra shards.
  const isShardy = data.weaponType === "ice" || data.weaponType === "wind" || data.weaponType === "dark" || data.weaponType === "thunder" || data.weaponType === "light";
  const shardColor = data.weaponType === "dark" ? "#c080ff"
    : data.weaponType === "thunder" || data.weaponType === "light" ? "#fffce0"
    : "#cfeaff";

  return (
    <group ref={ref} position={data.position}>
      <mesh>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshBasicMaterial color={core} transparent opacity={0.7} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.3, 0.5, 18]} />
        <meshBasicMaterial color={ring} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: n }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) parts.current[i] = el; }}
        >
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshBasicMaterial color={core} transparent />
        </mesh>
      ))}
      {isShardy && Array.from({ length: data.isCrit ? 8 : 5 }).map((_, i) => (
        <mesh
          key={`sh-${i}`}
          ref={(el) => { if (el) shardsRef.current[i] = el; }}
        >
          {data.weaponType === "thunder" || data.weaponType === "light" ? (
            <boxGeometry args={[0.04, 0.32, 0.04]} />
          ) : (
            <tetrahedronGeometry args={[0.12, 0]} />
          )}
          <meshBasicMaterial color={shardColor} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
