import type { TerrainType, MoveType, RuntimeUnit } from "../types";
import { TERRAIN, getMoveCost, isPassable } from "../data/gameData";

export interface Pos { x: number; y: number; }
export function posKey(p: Pos): string { return `${p.x},${p.y}`; }
export function posEq(a: Pos, b: Pos): boolean { return a.x === b.x && a.y === b.y; }
export function manhattan(a: Pos, b: Pos): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

export class GameGrid {
  w: number; h: number;
  terrain: TerrainType[][];
  units: Map<string, RuntimeUnit> = new Map();

  constructor(w: number, h: number, overrides: Record<string, TerrainType> = {}) {
    this.w = w; this.h = h;
    this.terrain = [];
    for (let y = 0; y < h; y++) { this.terrain[y] = []; for (let x = 0; x < w; x++) this.terrain[y][x] = "plain"; }
    for (const [key, type] of Object.entries(overrides)) {
      const [x, y] = key.split(",").map(Number);
      if (x >= 0 && x < w && y >= 0 && y < h) this.terrain[y][x] = type;
    }
  }
  getTerrain(p: Pos): TerrainType { return p.x < 0 || p.x >= this.w || p.y < 0 || p.y >= this.h ? "wall" : this.terrain[p.y][p.x]; }
  getTerrainDef(p: Pos) { return TERRAIN[this.getTerrain(p)]; }
  getUnitAt(p: Pos) { return this.units.get(posKey(p)); }
  placeUnit(u: RuntimeUnit, p: Pos) { this.units.set(posKey(p), u); u.pos = { ...p }; }
  moveUnit(u: RuntimeUnit, to: Pos) { this.units.delete(posKey(u.pos)); this.placeUnit(u, to); }
  removeUnit(u: RuntimeUnit) { this.units.delete(posKey(u.pos)); }
  isValid(p: Pos) { return p.x >= 0 && p.x < this.w && p.y >= 0 && p.y < this.h; }
  isPassable(p: Pos, mt: MoveType) { return this.isValid(p) && isPassable(this.getTerrain(p), mt); }
  getAllUnits() { return [...this.units.values()]; }

  computeMoveRange(start: Pos, movePts: number, mt: MoveType, selfUid: string): Map<string, Pos[]> {
    const result = new Map<string, Pos[]>();
    const costs = new Map<string, number>();
    const q: { pos: Pos; cost: number }[] = [{ pos: start, cost: 0 }];
    costs.set(posKey(start), 0);
    result.set(posKey(start), [start]);
    const dirs = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
    while (q.length > 0) {
      q.sort((a, b) => a.cost - b.cost);
      const cur = q.shift()!;
      for (const d of dirs) {
        const np = { x: cur.pos.x + d.x, y: cur.pos.y + d.y };
        if (!this.isValid(np)) continue;
        const t = this.getTerrain(np);
        if (!isPassable(t, mt)) continue;
        const occ = this.getUnitAt(np);
        if (occ && occ.uid !== selfUid && occ.faction !== "player" && occ.faction !== "ally") continue;
        const cost = cur.cost + getMoveCost(t, mt);
        if (cost > movePts) continue;
        if (cost < (costs.get(posKey(np)) ?? Infinity)) {
          costs.set(posKey(np), cost);
          result.set(posKey(np), [...result.get(posKey(cur.pos))!, np]);
          if (!occ || occ.uid === selfUid) q.push({ pos: np, cost });
        }
      }
    }
    for (const key of [...result.keys()]) {
      const p = result.get(key)![result.get(key)!.length - 1];
      const occ = this.getUnitAt(p);
      if (occ && occ.uid !== selfUid) result.delete(key);
    }
    return result;
  }

  computeAttackRange(origin: Pos, minR: number, maxR: number): Pos[] {
    const result: Pos[] = [];
    for (let dy = -maxR; dy <= maxR; dy++)
      for (let dx = -maxR; dx <= maxR; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= minR && d <= maxR) { const p = { x: origin.x + dx, y: origin.y + dy }; if (this.isValid(p)) result.push(p); }
      }
    return result;
  }
}
