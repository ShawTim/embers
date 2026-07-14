import { useGame } from "../game/store";
import { posKey } from "../game/grid";
import { t } from "../i18n";

export function ActionMenu() {
  const selectionMode = useGame(s => s.selectionMode);
  const selectedUnit = useGame(s => s.selectedUnit);
  const pendingMove = useGame(s => s.pendingMove);
  const grid = useGame(s => s.grid);
  const waitUnit = useGame(s => s.waitUnit);
  const cancelMove = useGame(s => s.cancelMove);
  const lang = useGame(s => s.lang);
  if (selectionMode !== "actionMenu" || !selectedUnit || !pendingMove || !grid) return null;
  const wpn = selectedUnit.equippedWeapon;
  let canAttack = false, canHeal = false;
  if (wpn) { for (let r = wpn.minRange; r <= wpn.maxRange; r++) { for (let dy = -r; dy <= r; dy++) { for (let dx = -r; dx <= r; dx++) { if (Math.abs(dx)+Math.abs(dy) !== r) continue; const tx = pendingMove.x+dx, ty = pendingMove.y+dy; if (tx < 0 || tx >= grid.w || ty < 0 || ty >= grid.h) continue; const tg = grid.getUnitAt({ x: tx, y: ty }); if (!tg || tg.isDead) continue; if (wpn.type === "staff") { if (tg.faction === "player" && tg.hp < tg.maxHp) canHeal = true; } else { if (tg.faction !== "player" && tg.faction !== "ally") canAttack = true; } } } } }
  const onAttack = () => { if (!wpn || !grid) return; const tiles = grid.computeAttackRange(pendingMove, wpn.minRange, wpn.maxRange); const vk = tiles.filter(p => { const u = grid.getUnitAt(p); return u && !u.isDead && u.faction !== "player" && u.faction !== "ally"; }).map(p => posKey(p)); useGame.setState({ attackRange: vk, selectionMode: "targeting", moveRange: new Map() }); };
  const onHeal = () => { if (!wpn || !grid) return; const tiles = grid.computeAttackRange(pendingMove, wpn.minRange, wpn.maxRange); const vk = tiles.filter(p => { const u = grid.getUnitAt(p); return u && !u.isDead && u.faction === "player" && u.hp < u.maxHp; }).map(p => posKey(p)); useGame.setState({ attackRange: vk, selectionMode: "targeting", moveRange: new Map() }); };
  return <div className="action-menu" style={{ left: "50%", top: "55%", transform: "translateX(-50%)" }}>{canAttack && <button onClick={onAttack}>⚔ {t("attack", lang)}</button>}{canHeal && <button onClick={onHeal}>✚ {t("heal", lang)}</button>}<button onClick={waitUnit}>⏳ {t("wait", lang)}</button><button onClick={cancelMove}>↩ {t("cancel", lang)}</button></div>;
}
