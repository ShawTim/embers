import { useGame } from "../game/store";
import { t, unitName, className } from "../i18n";
import type { RuntimeUnit } from "../types";
import { useState } from "react";

export function UnitList() {
  const units = useGame(s => s.units);
  const lang = useGame(s => s.lang);
  const phase = useGame(s => s.phase);
  const [open, setOpen] = useState(false);
  if (phase !== "player") return null;
  const players = units.filter(u => u.faction === "player" && !u.isDead);
  return (<>
    <button className="btn-unit-list" onClick={() => setOpen(!open)}>{players.length} {t("ready", lang)}</button>
    {open && (<><div className="overlay" onClick={() => setOpen(false)} /><div className="unit-list-panel"><div className="unit-list-header"><span>{t("ready", lang)}</span><button className="btn-close" onClick={() => setOpen(false)}>✕</button></div><div className="unit-list-body">{players.map(u => <UnitCard key={u.uid} unit={u} lang={lang} />)}</div></div></>)}
  </>);
}

function UnitCard({ unit, lang }: { unit: RuntimeUnit; lang: "en" | "zh" }) {
  const [expanded, setExpanded] = useState(false);
  const pct = (unit.hp / unit.maxHp) * 100;
  const hpColor = pct > 60 ? "#3afa3a" : pct > 30 ? "#fafa3a" : "#fa3a3a";
  const wpn = unit.equippedWeapon;
  const stats: [string, number][] = [[t("str",lang),unit.stats.str],[t("mag",lang),unit.stats.mag],[t("skl",lang),unit.stats.skl],[t("spd",lang),unit.stats.spd],[t("lck",lang),unit.stats.lck],[t("def",lang),unit.stats.def],[t("res",lang),unit.stats.res],[t("mov",lang),unit.classDef.baseMove]];
  return (
    <div className={`unit-card ${unit.hasActed ? "exhausted" : ""}`} onClick={() => setExpanded(!expanded)}>
      <div className="unit-card-header">
        <div className="unit-card-name">{unitName(unit.def.id, lang)}</div>
        <div className="unit-card-class">Lv{unit.level} {className(unit.classDef.id, lang)}</div>
        <div className="unit-card-hp-bar"><div className="unit-card-hp-fill" style={{ width: `${pct}%`, background: hpColor }} /></div>
        <div className="unit-card-hp-text" style={{ color: hpColor }}>{unit.hp}/{unit.maxHp}</div>
        {unit.hasActed && <span className="unit-card-done">✓</span>}
      </div>
      {expanded && (<div className="unit-card-details"><div className="unit-card-stats">{stats.map(([l,v]) => <div key={l} className="unit-card-stat"><span className="label">{l}</span><span className="val">{v}</span></div>)}</div>{wpn && <div className="unit-card-weapon">{wpn.name} · MT{wpn.might} HIT{wpn.hit}% WT{wpn.weight}{wpn.crit > 0 ? ` CRT${wpn.crit}%` : ""}{wpn.minRange !== 1 || wpn.maxRange !== 1 ? ` R${wpn.minRange}-${wpn.maxRange}` : ""}</div>}</div>)}
    </div>
  );
}
