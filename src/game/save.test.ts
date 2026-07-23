import { beforeEach, describe, expect, it } from "vitest";
import { CHAPTERS, CLASSES, WEAPONS } from "../data/gameData";
import { createUnit } from "../data/unitFactory";
import type { RuntimeUnit } from "../types";
import { syncCampaignRoster } from "./campaign";
import {
  save,
  serializeRuntimeUnit,
  type SaveWritePayload,
} from "./save";

function makePayload(
  units: RuntimeUnit[],
  overrides: Partial<SaveWritePayload> = {},
): SaveWritePayload {
  const chapter = CHAPTERS[0];
  return {
    chapterId: chapter.id,
    chapterIndex: 0,
    turn: 1,
    phase: "player",
    units: units.map(serializeRuntimeUnit),
    campaignRoster: syncCampaignRoster({}, units),
    convoy: [],
    gold: 0,
    completedChapters: [],
    activeDialogue: null,
    bossDeathDialogueComplete: false,
    victoryResolved: false,
    lang: "en",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("save/load system", () => {
  it("writes and reads a complete version-2 autosave", () => {
    const chapter = CHAPTERS[0];
    const unit = createUnit("kael", chapter.deploymentPoints[0]);
    unit.weapons[0].uses = 17;

    const ok = save.write(makePayload([unit], {
      turn: 3,
      convoy: [{ id: "vulnerary", type: "item", uses: 2 }],
      gold: 1450,
      completedChapters: ["ch01"],
      bossDeathDialogueComplete: true,
    }), null);

    expect(ok).toBe(true);
    expect(save.hasAutosave()).toBe(true);
    const data = save.readAutosave();
    expect(data?.version).toBe(2);
    expect(data?.turn).toBe(3);
    expect(data?.gold).toBe(1450);
    expect(data?.completedChapters).toEqual(["ch01"]);
    expect(data?.units[0].weapons[0]).toEqual({ id: "iron_sword", uses: 17 });
    expect(data?.campaignRoster.kael.weapons[0].uses).toBe(17);
    expect(data?.bossDeathDialogueComplete).toBe(true);
  });

  it("writes to named slots and tracks meta", () => {
    const unit = createUnit("kael", CHAPTERS[0].deploymentPoints[0]);
    const ok = save.write(makePayload([unit]), "slot0");

    expect(ok).toBe(true);
    const meta = save.getMeta();
    expect(meta.slots).toHaveLength(1);
    expect(meta.slots[0].id).toBe("slot0");
  });

  it("hydrates promoted classes, max HP, equipment, and weapon uses", () => {
    const unit = createUnit("kael", CHAPTERS[0].deploymentPoints[0]);
    unit.classDef = CLASSES.lord_knight;
    unit.level = 12;
    unit.maxHp = 35;
    unit.hp = 9;
    unit.weapons.push({ ...WEAPONS.killing_edge, uses: 7 });
    unit.equippedWeapon = unit.weapons[unit.weapons.length - 1];
    save.write(makePayload([unit]), "slot1");

    const data = save.read("slot1");
    expect(data).not.toBeNull();
    const { units, grid } = save.applyToGrid(data!);
    const hydrated = units[0];

    expect(hydrated.uid).toBe(unit.uid);
    expect(hydrated.classDef.id).toBe("lord_knight");
    expect(hydrated.level).toBe(12);
    expect(hydrated.hp).toBe(9);
    expect(hydrated.maxHp).toBe(35);
    expect(hydrated.equippedWeapon?.id).toBe("killing_edge");
    expect(hydrated.equippedWeapon?.uses).toBe(7);
    expect(hydrated.equippedWeapon).not.toBe(WEAPONS.killing_edge);
    expect(grid.getUnitAt(unit.pos)?.uid).toBe(unit.uid);
  });

  it("keeps dead units in save data without placing them on the grid", () => {
    const chapter = CHAPTERS[0];
    const kael = createUnit("kael", chapter.deploymentPoints[0]);
    const lyra = createUnit("lyra", chapter.deploymentPoints[1]);
    lyra.hp = 0;
    lyra.isDead = true;
    save.write(makePayload([kael, lyra]), "slot2");

    const data = save.read("slot2");
    const { units, grid } = save.applyToGrid(data!);

    expect(units).toHaveLength(2);
    expect(units.find(unit => unit.def.id === "lyra")?.isDead).toBe(true);
    expect(grid.getAllUnits()).toHaveLength(1);
    expect(grid.getUnitAt(lyra.pos)).toBeUndefined();
  });

  it("migrates version-1 saves with safe defaults", () => {
    const unit = createUnit("kael", CHAPTERS[0].deploymentPoints[0]);
    save.markChapterComplete("ch01");
    localStorage.setItem("embers:save:legacy", JSON.stringify({
      version: 1,
      chapterId: "ch02",
      chapterIndex: 1,
      turn: 4,
      phase: "player",
      units: [{
        uid: unit.uid,
        defId: unit.def.id,
        pos: { ...unit.pos },
        hp: unit.hp - 3,
        exp: 42,
        level: 3,
        stats: { ...unit.stats },
        weapons: ["iron_sword"],
        equippedWeaponIdx: 0,
        hasMoved: false,
        hasActed: true,
        isDead: false,
        isBoss: false,
        aiType: unit.aiType,
        faction: unit.faction,
        modelId: unit.modelId,
      }],
      convoy: [{ id: "vulnerary", type: "item", uses: 1 }],
      lang: "en",
      savedAt: 123,
    }));

    const migrated = save.read("legacy");

    expect(migrated?.version).toBe(2);
    expect(migrated?.gold).toBe(0);
    expect(migrated?.completedChapters).toEqual(["ch01"]);
    expect(migrated?.units[0].classId).toBe(unit.classDef.id);
    expect(migrated?.units[0].weapons[0]).toEqual({
      id: "iron_sword",
      uses: WEAPONS.iron_sword.uses,
    });
    expect(migrated?.campaignRoster.kael.uid).toBe(unit.uid);
  });

  it("merges restored completed chapters without duplicates", () => {
    save.markChapterComplete("ch01");
    save.mergeCompletedChapters(["ch01", "ch02"]);
    expect(save.getMeta().completedChapters).toEqual(["ch01", "ch02"]);
  });

  it("removes a slot and updates meta", () => {
    save.write(makePayload([]), "slotX");
    expect(save.getMeta().slots).toHaveLength(1);
    save.remove("slotX");
    expect(save.getMeta().slots).toHaveLength(0);
  });

  it("returns null for corrupt, unsupported, or missing saves", () => {
    localStorage.setItem("embers:save:corrupt", "{bad json");
    localStorage.setItem("embers:save:future", JSON.stringify({ version: 99 }));

    expect(save.read("corrupt")).toBeNull();
    expect(save.read("future")).toBeNull();
    expect(save.read("missing")).toBeNull();
    expect(save.readAutosave()).toBeNull();
    expect(save.hasAutosave()).toBe(false);
  });
});
