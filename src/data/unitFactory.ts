import type { RuntimeUnit, UnitDef } from "../types";
import { CLASSES, WEAPONS, ITEMS, UNITS, PROMOTIONS } from "./gameData";

const EXP_PER_LEVEL = 100;

export function maybeLevelUp(unit: RuntimeUnit, onLevelUp?: (newLevel: number) => void): { leveledUp: boolean; newLevel: number; statGains: Record<string, number> } {
  let levelsGained = 0;
  const allGains: Record<string, number> = {};
  while (unit.exp >= EXP_PER_LEVEL && unit.level < 20) {
    unit.exp -= EXP_PER_LEVEL;
    unit.level += 1;
    levelsGained++;
    const classDef = unit.classDef;
    const def = unit.def;
    for (const stat of Object.keys(classDef.base)) {
      const growth = classDef.growth[stat] || 0;
      const personal = def.growthBonus?.[stat] || 0;
      const chance = growth + personal;
      if (Math.random() * 100 < chance) {
        unit.stats[stat] = (unit.stats[stat] || 0) + 1;
        allGains[stat] = (allGains[stat] || 0) + 1;
      }
    }
    // Recompute max HP if HP grew
    if (unit.stats.hp > unit.maxHp) {
      const diff = unit.stats.hp - unit.maxHp;
      unit.maxHp = unit.stats.hp;
      unit.hp += diff;
    }
  }
  if (levelsGained > 0 && onLevelUp) onLevelUp(unit.level);
  return { leveledUp: levelsGained > 0, newLevel: unit.level, statGains: allGains };
}

export function createUnit(defId: string, pos: { x: number; y: number }, overrides?: Partial<UnitDef>): RuntimeUnit {
  const baseDef = UNITS[defId];
  if (!baseDef) throw new Error(`Unit not found: ${defId}`);
  const def = { ...baseDef, ...overrides };
  const classDef = CLASSES[def.classId];
  if (!classDef) throw new Error(`Class not found: ${def.classId}`);
  const stats: Record<string, number> = {};
  for (const stat of Object.keys(classDef.base)) {
    const base = classDef.base[stat];
    const growth = classDef.growth[stat] || 0;
    const personal = def.growthBonus?.[stat] || 0;
    stats[stat] = base + Math.floor((growth + personal) * 0.01 * (def.level - 1));
  }
  const maxHp = stats.hp;
  const weapons = def.inventory.filter((id: string) => WEAPONS[id]).map((id: string) => WEAPONS[id]);
  const equippedWeapon = weapons.find((w: any) => w.type !== "staff") || weapons[0] || null;
  return {
    uid: `${defId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    def, classDef, level: def.level, exp: 0, hp: maxHp, maxHp, stats, weapons, equippedWeapon,
    pos: { ...pos }, faction: def.faction, hasMoved: false, hasActed: false, isDead: false,
    isBoss: def.isBoss || false, aiType: def.aiType || "aggressive", skills: def.personalSkills || [],
    modelId: def.modelId,
  };
}

export function promoteUnit(unit: RuntimeUnit): boolean {
  const promotedClassId = PROMOTIONS[unit.classDef.id];
  if (!promotedClassId) return false;
  const newClass = CLASSES[promotedClassId];
  if (!newClass) return false;
  const oldClass = unit.classDef;
  for (const stat of Object.keys(newClass.base)) {
    const boost = (newClass.base[stat] - oldClass.base[stat]) + 3;
    unit.stats[stat] = Math.min(unit.stats[stat] + Math.max(0, boost), newClass.caps[stat] || 99);
  }
  unit.maxHp = unit.stats.hp;
  unit.hp = unit.maxHp;
  unit.classDef = newClass;
  for (const wt of newClass.weapons) {
    if (!oldClass.weapons.includes(wt)) {
      const basicWeapon = Object.values(WEAPONS).find((w: any) => w.type === wt && w.rank === 1);
      if (basicWeapon && !unit.weapons.find((w: any) => w.id === basicWeapon.id)) {
        unit.weapons.push(basicWeapon);
      }
    }
  }
  return true;
}

export function useItemOnUnit(itemId: string, unit: RuntimeUnit): { success: boolean; message: string } {
  const item = ITEMS[itemId];
  if (!item) return { success: false, message: "Item not found" };
  switch (item.type) {
    case "heal":
      if (unit.hp >= unit.maxHp) return { success: false, message: "Already at full HP" };
      const heal = item.healPercent ? Math.floor(unit.maxHp * item.healPercent / 100) : (item.healAmount || 0);
      unit.hp = Math.min(unit.maxHp, unit.hp + heal);
      return { success: true, message: `+${heal} HP` };
    case "boost":
      if (item.statTarget && item.statAmount) {
        unit.stats[item.statTarget] = (unit.stats[item.statTarget] || 0) + item.statAmount;
        return { success: true, message: `+${item.statAmount} ${item.statTarget.toUpperCase()}` };
      }
      return { success: false, message: "Invalid boost" };
    case "promote":
      if (unit.level < 10) return { success: false, message: "Must be Lv10+" };
      if (unit.classDef.tier >= 2) return { success: false, message: "Already promoted" };
      const ok = promoteUnit(unit);
      return { success: ok, message: ok ? "Promoted!" : "Cannot promote" };
    default:
      return { success: false, message: "Cannot use" };
  }
}
