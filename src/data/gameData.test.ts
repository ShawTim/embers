import { describe, it, expect } from "vitest";
import { createUnit, maybeLevelUp } from "../data/unitFactory";
import { CHAPTERS, UNITS, CLASSES, WEAPONS, ITEMS } from "../data/gameData";

describe("unitFactory", () => {
  it("createUnit returns a runtime unit with all fields", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    expect(u.uid).toBeTruthy();
    expect(u.def.id).toBe("kael");
    expect(u.classDef.id).toBe("lord");
    expect(u.faction).toBe("player");
    expect(u.maxHp).toBeGreaterThan(0);
    expect(u.hp).toBe(u.maxHp);
    expect(u.weapons.length).toBeGreaterThan(0);
    expect(u.equippedWeapon).not.toBeNull();
  });

  it("createUnit respects position", () => {
    const u = createUnit("kael", { x: 5, y: 7 });
    expect(u.pos).toEqual({ x: 5, y: 7 });
  });

  it("createUnit with overrides (boss + isBoss)", () => {
    const u = createUnit("bandit_sword", { x: 0, y: 0 }, { isBoss: true });
    expect(u.isBoss).toBe(true);
  });

  it("maybeLevelUp gains stats on level up", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    const startLevel = u.level;
    const startHp = u.stats.hp;
    u.exp = 100; // exactly one level
    const result = maybeLevelUp(u);
    expect(result.leveledUp).toBe(true);
    expect(u.level).toBe(startLevel + 1);
    expect(u.exp).toBe(0);
    // maxHp should have grown with stats.hp
    expect(u.maxHp).toBeGreaterThanOrEqual(startHp);
  });

  it("maybeLevelUp caps at level 20", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    u.level = 20;
    u.exp = 1000;
    maybeLevelUp(u);
    expect(u.level).toBe(20);
  });

  it("non-player enemies have isBoss=false by default", () => {
    const u = createUnit("bandit_sword", { x: 0, y: 0 });
    expect(u.isBoss).toBe(false);
    expect(u.faction).toBe("enemy");
  });
});

describe("gameData", () => {
  it("CHAPTERS has 20 chapters", () => {
    expect(CHAPTERS.length).toBe(20);
  });

  it("All chapter IDs are unique", () => {
    const ids = new Set(CHAPTERS.map(c => c.id));
    expect(ids.size).toBe(CHAPTERS.length);
  });

  it("All chapters have a valid objectiveType", () => {
    const valid = new Set(["route", "boss", "seize", "defend"]);
    for (const c of CHAPTERS) expect(valid.has(c.objectiveType)).toBe(true);
  });

  it("Seize chapters have a seizeTile", () => {
    for (const c of CHAPTERS) {
      if (c.objectiveType === "seize") {
        expect(c.seizeTile).toBeDefined();
        expect(c.seizeTile!.x).toBeGreaterThanOrEqual(0);
        expect(c.seizeTile!.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("Defend chapters have objectiveTurns", () => {
    for (const c of CHAPTERS) {
      if (c.objectiveType === "defend") {
        expect(c.objectiveTurns).toBeGreaterThan(0);
      }
    }
  });

  it("All chapter enemies have valid unitIds", () => {
    for (const c of CHAPTERS) {
      for (const e of c.enemies) {
        expect(UNITS[e.unitId]).toBeDefined();
      }
    }
  });

  it("UNITS has the boss units for boss-type chapters", () => {
    for (const c of CHAPTERS) {
      if (c.objectiveType === "boss") {
        const hasBoss = c.enemies.some(e => e.isBoss);
        expect(hasBoss).toBe(true);
      }
    }
  });

  it("Every UNITS entry has a classId that exists in CLASSES", () => {
    for (const [id, u] of Object.entries(UNITS)) {
      expect(CLASSES[u.classId], `Unit ${id} references missing class ${u.classId}`).toBeDefined();
    }
  });

  it("All unit inventory items exist in WEAPONS or ITEMS", () => {
    for (const [id, u] of Object.entries(UNITS)) {
      for (const item of u.inventory) {
        expect(WEAPONS[item] || ITEMS[item], `Unit ${id} has unknown inventory item ${item}`).toBeDefined();
      }
    }
  });
});
