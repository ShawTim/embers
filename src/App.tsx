import { useState, useEffect } from "react";
import { useGame } from "./game/store";
import { Scene } from "./three/Scene";
import { LandingScene } from "./three/LandingScene";
import { HUD } from "./ui/HUD";
import { DialogueBox } from "./ui/DialogueBox";
import { LangToggle } from "./ui/LangToggle";
import { t } from "./i18n";

export default function App() {
  const [started, setStarted] = useState(false);
  const initChapter = useGame(s => s.initChapter);
  const grid = useGame(s => s.grid);
  const phase = useGame(s => s.phase);
  const lang = useGame(s => s.lang);
  useEffect(() => { if (started && !grid) initChapter(0); }, [started, grid, initChapter]);
  const tt = (k: Parameters<typeof t>[0]) => t(k, lang);
  if (!started) return (
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
            <strong>{tt("objective")}</strong><br />
            {tt("objectiveDesc")}<br /><br />
            <span style={{ color: "#7af" }}>{tt("blueHint")}</span>
          </div>
          <button onClick={() => setStarted(true)}>{tt("startGame")}</button>
        </div>
      </div>
    </>
  );
  return (<><Scene /><HUD /><DialogueBox />{phase === "victory" && <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(20,60,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />}{phase === "defeat" && <div style={{ position: "absolute", inset: 0, zIndex: 250, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(60,20,20,0.3) 0%, rgba(0,0,0,0.6) 100%)" }} />}</>);
}
