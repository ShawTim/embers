import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODEL_PATHS } from "../three/Unit3D";
import { UNITS } from "../data/gameData";

// Mood presets: per-mood rim/key/fill lights + ambient + background tint.
const MOOD_PRESETS: Record<string, {
  key: string; keyInt: number;
  fill: string; fillInt: number;
  rim: string; rimInt: number;
  ambient: string; ambientInt: number;
  bgTop: string; bgBottom: string;
  border: string;
  speakerColor: string;
  shake: number;
}> = {
  neutral: {
    key: "#ffe8c0", keyInt: 1.2, fill: "#6080a0", fillInt: 0.4,
    rim: "#a0c0ff", rimInt: 0.4, ambient: "#c0d0e0", ambientInt: 0.8,
    bgTop: "rgba(40,55,80,0.85)", bgBottom: "rgba(8,12,20,0.95)",
    border: "#446", speakerColor: "#8cf", shake: 0,
  },
  angry: {
    key: "#ff5040", keyInt: 1.6, fill: "#802020", fillInt: 0.6,
    rim: "#ff8030", rimInt: 0.8, ambient: "#ff8060", ambientInt: 0.6,
    bgTop: "rgba(80,30,20,0.85)", bgBottom: "rgba(20,5,5,0.95)",
    border: "#f44", speakerColor: "#f66", shake: 0.05,
  },
  sad: {
    key: "#a0b0d0", keyInt: 0.9, fill: "#5060a0", fillInt: 0.5,
    rim: "#80a0d0", rimInt: 0.5, ambient: "#a0b0c0", ambientInt: 0.7,
    bgTop: "rgba(30,40,70,0.85)", bgBottom: "rgba(8,12,20,0.95)",
    border: "#68a", speakerColor: "#68a", shake: 0,
  },
  determined: {
    key: "#fff0c0", keyInt: 1.5, fill: "#60a060", fillInt: 0.5,
    rim: "#80ff80", rimInt: 0.5, ambient: "#d0e0c0", ambientInt: 0.7,
    bgTop: "rgba(40,60,40,0.85)", bgBottom: "rgba(10,15,10,0.95)",
    border: "#6c6", speakerColor: "#6c6", shake: 0,
  },
  surprised: {
    key: "#fff0a0", keyInt: 1.4, fill: "#a08020", fillInt: 0.5,
    rim: "#ffe060", rimInt: 0.6, ambient: "#ffe0a0", ambientInt: 0.7,
    bgTop: "rgba(80,70,30,0.85)", bgBottom: "rgba(20,15,5,0.95)",
    border: "#fc6", speakerColor: "#fc6", shake: 0.02,
  },
  happy: {
    key: "#fff8c0", keyInt: 1.3, fill: "#80c060", fillInt: 0.5,
    rim: "#a0ff80", rimInt: 0.5, ambient: "#d0e0c0", ambientInt: 0.8,
    bgTop: "rgba(50,70,40,0.85)", bgBottom: "rgba(10,18,8,0.95)",
    border: "#6f6", speakerColor: "#6f6", shake: 0,
  },
};

// Animation rig — same as Unit3D.  Keep the portrait model animated so it
// doesn't stand in T-pose.
const IDLE_RIG = import.meta.env.BASE_URL + "models/animations/Rig_Medium_General.glb";
// Note: IDLE_RIG is already preloaded by App.tsx as part of the
// animation rig set. We do not call useGLTF.preload here to avoid
// duplicate downloads.

export interface PortraitProps {
  modelId: string;
  unitId?: string;          // when present, pull portraitColor from UNITS[unitId]
  mood?: string;
  /** Optional name plate overlay (e.g. speaker name) */
  namePlate?: string;
  /** Optional title shown under the name plate */
  title?: string;
}

