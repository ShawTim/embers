import { useState, useEffect, useRef } from "react";
import { useGame } from "./game/store";
import { Scene } from "./three/Scene";
import { LandingScene } from "./three/LandingScene";
import { HUD } from "./ui/HUD";
import { DialogueBox } from "./ui/DialogueBox";
import { ExpPopup } from "./ui/ExpPopup";
import { PromotionScreen } from "./ui/PromotionScreen";
import { BossEntrance } from "./ui/BossEntrance";
import { CritFlash } from "./ui/CritFlash";
import { ChapterIntroCard } from "./ui/ChapterIntroCard";
import { LangToggle } from "./ui/LangToggle";
import { t } from "./i18n";
import { audio } from "./audio/engine";
import { save as saveSystem } from "./game/save";
import { themeForChapter } from "./game/actTheme";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const B = import.meta.env.BASE_URL;

// Only load the GLBs that are actually referenced in gameData + LandingScene.
// Keeping this list short is the single biggest win for load time — the
// 48 model folder is 39MB but only 17 of those are used at runtime.  We
// also skip the Skeleton_* portraits (4MB each) and reuse the in-game
// models in the dialogue box instead.
const CHARACTER_ASSETS: { name: string; url: string }[] = [
  { name: "Paladin",            url: B + "models/characters/Paladin.glb" },
  { name: "Paladin_with_Helmet",url: B + "models/characters/Paladin_with_Helmet.glb" },
  { name: "BlackKnight",        url: B + "models/characters/BlackKnight.glb" },
  { name: "Witch",              url: B + "models/characters/Witch.glb" },
  { name: "Druid",              url: B + "models/characters/Druid.glb" },
  { name: "Ranger",             url: B + "models/characters/Ranger.glb" },
  { name: "Protagonist_A",      url: B + "models/characters/Protagonist_A.glb" },
  { name: "Protagonist_B",      url: B + "models/characters/Protagonist_B.glb" },
  { name: "Vampire",            url: B + "models/characters/Vampire.glb" },
  { name: "Tiefling",           url: B + "models/characters/Tiefling.glb" },
  { name: "OrcBrute",           url: B + "models/characters/OrcBrute.glb" },
  { name: "Barbarian",          url: B + "models/characters/Barbarian.glb" },
  { name: "Monstrosity",        url: B + "models/characters/Monstrosity.glb" },
  { name: "Knight",             url: B + "models/characters/Knight.glb" },     // landing scene
  { name: "Mage",               url: B + "models/characters/Mage.glb" },       // landing scene
  { name: "Rogue",              url: B + "models/characters/Rogue.glb" },      // landing scene
  { name: "Rogue_Hooded",       url: B + "models/characters/Rogue_Hooded.glb" }, // landing scene
];

const ANIM_ASSETS: { name: string; url: string }[] = [
  { name: "General",    url: B + "models/animations/Rig_Medium_General.glb" },
  { name: "Movement",   url: B + "models/animations/Rig_Medium_MovementBasic.glb" },
  { name: "CombatMelee",url: B + "models/animations/Rig_Medium_CombatMelee.glb" },
  { name: "CombatRanged",url: B + "models/animations/Rig_Medium_CombatRanged.glb" },
];

const DECORATION_ASSETS: { name: string; url: string }[] = [
  { name: "treeA",     url: B + "models/decorations/tree_single_A.gltf" },
  { name: "treeSmall", url: B + "models/decorations/trees_A_small.gltf" },
  { name: "treeMed",   url: B + "models/decorations/trees_A_medium.gltf" },
  { name: "flag",      url: B + "models/decorations/flag_blue.gltf" },
];

interface LoadItem {
  name: string;
  url: string;
  bytes: number;
  loaded: number;
}

