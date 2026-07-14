import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { DialogueLine } from "../data/dialogues";
import type { Lang } from "../i18n";
import { unitName } from "../i18n";
import { MODEL_PATHS } from "../three/Unit3D";

const MOOD_COLORS: Record<string, string> = {
  neutral: "#8ab", angry: "#f66", sad: "#68a", determined: "#6c6", surprised: "#fc6", happy: "#6f6",
};

export function Portrait3D({ modelId, mood }: { modelId: string; mood?: string }) {
  const path = MODEL_PATHS[modelId] || MODEL_PATHS.Knight;
  return (
    <div className="portrait-3d-container" style={{ borderColor: MOOD_COLORS[mood || "neutral"] }}>
      <Canvas camera={{ position: [0, 0.8, 2.5], fov: 35 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.8} color="#c0d0e0" />
        <directionalLight position={[2, 3, 2]} intensity={1.2} color="#ffe8c0" />
        <directionalLight position={[-2, 1, 1]} intensity={0.4} color="#6080a0" />
        <PortraitModel path={path} />
      </Canvas>
    </div>
  );
}

function PortraitModel({ path }: { path: string }) {
  const gltf = useGLTF(path);
  const [obj, setObj] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    const c = cloneSkeleton(gltf.scene);
    c.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        if (["shield","sword","offhand","bow","staff","wand","dagger","axe","mug","spellbook","crossbow"].some(k => name.includes(k))) {
          child.visible = false;
        } else {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      }
    });
    // Center and scale to fill portrait
    const box = new THREE.Box3();
    c.traverse((child: any) => { if (child instanceof THREE.Mesh && child.visible) box.expandByObject(child); });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = 1.8 / Math.max(size.y, 0.01);
    c.scale.setScalar(s);
    c.position.set(-center.x * s, -box.min.y * s + 0.1, -center.z * s);
    c.rotation.y = 0.3;
    setObj(c);
  }, [gltf]);

  if (!obj) return null;
  return <primitive object={obj} />;
}