export function Portrait3D({ modelId, unitId, mood, namePlate, title }: PortraitProps) {
  const path = MODEL_PATHS[modelId] || MODEL_PATHS.Knight;
  const preset = MOOD_PRESETS[mood || "neutral"] || MOOD_PRESETS.neutral;
  const unitColor = unitId ? UNITS[unitId]?.portraitColor : undefined;
  const shakeRef = useRef(0);

  // Continuous gentle shake for surprised/angry
  useEffect(() => {
    shakeRef.current = preset.shake;
  }, [preset.shake]);

  return (
    <div
      className="portrait-3d-container"
      style={{
        borderColor: preset.border,
        background: `radial-gradient(ellipse at center, ${preset.bgTop} 0%, ${preset.bgBottom} 100%)`,
      }}
    >
      <Canvas
        camera={{ position: [0, 1.0, 1.6], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={preset.ambientInt} color={preset.ambient} />
        <directionalLight position={[2, 3, 2]} intensity={preset.keyInt} color={preset.key} />
        <directionalLight position={[-2, 1, 1]} intensity={preset.fillInt} color={preset.fill} />
        <directionalLight position={[0, 2, -3]} intensity={preset.rimInt} color={preset.rim} />
        {unitColor && <AccentLight color={unitColor} />}
        <PortraitModel path={path} shake={preset.shake} />
      </Canvas>
      {/* Mood aura — animated glow on the portrait edges */}
      <div className="portrait-aura" style={{ background: `radial-gradient(ellipse at 50% 80%, ${preset.border}33 0%, transparent 70%)` }} />
      {namePlate && (
        <div className="portrait-nameplate">
          <div className="portrait-name" style={{ color: preset.speakerColor, textShadow: `0 0 12px ${preset.speakerColor}66` }}>{namePlate}</div>
          {title && <div className="portrait-title">{title}</div>}
        </div>
      )}
    </div>
  );
}

// Soft coloured point light tinted to the unit's portrait color — gives
// each character a distinct "energy" without changing the model's texture.
function AccentLight({ color }: { color: string }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((s) => {
    if (ref.current) ref.current.intensity = 0.5 + Math.sin(s.clock.elapsedTime * 1.6) * 0.15;
  });
  return <pointLight ref={ref} position={[0, 0.4, 1.0]} color={color} intensity={0.5} distance={2.5} decay={2} />;
}

function PortraitModel({ path, shake }: { path: string; shake: number }) {
  const gltf = useGLTF(path);
  const idleGltf = useGLTF(IDLE_RIG);
  const { camera } = useThree();
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);

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
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.6 / Math.max(size.y, 0.01);
    c.scale.setScalar(s);
    c.position.set(
      -box.getCenter(new THREE.Vector3()).x * s,
      -box.min.y * s,
      -box.getCenter(new THREE.Vector3()).z * s,
    );
    c.rotation.y = 0.25;
    c.updateMatrixWorld(true);
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

  useFrame((s, delta) => {
    mixerRef.current?.update(delta);
    // Gentle bob + slow Y rotation for life; anger/surprise adds shake
    if (obj) {
      const t = s.clock.elapsedTime;
      obj.position.y = Math.sin(t * 1.1) * 0.012;
      obj.rotation.y = 0.25 + Math.sin(t * 0.4) * 0.04;
      if (shake > 0) {
        // Continuous shake using sin + cos so the motion is smooth rather
        // than the frame-by-frame random jump that looks like a seizure.
        // Anger uses a faster, wider frequency than surprise.
        const freq = shake > 0.03 ? 28 : 18;
        obj.position.x = (Math.sin(t * freq) + Math.sin(t * (freq * 1.3) + 1.7)) * shake * 0.5;
        obj.position.z = (Math.cos(t * (freq * 0.8) + 0.9) - Math.sin(t * freq * 1.7)) * shake * 0.5;
        obj.rotation.z = Math.sin(t * freq * 1.4) * shake * 0.4;
      }
    }
  });

  if (!obj) return null;
  return <primitive object={obj} />;
}
