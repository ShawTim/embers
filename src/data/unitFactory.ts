import type { RuntimeUnit, UnitDef } from "../types";
import { CLASSES, WEAPONS, UNITS } from "./gameData";

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
  const weapons = def.inventory.map(id => WEAPONS[id]).filter(Boolean);
  const equippedWeapon = weapons.find(w => w.type !== "staff") || weapons[0] || null;
  return {
    uid: `${defId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    def, classDef, level: def.level, exp: 0, hp: maxHp, maxHp, stats, weapons, equippedWeapon,
    pos: { ...pos }, faction: def.faction, hasMoved: false, hasActed: false, isDead: false,
    isBoss: def.isBoss || false, aiType: def.aiType || "aggressive", skills: def.personalSkills || [],
    modelId: def.modelId,
  };
}
