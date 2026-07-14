import type { AIType, RuntimeUnit } from "../types";
import type { GameGrid, Pos } from "./grid";
import { manhattan } from "./grid";
import { previewCombat } from "./combat";

export interface AIDecision {
  action: "attack" | "heal" | "move" | "wait";
  moveTarget?: Pos;
  attackTarget?: RuntimeUnit;
  healTarget?: RuntimeUnit;
  path?: Pos[];
}

export function decideAIAction(unit: RuntimeUnit, grid: GameGrid, allUnits: RuntimeUnit[]): AIDecision {
  const ai = unit.aiType || "aggressive";
  const mt = unit.classDef.moveType;
  const mp = unit.classDef.baseMove;
  const enemies = allUnits.filter(u => !u.isDead && (u.faction === "player" || u.faction === "ally"));
  const moveRange = grid.computeMoveRange(unit.pos, mp, mt, unit.uid);

  switch (ai) {
    case "stationary": return decideStationary(unit, grid, enemies);
    case "boss": {
      const near = findNearest(unit, enemies);
      return near && manhattan(unit.pos, near.pos) <= 5 ? decideAggressive(unit, grid, enemies, moveRange) : decideStationary(unit, grid, enemies);
    }
    case "sniper": return decideSniper(unit, grid, enemies, moveRange);
    case "healer": return decideHealer(unit, grid, allUnits.filter(u => !u.isDead && u.faction === unit.faction && u.uid !== unit.uid), moveRange);
    case "defensive": {
      const limited = new Map<string, Pos[]>();
      for (const [k, p] of moveRange) { const d = p[p.length - 1]; if (manhattan(unit.pos, d) <= 2) limited.set(k, p); }
      return decideAggressive(unit, grid, enemies, limited);
    }
    default: return decideAggressive(unit, grid, enemies, moveRange);
  }
}

function decideAggressive(unit: RuntimeUnit, grid: GameGrid, enemies: RuntimeUnit[], mr: Map<string, Pos[]>): AIDecision {
  if (!enemies.length) return { action: "wait" };
  let best: AIDecision = { action: "wait" };
  let bestScore = -Infinity;
  for (const [k, path] of mr) {
    const from = path[path.length - 1];
    for (const t of getTargets(unit, from, enemies, grid)) {
      const s = scoreAttack(unit, t, from, grid);
      if (s > bestScore) { bestScore = s; best = { action: "attack", moveTarget: from, attackTarget: t, path }; }
    }
  }
  if (best.action === "wait") {
    const near = findNearest(unit, enemies);
    if (near) {
      let bp = unit.pos, bd = manhattan(unit.pos, near.pos);
      for (const [k, path] of mr) { const d = manhattan(path[path.length - 1], near.pos); if (d < bd) { bd = d; bp = path[path.length - 1]; } }
      if (bp.x !== unit.pos.x || bp.y !== unit.pos.y) best = { action: "move", moveTarget: bp, path: mr.get(`${bp.x},${bp.y}`) };
    }
  }
  return best;
}

function decideStationary(unit: RuntimeUnit, grid: GameGrid, enemies: RuntimeUnit[]): AIDecision {
  const targets = getTargets(unit, unit.pos, enemies, grid);
  if (!targets.length) return { action: "wait" };
  let best = targets[0], bs = -Infinity;
  for (const t of targets) { const s = scoreAttack(unit, t, unit.pos, grid); if (s > bs) { bs = s; best = t; } }
  return { action: "attack", moveTarget: unit.pos, attackTarget: best, path: [unit.pos] };
}

function decideSniper(unit: RuntimeUnit, grid: GameGrid, enemies: RuntimeUnit[], mr: Map<string, Pos[]>): AIDecision {
  let best: AIDecision = { action: "wait" }; let bs = -Infinity;
  for (const [k, path] of mr) { const from = path[path.length - 1]; for (const t of getTargets(unit, from, enemies, grid)) { const dist = manhattan(from, t.pos); const w = unit.equippedWeapon?.maxRange || 1; const s = scoreAttack(unit, t, from, grid) * (1 + (dist - w) * 0.1); if (s > bs) { bs = s; best = { action: "attack", moveTarget: from, attackTarget: t, path }; } } }
  if (best.action === "wait" && enemies.length) { const n = findNearest(unit, enemies); if (n) { let bp = unit.pos, bd = manhattan(unit.pos, n.pos); for (const [k, path] of mr) { const d = manhattan(path[path.length-1], n.pos); if (d > bd) { bd = d; bp = path[path.length-1]; } } if (bp.x !== unit.pos.x || bp.y !== unit.pos.y) best = { action: "move", moveTarget: bp, path: mr.get(`${bp.x},${bp.y}`) }; } }
  return best;
}

function decideHealer(unit: RuntimeUnit, grid: GameGrid, allies: RuntimeUnit[], mr: Map<string, Pos[]>): AIDecision {
  const wounded = allies.filter(a => a.hp < a.maxHp);
  if (!wounded.length) return { action: "wait" };
  for (const [k, path] of mr) { const from = path[path.length - 1]; for (const a of wounded) if (manhattan(from, a.pos) <= 1) return { action: "heal", moveTarget: from, healTarget: a, path }; }
  return { action: "wait" };
}

function getTargets(u: RuntimeUnit, from: Pos, enemies: RuntimeUnit[], grid: GameGrid): RuntimeUnit[] {
  const w = u.equippedWeapon; if (!w) return [];
  return enemies.filter(e => { const d = manhattan(from, e.pos); return d >= w.minRange && d <= w.maxRange; });
}

function scoreAttack(u: RuntimeUnit, t: RuntimeUnit, from: Pos, grid: GameGrid): number {
  const p = previewCombat(u, t, grid.getTerrain(from), grid.getTerrain(t.pos));
  let s = p.attackerDmg;
  if (p.isLethal) s += 50; if (t.isBoss && p.isLethal) s += 100;
  s += p.attackerCrit * 0.3;
  if (p.willCounter) { s -= p.defenderDmg * 1.5; if (p.attackerHpAfter === 0) s -= 100; }
  if (p.attackerDoubles) s += 15;
  s += p.weaponTriangle * 10;
  return s;
}

function findNearest(u: RuntimeUnit, targets: RuntimeUnit[]): RuntimeUnit | null {
  let n: RuntimeUnit | null = null, bd = Infinity;
  for (const t of targets) { const d = manhattan(u.pos, t.pos); if (d < bd) { bd = d; n = t; } }
  return n;
}
