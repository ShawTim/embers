import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export function DamageNumbers({ numbers, onDone }: { numbers: { id: number; position: [number, number, number]; amount: number; isCrit: boolean; isHeal: boolean; isMiss: boolean }[]; onDone: (id: number) => void }) {
  return <>{numbers.map(n => <FloatNum key={n.id} data={n} onDone={() => onDone(n.id)} />)}</>;
}

function FloatNum({ data, onDone }: { data: { id: number; position: [number, number, number]; amount: number; isCrit: boolean; isHeal: boolean; isMiss: boolean }; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef(Date.now());
  const [done, setDone] = useState(false);
  const { camera } = useThree();
  useEffect(() => { const d = data.isCrit ? 1500 : 1000; const t = setTimeout(() => { setDone(true); onDone(); }, d); return () => clearTimeout(t); }, []);
  useFrame(() => { const e = Date.now() - start.current; const d = data.isCrit ? 1500 : 1000; const p = e / d; if (ref.current) { ref.current.position.y = data.position[1] + p * 1.5; ref.current.position.x = data.position[0] + Math.sin(p*3)*0.2; ref.current.lookAt(camera.position); } });
  if (done) return null;
  const text = data.isMiss ? "MISS" : (data.isHeal ? "+" : "") + data.amount;
  const color = data.isMiss ? "#aaa" : data.isHeal ? "#3aff3a" : data.isCrit ? "#ff3333" : "#ffffff";
  const fs = data.isCrit ? 64 : 40;
  const tex = makeTex(text, color, fs);
  return <group ref={ref} position={data.position}><sprite scale={[data.isCrit?1.2:0.8, data.isCrit?0.6:0.4, 1]}><spriteMaterial map={tex} transparent depthTest={false} /></sprite></group>;
}

const cache = new Map<string, THREE.Texture>();
function makeTex(text: string, color: string, fs: number): THREE.Texture {
  const key = `${text}_${color}_${fs}`;
  if (cache.has(key)) return cache.get(key)!;
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!; ctx.font = `bold ${fs}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000"; ctx.lineWidth = 6; ctx.strokeText(text, 128, 64); ctx.fillStyle = color; ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; cache.set(key, tex); return tex;
}