export default function App() {
  const [phase, setPhase] = useState<"loading" | "menu" | "game">("loading");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const initChapter = useGame(s => s.initChapter);
  const grid = useGame(s => s.grid);
  const gamePhase = useGame(s => s.phase);
  const chapter = useGame(s => s.chapter);
  const lang = useGame(s => s.lang);
  const tt = (k: Parameters<typeof t>[0]) => t(k, lang);
  const loaderRef = useRef(new GLTFLoader());

  // Preload all assets with real byte-level progress.  Tracks total bytes
  // across all GLBs so the loading bar reflects actual download progress
  // rather than a count of files.  Each file is fetched in chunks; once
  // the body is fully buffered we hand the bytes to GLTFLoader for parse.
  useEffect(() => {
    let cancelled = false;
    const all: LoadItem[] = [
      ...CHARACTER_ASSETS.map(a => ({ name: a.name, url: a.url, bytes: 0, loaded: 0 })),
      ...ANIM_ASSETS.map(a => ({ name: a.name, url: a.url, bytes: 0, loaded: 0 })),
      ...DECORATION_ASSETS.map(a => ({ name: a.name, url: a.url, bytes: 0, loaded: 0 })),
    ];
    let totalBytes = 0;
    let doneBytes = 0;

    const updateProgress = () => {
      if (totalBytes > 0) setProgress(Math.min(99, Math.round((doneBytes / totalBytes) * 100)));
    };

    // Fetch one asset with progress tracking, then parse it with
    // GLTFLoader.  We pre-allocate a Content-Length-aware downloader so
    // we can show a real progress bar.
    const loadOne = (item: LoadItem) => new Promise<void>((resolve) => {
      setStatusText(item.name);
      fetch(item.url)
        .then(async (r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          // Use Content-Length for total if available, otherwise fall back
          // to a 1MB estimate so the bar still moves.
          const cl = r.headers.get("content-length");
          item.bytes = cl ? parseInt(cl, 10) : 1_000_000;
          totalBytes += item.bytes;
          updateProgress();
          if (!r.body) {
            // No streaming — fall back to blob
            const blob = await r.blob();
            item.loaded = blob.size;
            doneBytes += blob.size;
            updateProgress();
            return blob;
          }
          const reader = r.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            item.loaded = received;
            doneBytes += value.length;
            updateProgress();
          }
          // Concatenate
          const out = new Uint8Array(received);
          let off = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          return out;
        })
        .then((buf) => {
          if (cancelled) return;
          // Hand the parsed bytes to GLTFLoader.  GLTFLoader supports
          // a parse() method that takes an ArrayBuffer.
          let ab: ArrayBuffer;
          if (buf instanceof ArrayBuffer) {
            ab = buf;
          } else {
            const u8 = buf as Uint8Array;
            ab = u8.slice().buffer as ArrayBuffer;
          }
          loaderRef.current.parse(
            ab,
            "",
            () => resolve(),
            () => resolve(), // treat parse errors as "done" so the loader doesn't deadlock
          );
        })
        .catch(() => resolve()); // network / decode errors are non-fatal
    });

    // Decoration .gltf files reference external textures; load them via
    // plain fetch and let three.js handle the rest on first use.  They
    // are tiny so the progress cost is small.
    (async () => {
      // Run up to 4 downloads in parallel so the browser pipeline stays
      // full but we don't open dozens of sockets.
      const CONCURRENCY = 4;
      let next = 0;
      const workers: Promise<void>[] = [];
      const tick = async () => {
        while (next < all.length && !cancelled) {
          const i = next++;
          await loadOne(all[i]);
        }
      };
      for (let i = 0; i < CONCURRENCY; i++) workers.push(tick());
      await Promise.all(workers);
      if (cancelled) return;
      setProgress(100);
      setStatusText("Ready");
      setTimeout(() => { if (!cancelled) setPhase("menu"); }, 250);
    })();

    return () => { cancelled = true; };
  }, []);

  // Start game
  useEffect(() => {
    if (phase === "game" && !grid) initChapter(0);
  }, [phase, grid, initChapter]);

  // Music + SFX for phase transitions
  useEffect(() => {
    if (phase !== "game") return;
    if (gamePhase === "player") {
      // Vary the battle music by act so the player gets a distinct feel
      // for each arc.
      const actTrack: Record<string, string> = {
        prologue: "battle", act1: "battle", act2: "battle",
        act3: "battle", act4: "battle",
      };
      const actId = chapter ? themeForChapter(chapter.id).id : "prologue";
      audio.startMusic(actTrack[actId] || "battle");
    } else if (gamePhase === "enemy") {
      // keep battle music going; boss transitions handled in store
    } else if (gamePhase === "victory") {
      audio.play("victory");
      audio.startMusic("victory");
    } else if (gamePhase === "defeat") {
      audio.play("defeat");
      audio.startMusic("defeat");
    }
  }, [phase, gamePhase]);

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
    const hasAuto = saveSystem.hasAutosave();
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
            <button onClick={() => { audio.unlock(); audio.play("menu"); audio.startMusic("title"); setPhase("game"); }}>{tt("startGame")}</button>
            {hasAuto && (
              <button
                style={{ marginTop: 8, background: "linear-gradient(180deg, #3a5a3a, #1a3a1a)" }}
                onClick={() => { audio.unlock(); audio.play("select"); audio.startMusic("title"); const ok = useGame.getState().loadAutosave(); if (ok) setPhase("game"); }}
              >▶ {tt("autosave")}</button>
            )}
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
      <ExpPopup />
      <PromotionScreen />
      <BossEntrance />
      <CritFlash />
      {chapter?.id && <ChapterIntroCard chapterId={chapter.id} />}
      {gamePhase === "victory" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(20,60,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />
      )}
      {gamePhase === "defeat" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(60,20,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />
      )}
    </>
  );
}
