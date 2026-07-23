import { describe, it, expect } from "vitest";
import {
  consumeEquippedWeaponUse,
  getAttackPower,
  getCritRate,
  getHitRate,
  getWeaponTriangle,
  previewCombat,
  removeBrokenWeapons,
  resolveCombat,
} from "./combat";
import { createUnit } from "../data/unitFactory";
import { GameGrid } from "./grid";
import { WEAPONS } from "../data/gameData";

describe("combat", () => {
  it("getAttackPower for staff is 0", () => {
    const u = createUnit("lyra", { x: 0, y: 0 });
    u.equippedWeapon = (u.weapons.find(w => w.type === "staff") || u.weapons[0]) ?? null;
    expect(getAttackPower(u)).toBe(0);
  });

  it("getAttackPower for sword uses STR", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    u.equippedWeapon = u.weapons.find(w => w.type === "sword") ?? u.weapons[0] ?? null;
    expect(u.equippedWeapon).not.toBeNull();
    const ap = getAttackPower(u);
    // ap = max(0, str + might)
    expect(ap).toBeGreaterThan(0);
    expect(ap).toBe((u.stats.str || 0) + (u.equippedWeapon!.might));
  });

  it("getWeaponTriangle: sword beats axe beats lance beats sword", () => {
    const a = { triangle: "sword" } as any;
    const d = { triangle: "axe" } as any;
    expect(getWeaponTriangle(a, d)).toBe(1);
    expect(getWeaponTriangle(d, a)).toBe(-1);
    expect(getWeaponTriangle(a, { triangle: "lance" } as any)).toBe(-1);
  });

  it("getWeaponTriangle returns 0 for non-weapon triangles", () => {
    expect(getWeaponTriangle({ triangle: "bow" } as any, { triangle: "axe" } as any)).toBe(0);
  });

  it("getHitRate is non-negative (raw, capped at 255 in code)", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    expect(getHitRate(u)).toBeGreaterThan(0);
    expect(getHitRate(u)).toBeLessThanOrEqual(255);
  });

  it("getCritRate is non-negative", () => {
    const u = createUnit("kael", { x: 0, y: 0 });
    expect(getCritRate(u)).toBeGreaterThanOrEqual(0);
  });

  it("previewCombat caps display hit at 100", () => {
    const kael = createUnit("kael", { x: 0, y: 0 });
    const bandit = createUnit("bandit_sword", { x: 0, y: 1 });
    const p = previewCombat(kael, bandit, "plain", "plain");
    expect(p.attackerHit).toBeLessThanOrEqual(100);
    expect(p.attackerHit).toBeGreaterThan(0);
  });

  it("previewCombat returns attackerDmg and defenderDmg", () => {
    const kael = createUnit("kael", { x: 0, y: 0 });
    const bandit = createUnit("bandit_sword", { x: 0, y: 1 });
    const g = new GameGrid(4, 4);
    const p = previewCombat(kael, bandit, "plain", "plain");
    expect(typeof p.attackerDmg).toBe("number");
    expect(p.attackerDmg).toBeGreaterThanOrEqual(0);
    expect(p.willCounter).toBe(true); // melee vs melee
  });

  it("previewCombat: staff attacks do 0 dmg but healer has staff", () => {
    const lyra = createUnit("lyra", { x: 0, y: 0 });
    const bandit = createUnit("bandit_sword", { x: 0, y: 1 });
    const p = previewCombat(lyra, bandit, "plain", "plain");
    expect(p.attackerDmg).toBe(0);
  });

  it("resolveCombat damages target and respects HP bounds", () => {
    const origRandom = Math.random;
    // Force: every hit check passes, no crits
    let i = 0;
    Math.random = () => { const r = i % 2 === 0 ? 0 : 1; i++; return r; };
    try {
      const kael = createUnit("kael", { x: 0, y: 0 });
      const bandit = createUnit("bandit_sword", { x: 0, y: 1 });
      const initialHp = bandit.hp;
      const rounds = resolveCombat(kael, bandit, "plain", "plain");
      expect(rounds.length).toBeGreaterThan(0);
      // bandit hp should decrease
      expect(bandit.hp).toBeLessThan(initialHp);
      // hp never goes negative
      expect(bandit.hp).toBeGreaterThanOrEqual(0);
    } finally {
      Math.random = origRandom;
    }
  });

  it("consumes durability on every attack attempt, including misses", () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
      const kael = createUnit("kael", { x: 0, y: 0 });
      const bandit = createUnit("bandit_sword", { x: 0, y: 1 });
      if (!kael.equippedWeapon) throw new Error("Kael has no weapon");
      kael.equippedWeapon.hit = 0;
      kael.equippedWeapon.uses = 5;

      const rounds = resolveCombat(kael, bandit, "plain", "plain");

      expect(rounds[0].hit).toBe(false);
      expect(kael.equippedWeapon.uses).toBe(4);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("limits follow-up attacks to remaining durability", () => {
    const kael = createUnit("kael", { x: 0, y: 0 });
    const bandit = createUnit("bandit_axe", { x: 0, y: 1 });
    if (!kael.equippedWeapon) throw new Error("Kael has no weapon");
    kael.stats.spd = bandit.stats.spd + 10;
    kael.equippedWeapon.uses = 1;

    const preview = previewCombat(kael, bandit, "plain", "plain");
    const rounds = resolveCombat(kael, bandit, "plain", "plain");

    expect(preview.attackerDoubles).toBe(false);
    expect(rounds.filter(round => round.attacker === kael)).toHaveLength(1);
    expect(kael.equippedWeapon.uses).toBe(0);
  });

  it("removes broken weapons and automatically equips the next weapon", () => {
    const kael = createUnit("kael", { x: 0, y: 0 });
    const brokenWeapon = kael.weapons[0];
    brokenWeapon.uses = 0;
    kael.weapons.push({ ...WEAPONS.killing_edge, uses: 8 });

    const broken = removeBrokenWeapons([kael]);

    expect(broken).toEqual([{ unit: kael, weapon: brokenWeapon }]);
    expect(kael.weapons).toHaveLength(1);
    expect(kael.equippedWeapon?.id).toBe("killing_edge");
  });

  it("consumes staff durability and removes the staff at zero uses", () => {
    const lyra = createUnit("lyra", { x: 0, y: 0 });
    if (!lyra.equippedWeapon) throw new Error("Lyra has no staff");
    lyra.equippedWeapon.uses = 1;

    const broken = consumeEquippedWeaponUse(lyra);

    expect(broken).toHaveLength(1);
    expect(broken[0].weapon.id).toBe("heal_staff");
    expect(lyra.weapons).toHaveLength(0);
    expect(lyra.equippedWeapon).toBeNull();
  });
});
