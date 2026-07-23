import { CLASSES, WEAPONS } from "../data/gameData";
import { createUnit } from "../data/unitFactory";
import type { RuntimeUnit } from "../types";

export interface CampaignWeaponState {
  id: string;
  uses: number;
}

export interface CampaignUnitState {
  uid: string;
  defId: string;
  classId: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  stats: Record<string, number>;
  weapons: CampaignWeaponState[];
  equippedWeaponIdx: number;
  isDead: boolean;
  modelId: string;
}

export type CampaignRoster = Record<string, CampaignUnitState>;

export const PLAYER_IDS_BY_CHAPTER: Record<string, string[]> = {
  ch01: ["kael", "lyra", "borin", "serra"],
  ch02: ["kael", "lyra", "borin", "serra"],
  ch03: ["kael", "lyra", "borin", "serra", "maren"],
  ch04: ["kael", "lyra", "borin", "serra", "maren"],
  ch05: ["kael", "lyra", "borin", "serra", "maren"],
  ch06: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch07: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch08: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch09: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch10: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch11: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch12: ["kael", "lyra", "borin", "serra", "maren", "darius"],
  ch13: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch14: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch15: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch16: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch17: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch18: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch19: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
  ch20: ["kael", "lyra", "borin", "serra", "maren", "darius", "yuki"],
};

export function snapshotCampaignUnit(unit: RuntimeUnit): CampaignUnitState {
  return {
    uid: unit.uid,
    defId: unit.def.id,
    classId: unit.classDef.id,
    level: unit.level,
    exp: unit.exp,
    hp: unit.hp,
    maxHp: unit.maxHp,
    stats: { ...unit.stats },
    weapons: unit.weapons.map(weapon => ({ id: weapon.id, uses: weapon.uses })),
    equippedWeaponIdx: unit.equippedWeapon
      ? unit.weapons.findIndex(weapon => weapon === unit.equippedWeapon)
      : -1,
    isDead: unit.isDead,
    modelId: unit.modelId,
  };
}

export function syncCampaignRoster(
  roster: CampaignRoster,
  units: RuntimeUnit[],
): CampaignRoster {
  const next = { ...roster };
  for (const unit of units) {
    if (unit.faction === "player") next[unit.def.id] = snapshotCampaignUnit(unit);
  }
  return next;
}

export function createCampaignRuntimeUnit(
  state: CampaignUnitState,
  pos: { x: number; y: number },
  fullHeal = true,
): RuntimeUnit {
  const unit = createUnit(state.defId, pos);
  unit.uid = state.uid;
  unit.classDef = CLASSES[state.classId] || unit.classDef;
  unit.level = state.level;
  unit.exp = state.exp;
  unit.stats = { ...state.stats };
  unit.maxHp = state.maxHp;
  unit.hp = fullHeal ? state.maxHp : Math.min(state.hp, state.maxHp);
  unit.weapons = state.weapons
    .map(saved => {
      const definition = WEAPONS[saved.id];
      return definition ? { ...definition, uses: saved.uses } : null;
    })
    .filter((weapon): weapon is NonNullable<typeof weapon> => weapon !== null);
  unit.equippedWeapon = state.equippedWeaponIdx >= 0
    ? unit.weapons[state.equippedWeaponIdx] || unit.weapons[0] || null
    : unit.weapons[0] || null;
  unit.isDead = state.isDead;
  unit.modelId = state.modelId || unit.modelId;
  return unit;
}
