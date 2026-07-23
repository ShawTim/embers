import { useGame } from "../game/store";
import { posKey } from "../game/grid";
import { t, unitName, className, factionName } from "../i18n";
import { ITEMS, WEAPONS } from "../data/gameData";
import type { RuntimeUnit } from "../types";
import type { Lang } from "../i18n";
import { useState } from "react";
import { Portrait3D } from "./Portrait3D";

export function ActionMenu() {
  const selectionMode = useGame(s => s.selectionMode);
  const selectedUnit = useGame(s => s.selectedUnit);
  const pendingMove = useGame(s => s.pendingMove);
  const grid = useGame(s => s.grid);
  const waitUnit = useGame(s => s.waitUnit);
  const cancelMove = useGame(s => s.cancelMove);
  const useItemAction = useGame(s => s.useItemAction);
  const equipWeaponAction = useGame(s => s.equipWeaponAction);
  const equipConvoyWeaponAction = useGame(s => s.equipConvoyWeaponAction);
  const lang = useGame(s => s.lang);
  const convoy = useGame(s => s.convoy);
  const [submenu, setSubmenu] = useState<"main" | "item" | "equip" | "stats">(null!);
  const [showStats, setShowStats] = useState(false);

  if (showStats && selectedUnit) {
    return <StatsOverlay unit={selectedUnit} lang={lang} onClose={() => setShowStats(false)} />;
  }

  if (!selectionMode || !selectedUnit || !pendingMove || !grid) return null;

  if (selectionMode === "idle" || selectionMode === "enemyInfo") {
    if (selectedUnit.faction !== "player") {
      return <StatsOverlay unit={selectedUnit} lang={lang} onClose={() => useGame.getState().deselectUnit()} />;
    }
  }

  if (selectionMode !== "actionMenu") return null;

  const wpn = selectedUnit.equippedWeapon;
  let canAttack = false, canHeal = false;
  if (wpn) {
    for (let r = wpn.minRange; r <= wpn.maxRange; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const tx = pendingMove.x + dx, ty = pendingMove.y + dy;
          if (tx < 0 || tx >= grid.w || ty < 0 || ty >= grid.h) continue;
          const tg = grid.getUnitAt({ x: tx, y: ty });
          if (!tg || tg.isDead) continue;
          if (wpn.type === "staff") { if (tg.faction === "player" && tg.hp < tg.maxHp) canHeal = true; }
          else { if (tg.faction !== "player" && tg.faction !== "ally") canAttack = true; }
        }
      }
    }
  }

  const onAttack = () => {
    if (!wpn || !grid) return;
    const tiles = grid.computeAttackRange(pendingMove, wpn.minRange, wpn.maxRange);
    const vk = tiles.filter(p => { const u = grid.getUnitAt(p); return u && !u.isDead && u.faction !== "player" && u.faction !== "ally"; }).map(p => posKey(p));
    useGame.setState({ attackRange: vk, selectionMode: "targeting", moveRange: new Map() });
  };
  const onHeal = () => {
    if (!wpn || !grid) return;
    const tiles = grid.computeAttackRange(pendingMove, wpn.minRange, wpn.maxRange);
    const vk = tiles.filter(p => { const u = grid.getUnitAt(p); return u && !u.isDead && u.faction === "player" && u.hp < u.maxHp; }).map(p => posKey(p));
    useGame.setState({ attackRange: vk, selectionMode: "targeting", moveRange: new Map() });
  };

  const style: React.CSSProperties = { left: "50%", top: "55%", transform: "translateX(-50%)" };
  const tt = (k: any) => t(k, lang);
  const itemName = (id: string) => { const k = `i_${id}` as any; const r = t(k, lang); return r === k ? id : r; };
  const compatibleConvoyWeapons = convoy
    .map((entry, index) => ({ entry, index, weapon: WEAPONS[entry.id] }))
    .filter(({ entry, weapon }) =>
      entry.type === "weapon"
      && !!weapon
      && selectedUnit.classDef.weapons.includes(weapon.type),
    );

  if (submenu === "item") {
    const items = convoy.filter(c => c.type === "item");
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu(null!)}>↩ {tt("cancel")}</button>
        {items.map((c, i) => { const item = ITEMS[c.id]; if (!item) return null; return <button key={i} onClick={() => { useItemAction(c.id); setSubmenu(null!); }}>{itemName(c.id)} ({c.uses} {tt("uses")})</button>; })}
        {items.length === 0 && <button disabled>{tt("noItems")}</button>}
      </div>
    );
  }

  if (submenu === "equip") {
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu(null!)}>↩ {tt("cancel")}</button>
        {selectedUnit.weapons.map((w, i) => (
          <button key={i} onClick={() => { equipWeaponAction(i); setSubmenu(null!); }} style={w === selectedUnit.equippedWeapon ? { color: "#6c6" } : {}}>
            {w === selectedUnit.equippedWeapon ? "✓ " : ""}{w.name} · {w.uses} {tt("uses")} · {tt("might")}{w.might}
          </button>
        ))}
        {compatibleConvoyWeapons.map(({ entry, index, weapon }) => (
          <button
            key={`convoy-${index}`}
            onClick={() => {
              equipConvoyWeaponAction(index);
              setSubmenu(null!);
            }}
          >
            ↧ {tt("takeFromConvoy")}: {weapon.name} · {entry.uses} {tt("uses")}
          </button>
        ))}
        {selectedUnit.weapons.length <= 1 && compatibleConvoyWeapons.length === 0 && (
          <button disabled>{tt("onlyOneWeapon")}</button>
        )}
      </div>
    );
  }

  return (
    <div className="action-menu" style={style}>
      {canAttack && <button onClick={onAttack}>⚔ {tt("attack")}</button>}
      {canHeal && <button onClick={onHeal}>✚ {tt("heal")}</button>}
      <button onClick={() => setSubmenu("item")}>🎒 {tt("item")}</button>
      {(selectedUnit.weapons.length > 1 || compatibleConvoyWeapons.length > 0) && (
        <button onClick={() => setSubmenu("equip")}>🗡 {tt("equip")}</button>
      )}
      <button onClick={() => setShowStats(true)}>📊 {tt("stats")}</button>
      <button onClick={waitUnit}>⏳ {tt("wait")}</button>
      <button onClick={cancelMove}>↩ {tt("cancel")}</button>
    </div>
  );
}

