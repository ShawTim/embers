import { useRef, useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { DialogueLine } from "../data/dialogues";
import type { Lang } from "../i18n";
import { unitName } from "../i18n";
import { MODEL_PATHS } from "../three/Unit3D";

const MOOD_COLORS: Record<string, string> = {
  neutral: "#8ab", angry: "#f66", sad: "#68a", determined: "#6c6", surprised: "#fc6", happy: "#6f6",
};

// Animation rig paths — we run the Idle_A clip on the portrait model
// so it doesn't display in T-pose / A-pose. The same animation
// collections are used by Unit3D.
const IDLE_RIG = import.meta.env.BASE_URL + "models/animations/Rig_Medium_General.glb";
useGLTF.preload(IDLE_RIG);

export function Portrait3D({ modelId, mood }: { modelId: string; mood?: string }) {
  const path = MODEL_PATHS[modelId] || MODEL_PATHS.Knight;
  return (
    <div className="portrait-3d-container" style={{ borderColor: MOOD_COLORS[mood || "neutral"] }}>
      <Canvas
        camera={{ position: [0, 1.0, 1.6], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
      >
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
  const idleGltf = useGLTF(IDLE_RIG);
  const { camera } = useThree();
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

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
    // Scale and place the model on the ground. We then compute the
    // world-space head position (top of the bbox) and point the
    // camera at it. This way the framing works regardless of how
    // tall the original GLB is.
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.6 / Math.max(size.y, 0.01);
    c.scale.setScalar(s);
    c.position.set(
      -box.getCenter(new THREE.Vector3()).x * s,
      -box.min.y * s,
      -box.getCenter(new THREE.Vector3()).z * s,
    );
    c.rotation.y = 0.3;
    c.updateMatrixWorld(true);
    // Aim the camera at the head, which is roughly the top of the
    // scaled bbox. The camera is at a fixed distance 1.6 from the
    // origin; we tilt it up to look at the head.
    const headY = box.max.y * s - box.min.y * s;
    camera.position.set(0, headY * 0.85, 1.6);
    camera.lookAt(0, headY * 0.7, 0);

    const idleClip = idleGltf.animations.find((a) => a.name === "Idle_A");
    if (idleClip) {
      const mixer = new THREE.AnimationMixer(c);
      const action = mixer.clipAction(idleClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      mixerRef.current = mixer;
    }

    setObj(c);
    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [gltf, idleGltf, camera]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!obj) return null;
  return <primitive object={obj} />;
}
