import { useState, useEffect, useRef } from "react";
import { useGame } from "./game/store";
import { Scene } from "./three/Scene";
import { LandingScene } from "./three/LandingScene";
import { HUD } from "./ui/HUD";
import { DialogueBox } from "./ui/DialogueBox";
import { BossEntrance } from "./ui/BossEntrance";
import { LangToggle } from "./ui/LangToggle";
import { t } from "./i18n";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const B = import.meta.env.BASE_URL;

const ASSETS = {
  // Character models (essential)
  Paladin: B + "models/characters/Paladin.glb",
  Paladin_with_Helmet: B + "models/characters/Paladin_with_Helmet.glb",
  BlackKnight: B + "models/characters/BlackKnight.glb",
  Witch: B + "models/characters/Witch.glb",
  Druid: B + "models/characters/Druid.glb",
  Ranger: B + "models/characters/Ranger.glb",
  Protagonist_A: B + "models/characters/Protagonist_A.glb",
  Protagonist_B: B + "models/characters/Protagonist_B.glb",
  Vampire: B + "models/characters/Vampire.glb",
  Skeleton_Warrior: B + "models/characters/Skeleton_Warrior.glb",
  Skeleton_Mage: B + "models/characters/Skeleton_Mage.glb",
  Skeleton_Rogue: B + "models/characters/Skeleton_Rogue.glb",
  Skeleton_Minion: B + "models/characters/Skeleton_Minion.glb",
  // Animations
  General: B + "models/animations/Rig_Medium_General.glb",
  Movement: B + "models/animations/Rig_Medium_MovementBasic.glb",
  CombatMelee: B + "models/animations/Rig_Medium_CombatMelee.glb",
  CombatRanged: B + "models/animations/Rig_Medium_CombatRanged.glb",
  // Decorations
  treeA: B + "models/decorations/tree_single_A.gltf",
  treeSmall: B + "models/decorations/trees_A_small.gltf",
  treeMed: B + "models/decorations/trees_A_medium.gltf",
  flag: B + "models/decorations/flag_blue.gltf",
};

export default function App() {
  const [phase, setPhase] = useState<"loading" | "menu" | "game">("loading");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const initChapter = useGame(s => s.initChapter);
  const grid = useGame(s => s.grid);
  const gamePhase = useGame(s => s.phase);
  const lang = useGame(s => s.lang);
  const tt = (k: Parameters<typeof t>[0]) => t(k, lang);
  const loaderRef = useRef(new GLTFLoader());

  // Preload all assets
  useEffect(() => {
    const entries = Object.entries(ASSETS);
    let loaded = 0;
    const total = entries.length;

    for (const [name, url] of entries) {
      const isGltf = url.endsWith(".gltf");
      setStatusText(name);

      if (isGltf) {
        // gltf files load differently — fetch + parse
        fetch(url)
          .then(r => r.ok ? r.text() : Promise.reject("404"))
          .then(() => {
            loaded++;
            setProgress(Math.round((loaded / total) * 100));
          })
          .catch(() => {
            loaded++;
            setProgress(Math.round((loaded / total) * 100));
          });
      } else {
        loaderRef.current.load(
          url,
          () => {
            loaded++;
            setProgress(Math.round((loaded / total) * 100));
          },
          undefined,
          () => {
            loaded++;
            setProgress(Math.round((loaded / total) * 100));
          }
        );
      }
    }

    // Check completion
    const checkInterval = setInterval(() => {
      if (loaded >= total) {
        clearInterval(checkInterval);
        setProgress(100);
        setTimeout(() => setPhase("menu"), 300);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, []);

  // Start game
  useEffect(() => {
    if (phase === "game" && !grid) initChapter(0);
  }, [phase, grid, initChapter]);

  if (phase === "loading") {
    return (
      <div className="loading-screen">
        <div className="loading-flame">🔥</div>
        <h1 className="loading-title">{tt("gameTitle")}</h1>
        <div className="loading-bar-container">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-percent">{progress}%</div>
        <div className="loading-status">{statusText}</div>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <>
        <LandingScene />
        <div className="start-screen">
          <div className="lang-toggle-wrap">
            <LangToggle />
          </div>
          <div className="start-card">
            <h1>{tt("gameTitle")}</h1>
            <div className="subtitle">{tt("subtitle")}</div>
            <div className="controls-box">
              <strong>{tt("controls")}</strong><br />
              {tt("leftClick")}<br />
              {tt("rightClick")}<br />
              {tt("mouseWheel")}<br /><br />
              <span style={{ color: "#7af" }}>{tt("blueHint")}</span>
            </div>
            <button onClick={() => setPhase("game")}>{tt("startGame")}</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Scene />
      <HUD />
      <DialogueBox />
      <BossEntrance />
      {gamePhase === "victory" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(20,60,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />
      )}
      {gamePhase === "defeat" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(60,20,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />
      )}
    </>
  );
}