function StatsOverlay({ unit, lang, onClose }: { unit: RuntimeUnit; lang: Lang; onClose: () => void }) {
  const tt = (k: any) => t(k, lang);
  const pct = (unit.hp / unit.maxHp) * 100;
  const hpColor = pct > 60 ? "#3afa3a" : pct > 30 ? "#fafa3a" : "#fa3a3a";
  const wpn = unit.equippedWeapon;
  const growth = unit.classDef.growth;
  const statKeys = [["str", unit.stats.str],["mag", unit.stats.mag],["skl", unit.stats.skl],["spd", unit.stats.spd],["lck", unit.stats.lck],["def", unit.stats.def],["res", unit.stats.res],["mov", unit.classDef.baseMove]] as const;
  const atk = wpn ? (["fire","thunder","wind","light","dark"].includes(wpn.type) ? unit.stats.mag : unit.stats.str) + wpn.might : 0;
  const as = unit.stats.spd - Math.max(0, (wpn?.weight || 0) - Math.floor(unit.stats.str / 5));
  const hit = wpn ? wpn.hit + unit.stats.skl * 2 + Math.floor(unit.stats.lck / 2) : 0;
  const crit = wpn ? wpn.crit + Math.floor(unit.stats.skl / 2) : 0;
  const fc = unit.faction === "player" ? "#5a8adb" : unit.faction === "enemy" ? "#db5a5a" : "#5adb5a";
  const desc = unit.def.desc || "";
  const unitModelId = (unit as any)._dialogModelId || unit.modelId;

  const expNeeded = 100; // EXP_PER_LEVEL
  const expPct = Math.min(100, (unit.exp / expNeeded) * 100);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="stats-panel">
        <div className="stats-panel-header">
          <div className="faction-dot" style={{ background: fc }} />
          <span className="stats-panel-name">{unitName(unit.def.id, lang)}</span>
          {unit.isBoss && <span className="boss-tag">{tt("boss")}</span>}
          <span className={`faction-tag ${unit.faction}`}>{factionName(unit.faction, lang)}</span>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="stats-panel-body">
          {/* Avatar + description */}
          <div className="stats-panel-top">
            <div className="stats-panel-avatar">
              <Portrait3D modelId={unitModelId} mood="neutral" />
            </div>
            <div className="stats-panel-info">
              <div className="stats-panel-class">{tt("level")}{unit.level} {className(unit.classDef.id, lang)}{unit.classDef.tier === 2 ? " ★" : ""}</div>
              <div className="stats-panel-desc">{desc}</div>
              <div className="stats-panel-exp-bar">
                <div className="stats-panel-exp-fill" style={{ width: `${expPct}%` }} />
                <span className="stats-panel-exp-text">{tt("exp")} {unit.exp}/{expNeeded}</span>
              </div>
            </div>
          </div>

          {/* HP */}
          <div className="stats-panel-hp">
            <div className="stats-panel-hp-bar"><div className="stats-panel-hp-fill" style={{ width: `${pct}%`, background: hpColor }} /></div>
            <span style={{ color: hpColor, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{unit.hp}/{unit.maxHp} {tt("hp")}</span>
          </div>

          {/* Stats grid */}
          <div className="stats-panel-grid">
            {statKeys.map(([k, v]) => (
              <div key={k} className="stats-panel-stat">
                <span className="label">{tt(k)}</span>
                <span className="val">{v}</span>
                <span className="growth">{(growth[k as string] || 0)}%</span>
              </div>
            ))}
          </div>

          {/* Derived combat stats */}
          <div className="stats-panel-derived">
            <span>{tt("attackPower")} <strong>{atk}</strong></span>
            <span>{tt("attackSpeed")} <strong>{as}</strong></span>
            <span>{tt("hitRate")} <strong>{hit}</strong></span>
            <span>{tt("critRate")} <strong>{crit}%</strong></span>
          </div>

          {/* Equipment */}
          <div className="stats-panel-equip-section">
            <div className="stats-panel-section-title">{tt("inventory")}</div>
            {unit.weapons.map((w, i) => (
              <div key={i} className={`stats-panel-weapon-row ${w === unit.equippedWeapon ? "equipped" : ""}`}>
                <span className="wpn-check">{w === unit.equippedWeapon ? "✓" : ""}</span>
                <span className="wpn-name">{w.name}</span>
                <span className="wpn-stats">{tt("might")}{w.might} {tt("hit")}{w.hit} {tt("weight")}{w.weight}{w.crit > 0 ? ` ${tt("crt")}${w.crit}` : ""}{w.minRange !== 1 || w.maxRange !== 1 ? ` ${tt("range")}${w.minRange}-${w.maxRange}` : ""}</span>
                <span className="wpn-triangle">{w.triangle !== "none" ? w.triangle.toUpperCase() : ""}</span>
                <span className="wpn-uses">{w.uses}{tt("uses")}</span>
              </div>
            ))}
          </div>

          {/* Promotion status */}
          {unit.faction === "player" && (
            <div className="stats-panel-promo">
              {unit.classDef.tier === 2
                ? <span style={{ color: "#fa6" }}>★ {tt("alreadyPromoted")}</span>
                : unit.level >= 10
                  ? <span style={{ color: "#6c6" }}>✓ {tt("promote")} ({tt("level")}10+)</span>
                  : <span style={{ color: "#556" }}>{tt("cantPromote")} ({tt("level")}{unit.level}/10)</span>
              }
            </div>
          )}
        </div>
      </div>
    </>
  );
}
