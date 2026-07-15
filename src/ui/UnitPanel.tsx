import { useGame } from "../game/store";
import { t, unitName, className, factionName } from "../i18n";
import type { RuntimeUnit } from "../types";
import { useState } from "react";

export function UnitPanel({ unit }: { unit: RuntimeUnit | null }) {
  const lang = useGame(s => s.lang);
  const tt = (k: any) => t(k, lang);
  if (!unit) return <div className="panel unit-panel"><div className="empty-msg">{tt("hoverUnit")}</div></div>;
  const pct = (unit.hp / unit.maxHp) * 100;
  const hpColor = pct > 60 ? "#3afa3a" : pct > 30 ? "#fafa3a" : "#fa3a3a";
  const fc = unit.faction === "player" ? "#5a8adb" : unit.faction === "enemy" ? "#db5a5a" : "#5adb5a";
  const statKeys = [["str", unit.stats.str],["mag", unit.stats.mag],["skl", unit.stats.skl],["spd", unit.stats.spd],["lck", unit.stats.lck],["def", unit.stats.def],["res", unit.stats.res],["mov", unit.classDef.baseMove]] as const;
  const wpn = unit.equippedWeapon;
  return (
    <div className="panel unit-panel">
      <div className="unit-header">
        <div className="faction-dot" style={{ background: fc }} />
        <div className="unit-name">{unitName(unit.def.id, lang)}</div>
        {unit.isBoss && <span className="boss-tag">{tt("boss")}</span>}
        <span className={`faction-tag ${unit.faction}`}>{factionName(unit.faction, lang)}</span>
      </div>
      <div className="unit-class">{tt("level")}{unit.level} {className(unit.classDef.id, lang)}</div>
      <div className="hp-section">
        <div className="hp-bar"><div className="hp-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${hpColor}, ${hpColor}cc)` }} /></div>
        <div className="hp-text" style={{ color: hpColor }}>{unit.hp} / {unit.maxHp} {tt("hp")}</div>
      </div>
      <div className="stats-grid">{statKeys.map(([k, v]) => <div key={k} className="stat-row"><span className="stat-label">{tt(k)}</span><span className="stat-val">{v}</span></div>)}</div>
      {wpn ? <div className="weapon-info">{wpn.name} — {tt("might")}{wpn.might} · {tt("hit")}{wpn.hit}% · {tt("weight")}{wpn.weight}{wpn.crit > 0 ? ` · ${tt("crt")}${wpn.crit}%` : ""}{wpn.minRange !== 1 || wpn.maxRange !== 1 ? ` · ${tt("range")}${wpn.minRange}-${wpn.maxRange}` : ""}</div> : <div className="weapon-info" style={{ color: "#556" }}>{tt("noWeapon")}</div>}
      {unit.hasActed && unit.faction === "player" && <div style={{ marginTop: 6, fontSize: 11, color: "#556" }}>{tt("alreadyActed")}</div>}
    </div>
  );
}
