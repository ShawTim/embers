import { describe, it, expect, beforeEach } from "vitest";
import { save } from "./save";
import { CHAPTERS } from "../data/gameData";
import { createUnit } from "../data/unitFactory";
import { GameGrid } from "./grid";
import type { RuntimeUnit } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("save/load system", () => {
  it("writes and reads back an autosave", () => {
    const ch = CHAPTERS[0];
    const grid = new GameGrid(ch.mapSize.w, ch.mapSize.h, ch.terrain as any);
    const u = createUnit("kael", ch.deploymentPoints[0]);
    grid.placeUnit(u, u.pos);
    const units: RuntimeUnit[] = [u];

    const ok = save.write({
      chapterId: ch.id,
      chapterIndex: 0,
      turn: 3,
      phase: "player",
      units: units.map(un => ({
        uid: un.uid, defId: un.def.id, pos: { ...un.pos },
        hp: un.hp, exp: un.exp, level: un.level, stats: { ...un.stats },
        weapons: un.weapons.map(w => w.id), equippedWeaponIdx: 0,
        hasMoved: un.hasMoved, hasActed: un.hasActed, isDead: un.isDead,
        isBoss: un.isBoss, aiType: un.aiType, faction: un.faction, modelId: un.modelId,
      })),
      convoy: [{ id: "vulnerary", type: "item", uses: 3 }],
      lang: "en",
    }, null);
    expect(ok).toBe(true);
    expect(save.hasAutosave()).toBe(true);

    const data = save.readAutosave();
    expect(data).not.toBeNull();
    expect(data!.turn).toBe(3);
    expect(data!.units[0].defId).toBe("kael");
    expect(data!.units[0].hp).toBe(u.hp);
  });

  it("writes to named slots and tracks meta", () => {
    const ch = CHAPTERS[0];
    const u = createUnit("kael", ch.deploymentPoints[0]);
    const ok = save.write({
      chapterId: ch.id, chapterIndex: 0, turn: 1, phase: "player",
      units: [{ uid: u.uid, defId: "kael", pos: { ...u.pos }, hp: u.hp, exp: 0, level: u.level, stats: { ...u.stats }, weapons: ["iron_sword"], equippedWeaponIdx: 0, hasMoved: false, hasActed: false, isDead: false, isBoss: false, aiType: "aggressive", faction: "player", modelId: "Paladin" }],
      convoy: [], lang: "en",
    }, "slot0");
    expect(ok).toBe(true);
    const meta = save.getMeta();
    expect(meta.slots.length).toBe(1);
    expect(meta.slots[0].id).toBe("slot0");
  });

  it("applyToGrid hydrates units into a fresh grid", () => {
    const ch = CHAPTERS[0];
    const u = createUnit("kael", ch.deploymentPoints[0]);
    u.hp = u.hp - 5;
    u.exp = 50;
    u.level = 2;
    save.write({
      chapterId: ch.id, chapterIndex: 0, turn: 2, phase: "player",
      units: [{ uid: u.uid, defId: "kael", pos: { ...u.pos }, hp: u.hp, exp: u.exp, level: u.level, stats: { ...u.stats }, weapons: u.weapons.map(w => w.id), equippedWeaponIdx: 0, hasMoved: false, hasActed: false, isDead: false, isBoss: false, aiType: "aggressive", faction: "player", modelId: u.modelId }],
      convoy: [], lang: "en",
    }, "slot1");
    const data = save.read("slot1");
    expect(data).not.toBeNull();
    const { units: hydrated, grid } = save.applyToGrid(data!);
    expect(hydrated.length).toBe(1);
    expect(hydrated[0].def.id).toBe("kael");
    expect(hydrated[0].hp).toBe(u.hp);
    expect(hydrated[0].level).toBe(2);
    // Grid should have the unit placed
    const onGrid = grid.getUnitAt(u.pos);
    expect(onGrid).toBeDefined();
  });

  it("skips dead units on the grid but keeps them in the units array", () => {
    const ch = CHAPTERS[0];
    const a = createUnit("kael", ch.deploymentPoints[0]);
    const b = createUnit("lyra", ch.deploymentPoints[1]);
    b.isDead = true;
    save.write({
      chapterId: ch.id, chapterIndex: 0, turn: 2, phase: "player",
      units: [
        { uid: a.uid, defId: "kael", pos: { ...a.pos }, hp: a.hp, exp: 0, level: a.level, stats: { ...a.stats }, weapons: [], equippedWeaponIdx: -1, hasMoved: false, hasActed: false, isDead: false, isBoss: false, aiType: "aggressive", faction: "player", modelId: a.modelId },
        { uid: b.uid, defId: "lyra", pos: { ...b.pos }, hp: 0, exp: 0, level: b.level, stats: { ...b.stats }, weapons: [], equippedWeaponIdx: -1, hasMoved: false, hasActed: false, isDead: true, isBoss: false, aiType: "aggressive", faction: "player", modelId: b.modelId },
      ],
      convoy: [], lang: "en",
    }, "slot2");
    const data = save.read("slot2")!;
    const { units: hydrated, grid } = save.applyToGrid(data);
    expect(hydrated.length).toBe(2);
    // The dead unit should NOT be on the grid
    const liveOnGrid = grid.getAllUnits();
    expect(liveOnGrid.length).toBe(1);
    expect(grid.getUnitAt(b.pos)).toBeUndefined();
  });

  it("remove() deletes a slot and updates meta", () => {
    save.write({ chapterId: "ch01", chapterIndex: 0, turn: 1, phase: "player", units: [], convoy: [], lang: "en" }, "slotX");
    expect(save.getMeta().slots.length).toBe(1);
    save.remove("slotX");
    expect(save.getMeta().slots.length).toBe(0);
  });

  it("markChapterComplete persists in meta", () => {
    save.markChapterComplete("ch01");
    expect(save.isChapterComplete("ch01")).toBe(true);
    expect(save.isChapterComplete("ch02")).toBe(false);
    // Idempotent
    save.markChapterComplete("ch01");
    expect(save.getMeta().completedChapters.length).toBe(1);
  });

  it("returns null for unknown slots / missing autosave", () => {
    expect(save.read("nope")).toBeNull();
    expect(save.readAutosave()).toBeNull();
    expect(save.hasAutosave()).toBe(false);
  });
});
