import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export function CombatEffects({ effects, onDone }: { effects: { id: number; position: [number, number, number]; isCrit: boolean }[]; onDone: (id: number) => void }) {
  return <>{effects.map(e => <HitBurst key={e.id} data={e} onDone={() => onDone(e.id)} />)}</>;
}

function HitBurst({ data, onDone }: { data: { id: number; position: [number, number, number]; isCrit: boolean }; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const parts = useRef<THREE.Mesh[]>([]);
  const start = useRef(Date.now());
  const [done, setDone] = useState(false);
  const n = data.isCrit ? 20 : 10;
  useEffect(() => { const t = setTimeout(() => { setDone(true); onDone(); }, data.isCrit ? 800 : 500); return () => clearTimeout(t); }, []);
  useFrame(() => { const e = (Date.now() - start.current) / 1000; const d = data.isCrit ? 0.8 : 0.5; const p = e / d; if (ref.current) ref.current.scale.setScalar(1 + p * 2); for (let i = 0; i < parts.current.length; i++) { const m = parts.current[i]; if (!m) continue; const a = (i / n) * Math.PI * 2; const s = data.isCrit ? 2 : 1.2; m.position.x = Math.cos(a)*s*p; m.position.z = Math.sin(a)*s*p; m.position.y = Math.sin(p*Math.PI)*0.8; (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1-p); } });
  if (done) return null;
  const c = data.isCrit ? "#ff3333" : "#ffaa33";
  return <group ref={ref} position={data.position}><mesh><sphereGeometry args={[0.3, 8, 6]} /><meshBasicMaterial color={c} transparent opacity={0.6} /></mesh>{Array.from({length:n}).map((_,i) => <mesh key={i} ref={el => { if (el) parts.current[i] = el; }}><boxGeometry args={[0.08,0.08,0.08]} /><meshBasicMaterial color={c} transparent /></mesh>)}{data.isCrit && <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.1,0]}><ringGeometry args={[0.3,0.5,16]} /><meshBasicMaterial color="#ff0000" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>}</group>;
}
