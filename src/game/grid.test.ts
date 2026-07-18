import { describe, it, expect } from "vitest";
import { GameGrid, posKey, manhattan, type Pos } from "./grid";
import { createUnit } from "../data/unitFactory";

describe("GameGrid", () => {
  it("creates a grid with default plain terrain", () => {
    const g = new GameGrid(8, 6);
    expect(g.w).toBe(8);
    expect(g.h).toBe(6);
    expect(g.getTerrain({ x: 0, y: 0 })).toBe("plain");
    expect(g.getTerrain({ x: 7, y: 5 })).toBe("plain");
  });

  it("applies terrain overrides", () => {
    const g = new GameGrid(8, 6, { "1,1": "forest", "3,4": "wall" });
    expect(g.getTerrain({ x: 1, y: 1 })).toBe("forest");
    expect(g.getTerrain({ x: 3, y: 4 })).toBe("wall");
  });

  it("returns 'wall' for out-of-bounds", () => {
    const g = new GameGrid(4, 4);
    expect(g.getTerrain({ x: -1, y: 0 })).toBe("wall");
    expect(g.getTerrain({ x: 4, y: 0 })).toBe("wall");
    expect(g.getTerrain({ x: 0, y: 10 })).toBe("wall");
  });

  it("posKey encodes positions", () => {
    expect(posKey({ x: 3, y: 7 })).toBe("3,7");
  });

  it("manhattan distance", () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattan({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it("placeUnit and getUnitAt", () => {
    const g = new GameGrid(4, 4);
    const u = createUnit("kael", { x: 1, y: 1 });
    g.placeUnit(u, { x: 1, y: 1 });
    expect(g.getUnitAt({ x: 1, y: 1 })).toBe(u);
    expect(g.getUnitAt({ x: 2, y: 2 })).toBeUndefined();
  });

  it("moveUnit clears old and sets new", () => {
    const g = new GameGrid(4, 4);
    const u = createUnit("kael", { x: 0, y: 0 });
    g.placeUnit(u, { x: 0, y: 0 });
    g.moveUnit(u, { x: 1, y: 0 });
    expect(g.getUnitAt({ x: 0, y: 0 })).toBeUndefined();
    expect(g.getUnitAt({ x: 1, y: 0 })).toBe(u);
    expect(u.pos).toEqual({ x: 1, y: 0 });
  });

  it("removeUnit", () => {
    const g = new GameGrid(4, 4);
    const u = createUnit("kael", { x: 2, y: 2 });
    g.placeUnit(u, { x: 2, y: 2 });
    g.removeUnit(u);
    expect(g.getUnitAt({ x: 2, y: 2 })).toBeUndefined();
  });

  it("computeMoveRange returns reachable tiles", () => {
    const g = new GameGrid(8, 8);
    const u = createUnit("kael", { x: 4, y: 4 });
    g.placeUnit(u, { x: 4, y: 4 });
    const mr = g.computeMoveRange({ x: 4, y: 4 }, 3, "infantry", u.uid);
    expect(mr.has(posKey({ x: 4, y: 4 }))).toBe(true);
    expect(mr.has(posKey({ x: 6, y: 4 }))).toBe(true); // 2 tiles east
    expect(mr.has(posKey({ x: 7, y: 4 }))).toBe(true); // 3 tiles east
  });

  it("computeMoveRange excludes impassable terrain", () => {
    const g = new GameGrid(8, 8, { "5,4": "wall" });
    const u = createUnit("kael", { x: 4, y: 4 });
    g.placeUnit(u, { x: 4, y: 4 });
    const mr = g.computeMoveRange({ x: 4, y: 4 }, 1, "infantry", u.uid);
    // With 1 move point: only the 4 cardinal neighbours
    expect(mr.has(posKey({ x: 5, y: 4 }))).toBe(false); // wall — excluded
    expect(mr.has(posKey({ x: 4, y: 3 }))).toBe(true);
    expect(mr.has(posKey({ x: 4, y: 5 }))).toBe(true);
    expect(mr.has(posKey({ x: 3, y: 4 }))).toBe(true);
    // tile past the wall needs 4 moves (around it)
    const mr2 = g.computeMoveRange({ x: 4, y: 4 }, 4, "infantry", u.uid);
    expect(mr2.has(posKey({ x: 5, y: 4 }))).toBe(false); // still wall
    expect(mr2.has(posKey({ x: 6, y: 4 }))).toBe(true); // around or past
  });

  it("computeMoveRange respects move budget", () => {
    const g = new GameGrid(8, 8);
    const u = createUnit("kael", { x: 4, y: 4 });
    g.placeUnit(u, { x: 4, y: 4 });
    const mr = g.computeMoveRange({ x: 4, y: 4 }, 2, "infantry", u.uid);
    // 2 move points: reach 2 tiles cardinal
    expect(mr.has(posKey({ x: 6, y: 4 }))).toBe(true);
    expect(mr.has(posKey({ x: 4, y: 3 }))).toBe(true);
    // 3 tiles not reachable
    expect(mr.has(posKey({ x: 7, y: 4 }))).toBe(false);
  });

  it("computeAttackRange includes 1-tile diagonals (Manhattan)", () => {
    const g = new GameGrid(8, 8);
    const range = g.computeAttackRange({ x: 4, y: 4 }, 1, 1);
    expect(range).toContainEqual({ x: 4, y: 3 });
    expect(range).toContainEqual({ x: 4, y: 5 });
    expect(range).toContainEqual({ x: 3, y: 4 });
    expect(range).toContainEqual({ x: 5, y: 4 });
    // Manhattan distance 2 (diagonal) — should be excluded for minR=maxR=1
    expect(range).not.toContainEqual({ x: 3, y: 3 });
    expect(range).not.toContainEqual({ x: 3, y: 5 });
    expect(range).not.toContainEqual({ x: 5, y: 3 });
    expect(range).not.toContainEqual({ x: 5, y: 5 });
  });

  it("computeAttackRange with minR=1 excludes origin", () => {
    const g = new GameGrid(8, 8);
    const range = g.computeAttackRange({ x: 4, y: 4 }, 1, 2);
    expect(range).not.toContainEqual({ x: 4, y: 4 });
    const dists = range.map(p => Math.abs(p.x - 4) + Math.abs(p.y - 4));
    expect(dists.every(d => d >= 1 && d <= 2)).toBe(true);
  });
});
