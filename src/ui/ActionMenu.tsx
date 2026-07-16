import { useGame } from "../game/store";
import { posKey } from "../game/grid";
import { t, unitName, className, factionName } from "../i18n";
import { ITEMS } from "../data/gameData";
import type { RuntimeUnit } from "../types";
import type { Lang } from "../i18n";
import { useState } from "react";

export function ActionMenu() {
  const selectionMode = useGame(s => s.selectionMode);
  const selectedUnit = useGame(s => s.selectedUnit);
  const pendingMove = useGame(s => s.pendingMove);
  const grid = useGame(s => s.grid);
  const waitUnit = useGame(s => s.waitUnit);
  const cancelMove = useGame(s => s.cancelMove);
  const useItemAction = useGame(s => s.useItemAction);
  const equipWeaponAction = useGame(s => s.equipWeaponAction);
  const lang = useGame(s => s.lang);
  const convoy = useGame(s => s.convoy);
  const [submenu, setSubmenu] = useState<"main" | "item" | "equip" | "stats">(null!);
  const [showStats, setShowStats] = useState(false);

  if (showStats && selectedUnit) {
    return <StatsOverlay unit={selectedUnit} lang={lang} onClose={() => setShowStats(false)} />;
  }

  if (!selectionMode || !selectedUnit || !pendingMove || !grid) return null;

  // If clicking an enemy unit directly, show stats
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

  if (submenu === "item") {
    const items = convoy.filter(c => c.type === "item");
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu("main")}>↩ {tt("cancel")}</button>
        {items.map((c, i) => { const item = ITEMS[c.id]; if (!item) return null; return <button key={i} onClick={() => { useItemAction(c.id); setSubmenu("main"); }}>{itemName(c.id)} ({c.uses} {tt("uses")})</button>; })}
        {items.length === 0 && <button disabled>{tt("noItems")}</button>}
      </div>
    );
  }

  if (submenu === "equip") {
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu("main")}>↩ {tt("cancel")}</button>
        {selectedUnit.weapons.map((w, i) => (
          <button key={i} onClick={() => { equipWeaponAction(i); setSubmenu("main"); }} style={w === selectedUnit.equippedWeapon ? { color: "#6c6" } : {}}>
            {w === selectedUnit.equippedWeapon ? "✓ " : ""}{w.name} {tt("might")}{w.might}
          </button>
        ))}
        {selectedUnit.weapons.length <= 1 && <button disabled>{tt("onlyOneWeapon")}</button>}
      </div>
    );
  }

  return (
    <div className="action-menu" style={style}>
      {canAttack && <button onClick={onAttack}>⚔ {tt("attack")}</button>}
      {canHeal && <button onClick={onHeal}>✚ {tt("heal")}</button>}
      <button onClick={() => setSubmenu("item")}>🎒 {tt("item")}</button>
      {selectedUnit.weapons.length > 1 && <button onClick={() => setSubmenu("equip")}>🗡 {tt("equip")}</button>}
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
          <div className="stats-panel-class">{tt("level")}{unit.level} {className(unit.classDef.id, lang)}{unit.classDef.tier === 2 ? " ★" : ""}</div>
          <div className="stats-panel-hp">
            <div className="stats-panel-hp-bar"><div className="stats-panel-hp-fill" style={{ width: `${pct}%`, background: hpColor }} /></div>
            <span style={{ color: hpColor, fontWeight: 700, fontSize: 13 }}>{unit.hp}/{unit.maxHp} {tt("hp")}</span>
          </div>
          <div className="stats-panel-grid">
            {statKeys.map(([k, v]) => (
              <div key={k} className="stats-panel-stat">
                <span className="label">{tt(k)}</span>
                <span className="val">{v}</span>
                <span className="growth">{(growth[k as string] || 0)}%</span>
              </div>
            ))}
          </div>
          <div className="stats-panel-derived">
            <span>{tt("attackPower")} <strong>{atk}</strong></span>
            <span>{tt("attackSpeed")} <strong>{as}</strong></span>
            <span>{tt("hitRate")} <strong>{hit}</strong></span>
            <span>{tt("critRate")} <strong>{crit}%</strong></span>
          </div>
          {wpn && (
            <div className="stats-panel-weapon">
              <strong>{tt("equipped")}:</strong> {wpn.name}
              <span> {tt("might")}{wpn.might} · {tt("hit")}{wpn.hit}% · {tt("weight")}{wpn.weight}{wpn.crit > 0 ? ` · ${tt("crt")}${wpn.crit}%` : ""}{wpn.minRange !== 1 || wpn.maxRange !== 1 ? ` · ${tt("range")}${wpn.minRange}-${wpn.maxRange}` : ""}</span>
            </div>
          )}
          {unit.weapons.length > 1 && (
            <div className="stats-panel-weapons">
              {unit.weapons.map((w, i) => (
                <div key={i} style={{ color: w === unit.equippedWeapon ? "#6c6" : "#789", fontSize: 12 }}>
                  {w === unit.equippedWeapon ? "✓ " : ""}{w.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
