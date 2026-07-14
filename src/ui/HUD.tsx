import { useGame } from "../game/store";
import { TERRAIN } from "../data/gameData";
import { t, chapterInfo, type StringKey } from "../i18n";
import { UnitPanel } from "./UnitPanel";
import { ActionMenu } from "./ActionMenu";
import { CombatPreview } from "./CombatPreview";
import { LangToggle } from "./LangToggle";
import { UnitList } from "./UnitList";

export function HUD() {
  const turn = useGame(s => s.turn);
  const phase = useGame(s => s.phase);
  const chapter = useGame(s => s.chapter);
  const endPlayerTurn = useGame(s => s.endPlayerTurn);
  const hoveredTile = useGame(s => s.hoveredTile);
  const hoveredUnit = useGame(s => s.hoveredUnit);
  const grid = useGame(s => s.grid);
  const combatLog = useGame(s => s.combatLog);
  const message = useGame(s => s.message);
  const selectedUnit = useGame(s => s.selectedUnit);
  const selectionMode = useGame(s => s.selectionMode);
  const units = useGame(s => s.units);
  const lang = useGame(s => s.lang);
  const tt = (k: StringKey, p?: Record<string, string | number>) => t(k, lang, p);
  const terrainDef = hoveredTile && grid ? TERRAIN[grid.getTerrain(hoveredTile)] : null;
  const displayUnit = hoveredUnit || selectedUnit;
  const playerReady = units.filter(u => u.faction === "player" && !u.isDead && !u.hasActed).length;
  const playerTotal = units.filter(u => u.faction === "player" && !u.isDead).length;
  const enemyAlive = units.filter(u => u.faction === "enemy" && !u.isDead).length;
  const pm: Record<string, StringKey> = { player: "yourTurn", enemy: "enemyTurn", combat: "combat", victory: "victory", defeat: "defeat" };
  const pk = pm[phase] || "yourTurn";
  const pc = phase === "player" ? "player" : phase === "enemy" ? "enemy" : phase === "combat" ? "combat" : "";
  return (<>
    <div className="hud-top">
      <div className="turn-badge">{tt("turn")} {turn}</div>
      <div className={`phase-badge ${pc}`}>{tt(pk)}</div>
      <div className="objective">{chapter ? chapterInfo(chapter.id, "obj", lang) : ""}</div>
      <div className="unit-counts">{playerReady}/{playerTotal} {tt("ready")} · {enemyAlive} {tt("enemies")}</div>
      <LangToggle />
      {phase === "player" && <button className="btn-end-turn" onClick={endPlayerTurn}>{tt("endTurn")}</button>}
    </div>
    <div className="hud-bottom-left"><div className="panel tile-info">{terrainDef ? (<><div className="terrain-name">{tt(terrainDef.type as StringKey)}</div><div className="terrain-stats">{terrainDef.defBonus > 0 && <span>DEF +{terrainDef.defBonus} </span>}{terrainDef.avoidBonus > 0 && <span>AVO {terrainDef.avoidBonus}% </span>}{terrainDef.healPercent > 0 && <span>HP +{terrainDef.healPercent}%</span>}{terrainDef.defBonus === 0 && terrainDef.avoidBonus === 0 && terrainDef.healPercent === 0 && <span style={{ color: "#556" }}>{tt("noBonus")}</span>}</div></>) : <div style={{ color: "#556", fontSize: 13 }}>{tt("hoverTile")}</div>}</div></div>
    <div className="hud-bottom-right"><UnitPanel unit={displayUnit ?? null} /></div>
    <ActionMenu /><CombatPreview /><UnitList />
    <div className="combat-log">{combatLog.slice(-4).map((l, i) => <div key={i} className="log-line" style={{ color: l.color }}>{l.text}</div>)}</div>
    {message && (phase === "victory" || phase === "defeat") && (<div className="big-message" style={{ color: phase === "victory" ? "#5fa84a" : "#e8484a" }}>{message}{phase === "victory" && <div style={{ fontSize: 16, marginTop: 20, pointerEvents: "auto" }}><button style={{ padding: "10px 28px", fontSize: 14, cursor: "pointer", background: "linear-gradient(180deg, #2a4a7a, #1a3050)", color: "#fff", border: "1px solid #4a7aaa", borderRadius: 6 }} onClick={() => { const ch = useGame.getState().chapter; useGame.getState().initChapter(ch?.id === "ch01" ? 1 : 0); }}>{useGame.getState().chapter?.id === "ch01" ? tt("nextChapter") : tt("playAgain")}</button></div>}</div>)}
    {phase === "player" && <TutorialHint mode={selectionMode} ready={playerReady} lang={lang} />}
  </>);
}

function TutorialHint({ mode, ready, lang }: { mode: string; ready: number; lang: "en" | "zh" }) {
  let key: StringKey | null = null; let p: Record<string, string | number> | undefined;
  if (ready === 0 && mode === "idle") key = "hintAllActed";
  else { switch (mode) { case "idle": key = "hintIdle"; p = { n: ready }; break; case "moving": key = "hintMoving"; break; case "actionMenu": key = "hintActionMenu"; break; case "targeting": key = "hintTargeting"; break; default: break; } }
  if (!key) return null;
  return <div className="tutorial-hint">{t(key, lang, p)}</div>;
}
