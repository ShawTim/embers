import { useGame } from "../game/store";
import { posKey } from "../game/grid";
import { t } from "../i18n";
import { ITEMS } from "../data/gameData";
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
  const [submenu, setSubmenu] = useState<"main" | "item" | "equip">("main");

  if (selectionMode !== "actionMenu" || !selectedUnit || !pendingMove || !grid) return null;

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

  if (submenu === "item") {
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu("main")} disabled={false}>↩ {t("cancel", lang)}</button>
        {convoy.filter(c => c.type === "item").map((c, i) => {
          const item = ITEMS[c.id];
          if (!item) return null;
          return <button key={i} onClick={() => { useItemAction(c.id); setSubmenu("main"); }}>
            {item.name} ({c.uses})
          </button>;
        })}
        {convoy.filter(c => c.type === "item").length === 0 && <button disabled>No items</button>}
      </div>
    );
  }

  if (submenu === "equip") {
    return (
      <div className="action-menu" style={style}>
        <button onClick={() => setSubmenu("main")}>↩ {t("cancel", lang)}</button>
        {selectedUnit.weapons.map((w, i) => (
          <button key={i} onClick={() => { equipWeaponAction(i); setSubmenu("main"); }}
            style={w === selectedUnit.equippedWeapon ? { color: "#6c6" } : {}}>
            {w === selectedUnit.equippedWeapon ? "✓ " : ""}{w.name} MT{w.might}
          </button>
        ))}
        {selectedUnit.weapons.length <= 1 && <button disabled>Only one weapon</button>}
      </div>
    );
  }

  return (
    <div className="action-menu" style={style}>
      {canAttack && <button onClick={onAttack}>⚔ {t("attack", lang)}</button>}
      {canHeal && <button onClick={onHeal}>✚ {t("heal", lang)}</button>}
      <button onClick={() => setSubmenu("item")}>🎒 Item</button>
      {selectedUnit.weapons.length > 1 && <button onClick={() => setSubmenu("equip")}>🗡 Equip</button>}
      <button onClick={waitUnit}>⏳ {t("wait", lang)}</button>
      <button onClick={cancelMove}>↩ {t("cancel", lang)}</button>
    </div>
  );
}
