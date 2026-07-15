import { useGame } from "../game/store";
import { t, unitName, className, factionName } from "../i18n";
import type { RuntimeUnit } from "../types";
import { useState } from "react";

export function UnitList() {
  const units = useGame(s => s.units);
  const lang = useGame(s => s.lang);
  const phase = useGame(s => s.phase);
  const [open, setOpen] = useState(false);
  if (phase !== "player") return null;
  const tt = (k: any) => t(k, lang);
  const players = units.filter(u => u.faction === "player" && !u.isDead);
  return (<>
    <button className="btn-unit-list" onClick={() => setOpen(!open)}>{players.length} {tt("ready")}</button>
    {open && (<><div className="overlay" onClick={() => setOpen(false)} /><div className="unit-list-panel"><div className="unit-list-header"><span>{tt("statsTitle")}</span><button className="btn-close" onClick={() => setOpen(false)}>✕</button></div><div className="unit-list-body">{players.map(u => <UnitCard key={u.uid} unit={u} lang={lang} />)}</div></div></>)}
  </>);
}

function UnitCard({ unit, lang }: { unit: RuntimeUnit; lang: "en" | "zh" }) {
  const [expanded, setExpanded] = useState(false);
  const tt = (k: any) => t(k, lang);
  const pct = (unit.hp / unit.maxHp) * 100;
  const hpColor = pct > 60 ? "#3afa3a" : pct > 30 ? "#fafa3a" : "#fa3a3a";
  const wpn = unit.equippedWeapon;
  const growth = unit.classDef.growth;
  const statKeys = [["str", unit.stats.str],["mag", unit.stats.mag],["skl", unit.stats.skl],["spd", unit.stats.spd],["lck", unit.stats.lck],["def", unit.stats.def],["res", unit.stats.res],["mov", unit.classDef.baseMove]] as const;

  // Derived stats
  const atk = wpn ? (["fire","thunder","wind","light","dark"].includes(wpn.type) ? unit.stats.mag : unit.stats.str) + wpn.might : 0;
  const as = unit.stats.spd - Math.max(0, (wpn?.weight || 0) - Math.floor(unit.stats.str / 5));
  const hit = wpn ? wpn.hit + unit.stats.skl * 2 + Math.floor(unit.stats.lck / 2) : 0;
  const crit = wpn ? wpn.crit + Math.floor(unit.stats.skl / 2) : 0;

  return (
    <div className={`unit-card ${unit.hasActed ? "exhausted" : ""}`} onClick={() => setExpanded(!expanded)}>
      <div className="unit-card-header">
        <div className="unit-card-name">{unitName(unit.def.id, lang)}</div>
        <div className="unit-card-class">{tt("level")}{unit.level} {className(unit.classDef.id, lang)} {unit.classDef.tier === 2 ? "★" : ""}</div>
        <div className="unit-card-hp-bar"><div className="unit-card-hp-fill" style={{ width: `${pct}%`, background: hpColor }} /></div>
        <div className="unit-card-hp-text" style={{ color: hpColor }}>{unit.hp}/{unit.maxHp}</div>
        {unit.hasActed && <span className="unit-card-done">✓</span>}
      </div>
      {expanded && (
        <div className="unit-card-details">
          {/* Base stats */}
          <div className="unit-card-section-label">{tt("classLabel")} {className(unit.classDef.id, lang)}</div>
          <div className="unit-card-stats">
            {statKeys.map(([k, v]) => (
              <div key={k} className="unit-card-stat">
                <span className="label">{tt(k)}</span>
                <span className="val">{v}</span>
                <span className="growth">{(growth[k as string] || 0)}%</span>
              </div>
            ))}
          </div>
          {/* Derived combat stats */}
          <div className="unit-card-derived">
            <span>{tt("attackPower")} <strong>{atk}</strong></span>
            <span>{tt("attackSpeed")} <strong>{as}</strong></span>
            <span>{tt("hitRate")} <strong>{hit}</strong></span>
            <span>{tt("critRate")} <strong>{crit}%</strong></span>
          </div>
          {/* Weapon */}
          {wpn && (
            <div className="unit-card-weapon">
              {tt("equipped")}: {wpn.name}<br/>
              {tt("might")}{wpn.might} · {tt("hit")}{wpn.hit}% · {tt("weight")}{wpn.weight}
              {wpn.crit > 0 ? ` · ${tt("crt")}${wpn.crit}%` : ""}
              {wpn.minRange !== 1 || wpn.maxRange !== 1 ? ` · ${tt("range")}${wpn.minRange}-${wpn.maxRange}` : ""}
            </div>
          )}
          {/* All weapons */}
          {unit.weapons.length > 1 && (
            <div className="unit-card-weapons-list">
              {unit.weapons.map((w, i) => (
                <div key={i} className="unit-card-weapon-item" style={w === unit.equippedWeapon ? { color: "#6c6" } : {}}>
                  {w === unit.equippedWeapon ? "✓ " : ""}{w.name}
                </div>
              ))}
            </div>
          )}
          {/* EXP + Promotion */}
          <div className="unit-card-footer">
            <span>{tt("exp")}: {unit.exp}</span>
            {unit.classDef.tier === 1 && (
              <span style={{ color: unit.level >= 10 ? "#6c6" : "#556" }}>
                {unit.level >= 10 ? `✓ ${tt("promote")}` : tt("cantPromote")}
              </span>
            )}
            {unit.classDef.tier === 2 && <span style={{ color: "#fa6" }}>★ {tt("alreadyPromoted")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
