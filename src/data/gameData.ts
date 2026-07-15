import type {
  TerrainDef, TerrainType, ClassDef, WeaponDef, MoveType,
  UnitDef, ChapterDef, ItemDef,
} from "../types";

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  plain:       { type: "plain",       name: "Plain",        defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 1, color: "#4a7a3a" },
  forest:      { type: "forest",      name: "Forest",       defBonus: 1, avoidBonus: 20, healPercent: 0, moveCost: 2, color: "#264822" },
  mountain:    { type: "mountain",    name: "Mountain",     defBonus: 3, avoidBonus: 30, healPercent: 0, moveCost: 4, color: "#7a6650", moveOverrides: { cavalry: 99, armored: 99 } },
  fort:        { type: "fort",        name: "Fort",         defBonus: 3, avoidBonus: 15, healPercent: 10, moveCost: 1, color: "#6a6a6e" },
  road:        { type: "road",        name: "Road",         defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 1, color: "#9a8e6e" },
  water:       { type: "water",       name: "Water",        defBonus: 0, avoidBonus: 10, healPercent: 0, moveCost: 3, color: "#284e8a", moveOverrides: { infantry: 99, cavalry: 99, armored: 99 } },
  deep_water:  { type: "deep_water",  name: "Deep Water",   defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 99, color: "#142848", moveOverrides: { flying: 1 } },
  cliff:       { type: "cliff",       name: "Cliff",        defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 99, color: "#5a5045", impassable: true, moveOverrides: { flying: 1 } },
  sand:        { type: "sand",        name: "Sand",         defBonus: 0, avoidBonus: 5,  healPercent: 0, moveCost: 2, color: "#c0a870" },
  thicket:     { type: "thicket",     name: "Thicket",      defBonus: 2, avoidBonus: 40, healPercent: 0, moveCost: 3, color: "#1a3818" },
  floor:       { type: "floor",       name: "Floor",        defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 1, color: "#6a5f55" },
  wall:        { type: "wall",        name: "Wall",         defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 99, color: "#3a3a3e", impassable: true },
  throne:      { type: "throne",      name: "Throne",       defBonus: 3, avoidBonus: 20, healPercent: 10, moveCost: 1, color: "#9a8030" },
  deployment:  { type: "deployment",  name: "Deployment",   defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 1, color: "#3a8a3a" },
  bridge:      { type: "bridge",      name: "Bridge",       defBonus: 0, avoidBonus: 0,  healPercent: 0, moveCost: 1, color: "#7a5e3e" },
};

export function getMoveCost(terrain: TerrainType, moveType: MoveType): number {
  const def = TERRAIN[terrain];
  if (def.moveOverrides && def.moveOverrides[moveType] !== undefined) return def.moveOverrides[moveType]!;
  if (moveType === "flying") return 1;
  return def.moveCost;
}

export function isPassable(terrain: TerrainType, moveType: MoveType): boolean {
  const def = TERRAIN[terrain];
  if (def.impassable && moveType !== "flying") return false;
  return getMoveCost(terrain, moveType) < 99;
}

export const WEAPONS: Record<string, WeaponDef> = {
  // === Swords ===
  iron_sword:   { id: "iron_sword",   name: "Iron Sword",   desc: "Standard steel sword.",            type: "sword", triangle: "sword", rank: 1, might: 5,  hit: 90, weight: 5, crit: 0,  minRange: 1, maxRange: 1, uses: 45 },
  steel_sword:  { id: "steel_sword",  name: "Steel Sword",  desc: "Heavier, harder-hitting.",         type: "sword", triangle: "sword", rank: 2, might: 8,  hit: 75, weight: 8, crit: 0,  minRange: 1, maxRange: 1, uses: 30 },
  silver_sword: { id: "silver_sword", name: "Silver Sword", desc: "Masterwork blade.",                type: "sword", triangle: "sword", rank: 3, might: 13, hit: 75, weight: 6, crit: 0,  minRange: 1, maxRange: 1, uses: 20 },
  slim_sword:   { id: "slim_sword",   name: "Slim Sword",   desc: "Light and easy to wield.",         type: "sword", triangle: "sword", rank: 1, might: 3,  hit: 100,weight: 2, crit: 0,  minRange: 1, maxRange: 1, uses: 50 },
  brave_sword:  { id: "brave_sword",  name: "Brave Sword",  desc: "Always strikes twice.",            type: "sword", triangle: "sword", rank: 3, might: 9,  hit: 75, weight: 7, crit: 0,  minRange: 1, maxRange: 1, uses: 30, brave: true },
  killing_edge: { id: "killing_edge", name: "Killing Edge", desc: "High critical rate.",              type: "sword", triangle: "sword", rank: 2, might: 6,  hit: 75, weight: 5, crit: 30, minRange: 1, maxRange: 1, uses: 20 },
  rapier:       { id: "rapier",       name: "Rapier",       desc: "Lord's blade. Effective vs armor.", type: "sword", triangle: "sword", rank: 1, might: 7,  hit: 95, weight: 3, crit: 10, minRange: 1, maxRange: 1, uses: 40, effective: { vs: ["armored"], multiplier: 2 } },

  // === Lances ===
  iron_lance:   { id: "iron_lance",   name: "Iron Lance",   desc: "Standard lance.",                  type: "lance", triangle: "lance", rank: 1, might: 6,  hit: 85, weight: 6, crit: 0,  minRange: 1, maxRange: 1, uses: 45 },
  steel_lance:  { id: "steel_lance",  name: "Steel Lance",  desc: "Heavier lance.",                   type: "lance", triangle: "lance", rank: 2, might: 9,  hit: 70, weight: 9, crit: 0,  minRange: 1, maxRange: 1, uses: 30 },
  silver_lance: { id: "silver_lance", name: "Silver Lance", desc: "Masterwork lance.",                type: "lance", triangle: "lance", rank: 3, might: 14, hit: 70, weight: 7, crit: 0,  minRange: 1, maxRange: 1, uses: 20 },
  slim_lance:   { id: "slim_lance",   name: "Slim Lance",   desc: "Light lance.",                     type: "lance", triangle: "lance", rank: 1, might: 4,  hit: 95, weight: 3, crit: 0,  minRange: 1, maxRange: 1, uses: 50 },
  javelin:      { id: "javelin",      name: "Javelin",      desc: "Throwable lance. Range 1-2.",      type: "lance", triangle: "lance", rank: 1, might: 5,  hit: 70, weight: 7, crit: 0,  minRange: 1, maxRange: 2, uses: 20 },

  // === Axes ===
  iron_axe:     { id: "iron_axe",     name: "Iron Axe",     desc: "Heavy-hitting but inaccurate.",    type: "axe",   triangle: "axe",   rank: 1, might: 7,  hit: 70, weight: 7, crit: 0,  minRange: 1, maxRange: 1, uses: 45 },
  steel_axe:    { id: "steel_axe",    name: "Steel Axe",    desc: "Even heavier.",                    type: "axe",   triangle: "axe",   rank: 2, might: 10, hit: 60, weight: 10,crit: 0,  minRange: 1, maxRange: 1, uses: 30 },
  silver_axe:   { id: "silver_axe",   name: "Silver Axe",   desc: "Masterwork axe.",                  type: "axe",   triangle: "axe",   rank: 3, might: 15, hit: 60, weight: 8, crit: 0,  minRange: 1, maxRange: 1, uses: 20 },
  hand_axe:     { id: "hand_axe",     name: "Hand Axe",     desc: "Throwable. Range 1-2.",            type: "axe",   triangle: "axe",   rank: 1, might: 6,  hit: 60, weight: 8, crit: 0,  minRange: 1, maxRange: 2, uses: 20 },
  killer_axe:   { id: "killer_axe",   name: "Killer Axe",   desc: "High critical.",                   type: "axe",   triangle: "axe",   rank: 2, might: 8,  hit: 60, weight: 7, crit: 35, minRange: 1, maxRange: 1, uses: 20 },

  // === Bows ===
  iron_bow:     { id: "iron_bow",     name: "Iron Bow",     desc: "Standard bow. Effective vs flying.",type: "bow",  triangle: "none",  rank: 1, might: 5,  hit: 80, weight: 5, crit: 0,  minRange: 2, maxRange: 2, uses: 45, effective: { vs: ["flying"], multiplier: 3 } },
  steel_bow:    { id: "steel_bow",    name: "Steel Bow",    desc: "Heavier bow.",                     type: "bow",   triangle: "none",  rank: 2, might: 8,  hit: 70, weight: 7, crit: 0,  minRange: 2, maxRange: 2, uses: 30, effective: { vs: ["flying"], multiplier: 3 } },
  silver_bow:   { id: "silver_bow",   name: "Silver Bow",   desc: "Masterwork bow.",                  type: "bow",   triangle: "none",  rank: 3, might: 12, hit: 70, weight: 5, crit: 0,  minRange: 2, maxRange: 2, uses: 20, effective: { vs: ["flying"], multiplier: 3 } },
  short_bow:    { id: "short_bow",    name: "Short Bow",    desc: "Light bow. Can counter at range 1.",type: "bow",  triangle: "none",  rank: 1, might: 4,  hit: 90, weight: 3, crit: 0,  minRange: 1, maxRange: 2, uses: 40, effective: { vs: ["flying"], multiplier: 3 } },

  // === Magic — Anima ===
  fire:         { id: "fire",         name: "Fire",         desc: "Basic anima magic.",               type: "fire",  triangle: "anima", rank: 1, might: 5,  hit: 90, weight: 4, crit: 0,  minRange: 1, maxRange: 2, uses: 40 },
  elfire:       { id: "elfire",       name: "Elfire",       desc: "Advanced fire magic.",             type: "fire",  triangle: "anima", rank: 2, might: 10, hit: 85, weight: 6, crit: 0,  minRange: 1, maxRange: 2, uses: 25 },
  fimbulvetr:   { id: "fimbulvetr",   name: "Fimbulvetr",   desc: "Devastating ice magic.",           type: "fire",  triangle: "anima", rank: 3, might: 15, hit: 80, weight: 8, crit: 0,  minRange: 1, maxRange: 2, uses: 15 },

  // === Magic — Light ===
  lightning:    { id: "lightning",    name: "Lightning",    desc: "Basic light magic.",               type: "light", triangle: "light", rank: 1, might: 4,  hit: 95, weight: 3, crit: 0,  minRange: 1, maxRange: 2, uses: 40 },
  divinus:      { id: "divinus",      name: "Divinus",      desc: "Advanced light magic.",            type: "light", triangle: "light", rank: 2, might: 9,  hit: 90, weight: 5, crit: 0,  minRange: 1, maxRange: 2, uses: 25 },

  // === Magic — Dark ===
  flux:         { id: "flux",         name: "Flux",         desc: "Basic dark magic.",                type: "dark",  triangle: "dark",  rank: 1, might: 6,  hit: 80, weight: 5, crit: 0,  minRange: 1, maxRange: 2, uses: 35 },
  nosferatu:    { id: "nosferatu",    name: "Nosferatu",    desc: "Dark magic that heals the caster.",type: "dark",  triangle: "dark",  rank: 2, might: 7,  hit: 75, weight: 8, crit: 0,  minRange: 1, maxRange: 2, uses: 20 },

  // === Staves ===
  heal_staff:   { id: "heal_staff",   name: "Heal",         desc: "Restores HP to adjacent ally.",    type: "staff", triangle: "none",  rank: 1, might: 8,  hit: 100,weight: 2, crit: 0,  minRange: 1, maxRange: 1, uses: 45 },
  mend_staff:   { id: "mend_staff",   name: "Mend",         desc: "Restores more HP.",                type: "staff", triangle: "none",  rank: 2, might: 15, hit: 100,weight: 2, crit: 0,  minRange: 1, maxRange: 1, uses: 30 },
  physic_staff: { id: "physic_staff", name: "Physic",       desc: "Heals at range 1-2.",              type: "staff", triangle: "none",  rank: 2, might: 10, hit: 100,weight: 3, crit: 0,  minRange: 1, maxRange: 2, uses: 25 },
};

export const ITEMS: Record<string, ItemDef> = {
  vulnerary: { id: "vulnerary", name: "Vulnerary", desc: "Restores 10 HP.", type: "heal", healAmount: 10, uses: 3 },
  elixir: { id: "elixir", name: "Elixir", desc: "Fully restores HP.", type: "heal", healPercent: 100, uses: 1 },
  master_seal: { id: "master_seal", name: "Master Seal", desc: "Promotes a Lv10+ unit.", type: "promote", uses: 1 },
  str_ring: { id: "str_ring", name: "Strength Ring", desc: "+2 STR permanently.", type: "boost", statTarget: "str", statAmount: 2, uses: 1 },
  spd_ring: { id: "spd_ring", name: "Speed Ring", desc: "+2 SPD permanently.", type: "boost", statTarget: "spd", statAmount: 2, uses: 1 },
  def_ring: { id: "def_ring", name: "Defense Ring", desc: "+2 DEF permanently.", type: "boost", statTarget: "def", statAmount: 2, uses: 1 },
};


export const CLASSES: Record<string, ClassDef> = {
  lord: { id: "lord", name: "Lord", desc: "Balanced leader.", tier: 1, moveType: "infantry", baseMove: 5, base: { hp: 22, str: 7, mag: 2, skl: 7, spd: 7, lck: 7, def: 6, res: 3 }, growth: { hp: 70, str: 40, mag: 10, skl: 40, spd: 35, lck: 40, def: 35, res: 20 }, caps: { hp: 60, str: 25, mag: 15, skl: 30, spd: 28, lck: 30, def: 28, res: 22 }, weapons: ["sword"] },
  knight: { id: "knight", name: "Knight", desc: "Heavy armor.", tier: 1, moveType: "armored", baseMove: 4, base: { hp: 28, str: 8, mag: 0, skl: 5, spd: 3, lck: 3, def: 12, res: 1 }, growth: { hp: 85, str: 40, mag: 5, skl: 30, spd: 20, lck: 25, def: 55, res: 10 }, caps: { hp: 70, str: 28, mag: 10, skl: 28, spd: 20, lck: 30, def: 35, res: 20 }, weapons: ["lance"] },
  archer: { id: "archer", name: "Archer", desc: "Ranged bow.", tier: 1, moveType: "infantry", baseMove: 5, base: { hp: 20, str: 6, mag: 0, skl: 8, spd: 6, lck: 4, def: 4, res: 2 }, growth: { hp: 60, str: 40, mag: 5, skl: 50, spd: 35, lck: 30, def: 25, res: 20 }, caps: { hp: 55, str: 26, mag: 10, skl: 35, spd: 30, lck: 30, def: 24, res: 22 }, weapons: ["bow"] },
  mage: { id: "mage", name: "Mage", desc: "Anima magic.", tier: 1, moveType: "infantry", baseMove: 5, base: { hp: 18, str: 1, mag: 7, skl: 6, spd: 7, lck: 3, def: 2, res: 5 }, growth: { hp: 50, str: 10, mag: 55, skl: 35, spd: 35, lck: 30, def: 15, res: 40 }, caps: { hp: 50, str: 15, mag: 30, skl: 28, spd: 30, lck: 30, def: 18, res: 32 }, weapons: ["fire"] },
  cleric: { id: "cleric", name: "Cleric", desc: "Healing support.", tier: 1, moveType: "infantry", baseMove: 5, base: { hp: 18, str: 1, mag: 5, skl: 4, spd: 6, lck: 6, def: 2, res: 7 }, growth: { hp: 50, str: 5, mag: 40, skl: 30, spd: 35, lck: 40, def: 15, res: 50 }, caps: { hp: 50, str: 12, mag: 28, skl: 28, spd: 28, lck: 35, def: 18, res: 35 }, weapons: ["staff"] },
  mercenary: { id: "mercenary", name: "Mercenary", desc: "Sword for hire.", tier: 1, moveType: "infantry", baseMove: 6, base: { hp: 22, str: 7, mag: 0, skl: 9, spd: 9, lck: 4, def: 5, res: 2 }, growth: { hp: 70, str: 35, mag: 5, skl: 45, spd: 40, lck: 30, def: 30, res: 18 }, caps: { hp: 60, str: 25, mag: 12, skl: 34, spd: 34, lck: 30, def: 26, res: 22 }, weapons: ["sword"] },
  fighter: { id: "fighter", name: "Fighter", desc: "Axe bruiser.", tier: 1, moveType: "infantry", baseMove: 5, base: { hp: 26, str: 8, mag: 0, skl: 4, spd: 6, lck: 2, def: 4, res: 1 }, growth: { hp: 80, str: 50, mag: 5, skl: 25, spd: 30, lck: 20, def: 25, res: 12 }, caps: { hp: 70, str: 30, mag: 10, skl: 24, spd: 28, lck: 25, def: 25, res: 18 }, weapons: ["axe"] },
  cavalier: { id: "cavalier", name: "Cavalier", desc: "Mounted.", tier: 1, moveType: "cavalry", baseMove: 7, base: { hp: 24, str: 7, mag: 0, skl: 7, spd: 7, lck: 4, def: 7, res: 3 }, growth: { hp: 70, str: 40, mag: 5, skl: 35, spd: 35, lck: 30, def: 35, res: 25 }, caps: { hp: 65, str: 26, mag: 15, skl: 30, spd: 30, lck: 30, def: 30, res: 28 }, weapons: ["sword", "lance"] },
  // === Tier 2 (Promoted) ===
  lord_knight: { id: "lord_knight", name: "Lord Knight", desc: "Promoted Lord. Master swordsman.", tier: 2, moveType: "infantry", baseMove: 6, base: { hp: 30, str: 10, mag: 3, skl: 10, spd: 10, lck: 8, def: 9, res: 5 }, growth: { hp: 75, str: 45, mag: 15, skl: 45, spd: 40, lck: 45, def: 40, res: 25 }, caps: { hp: 70, str: 28, mag: 18, skl: 34, spd: 32, lck: 35, def: 32, res: 28 }, weapons: ["sword"] },
  general: { id: "general", name: "General", desc: "Promoted Knight. Impenetrable fortress.", tier: 2, moveType: "armored", baseMove: 5, base: { hp: 36, str: 11, mag: 0, skl: 7, spd: 4, lck: 4, def: 16, res: 2 }, growth: { hp: 95, str: 45, mag: 5, skl: 35, spd: 22, lck: 28, def: 60, res: 12 }, caps: { hp: 80, str: 30, mag: 10, skl: 30, spd: 22, def: 40, res: 22, lck: 30 }, weapons: ["lance", "axe"] },
  sniper: { id: "sniper", name: "Sniper", desc: "Promoted Archer. Deadly precision.", tier: 2, moveType: "infantry", baseMove: 6, base: { hp: 26, str: 8, mag: 0, skl: 11, spd: 8, lck: 5, def: 5, res: 3 }, growth: { hp: 65, str: 45, mag: 5, skl: 55, spd: 40, lck: 35, def: 28, res: 22 }, caps: { hp: 60, str: 28, mag: 10, skl: 40, spd: 33, lck: 35, def: 26, res: 25 }, weapons: ["bow"] },
  sage: { id: "sage", name: "Sage", desc: "Promoted Mage. Master of anima magic.", tier: 2, moveType: "infantry", baseMove: 6, base: { hp: 24, str: 2, mag: 10, skl: 8, spd: 9, lck: 4, def: 3, res: 7 }, growth: { hp: 55, str: 12, mag: 60, skl: 38, spd: 38, lck: 32, def: 18, res: 45 }, caps: { hp: 55, str: 16, mag: 32, skl: 30, spd: 32, lck: 32, def: 20, res: 35 }, weapons: ["fire", "staff"] },
  bishop: { id: "bishop", name: "Bishop", desc: "Promoted Cleric. Holy healer.", tier: 2, moveType: "infantry", baseMove: 6, base: { hp: 24, str: 2, mag: 8, skl: 6, spd: 8, lck: 8, def: 3, res: 10 }, growth: { hp: 55, str: 6, mag: 45, skl: 32, spd: 38, lck: 45, def: 18, res: 55 }, caps: { hp: 55, str: 14, mag: 30, skl: 30, spd: 30, lck: 40, def: 20, res: 38 }, weapons: ["staff", "light"] },
  hero: { id: "hero", name: "Hero", desc: "Promoted Mercenary. Legendary warrior.", tier: 2, moveType: "infantry", baseMove: 7, base: { hp: 28, str: 9, mag: 0, skl: 12, spd: 12, lck: 5, def: 7, res: 3 }, growth: { hp: 75, str: 40, mag: 5, skl: 50, spd: 45, lck: 32, def: 35, res: 20 }, caps: { hp: 65, str: 27, mag: 12, skl: 38, spd: 38, lck: 32, def: 30, res: 25 }, weapons: ["sword", "axe"] },
  warrior: { id: "warrior", name: "Warrior", desc: "Promoted Fighter. Unstoppable brute.", tier: 2, moveType: "infantry", baseMove: 6, base: { hp: 32, str: 11, mag: 0, skl: 6, spd: 8, lck: 3, def: 6, res: 2 }, growth: { hp: 90, str: 55, mag: 5, skl: 28, spd: 35, lck: 22, def: 30, res: 14 }, caps: { hp: 80, str: 33, mag: 10, skl: 28, spd: 32, lck: 28, def: 30, res: 20 }, weapons: ["axe", "bow"] },
  paladin: { id: "paladin", name: "Paladin", desc: "Promoted Cavalier. Holy knight.", tier: 2, moveType: "cavalry", baseMove: 8, base: { hp: 30, str: 9, mag: 0, skl: 9, spd: 9, lck: 5, def: 9, res: 5 }, growth: { hp: 80, str: 45, mag: 5, skl: 40, spd: 38, lck: 32, def: 40, res: 30 }, caps: { hp: 70, str: 28, mag: 15, skl: 34, spd: 34, lck: 32, def: 35, res: 32 }, weapons: ["sword", "lance"] },
};

// Promotion map: tier1 → tier2
export const PROMOTIONS: Record<string, string> = {
  lord: "lord_knight", knight: "general", archer: "sniper", mage: "sage",
  cleric: "bishop", mercenary: "hero", fighter: "warrior", cavalier: "paladin",
};

export const UNITS: Record<string, UnitDef> = {
  kael: { id: "kael", name: "Kael", desc: "A seasoned warrior-lord, scarred by years of border conflict. The Black Knight of Ashwood.", classId: "lord", level: 1, faction: "player", isLord: true, growthBonus: { hp: 15, str: 10, skl: 10, spd: 10, lck: 10, def: 10, res: 10 }, inventory: ["iron_sword"], modelId: "BlackKnight", portraitColor: "#3a6ad8" },
  lyra: { id: "lyra", name: "Lyra", desc: "Devoted healer.", classId: "cleric", level: 1, faction: "player", growthBonus: { mag: 15, res: 15 }, inventory: ["heal_staff"], modelId: "Witch", portraitColor: "#d8c850" },
  borin: { id: "borin", name: "Borin", desc: "Veteran knight of the old guard.", classId: "knight", level: 3, faction: "player", growthBonus: { hp: 15, str: 10, def: 15 }, inventory: ["iron_lance"], modelId: "Paladin", portraitColor: "#686872" },
  serra: { id: "serra", name: "Serra", desc: "Sharp-eyed hunter from the north.", classId: "archer", level: 2, faction: "player", growthBonus: { skl: 15, spd: 10 }, inventory: ["iron_bow"], modelId: "Ranger", portraitColor: "#3a8a3a" },
  bandit_sword: { id: "bandit_sword", name: "Bandit", desc: "Common brigand.", classId: "mercenary", level: 1, faction: "enemy", inventory: ["iron_sword"], modelId: "Skeleton_Warrior", portraitColor: "#8a4a2a" },
  bandit_axe: { id: "bandit_axe", name: "Brigand", desc: "Thug with an axe.", classId: "fighter", level: 2, faction: "enemy", inventory: ["iron_axe"], modelId: "Skeleton_Warrior", portraitColor: "#6a3a1a" },
  boss_garrick: { id: "boss_garrick", name: "Garrick the Cruel", desc: "Leader of the Ashwood Bandits.", classId: "fighter", level: 5, faction: "enemy", isBoss: true, growthBonus: { hp: 20, str: 15, def: 10 }, inventory: ["steel_sword"], modelId: "Skeleton_Warrior", portraitColor: "#9a1a1a" },
  umbral_mage: { id: "umbral_mage", name: "Umbral Acolyte", desc: "Cultist with fire magic.", classId: "mage", level: 3, faction: "enemy", inventory: ["fire"], modelId: "Skeleton_Mage", portraitColor: "#5a1a6a" },
  // New recruits
  maren: { id: "maren", name: "Maren", desc: "Arcane scholar.", classId: "mage", level: 4, faction: "player", growthBonus: { mag: 20, spd: 10 }, inventory: ["fire"], modelId: "Druid", portraitColor: "#6a2ada" },
  darius: { id: "darius", name: "Darius", desc: "Deserting city guard.", classId: "cavalier", level: 5, faction: "player", growthBonus: { hp: 10, str: 10, def: 10 }, inventory: ["iron_lance"], modelId: "Protagonist_A", portraitColor: "#da8a3a" },
  yuki: { id: "yuki", name: "Yuki", desc: "Pegasus rider from the mountain clans.", classId: "cavalier", level: 7, faction: "player", growthBonus: { spd: 20, lck: 15 }, inventory: ["iron_lance"], modelId: "Protagonist_B", portraitColor: "#8ad8da" },
  // Cult enemies
  cultist: { id: "cultist", name: "Cultist", desc: "Fanatical follower of the Endless Night.", classId: "mercenary", level: 4, faction: "enemy", inventory: ["iron_sword"], modelId: "Skeleton_Warrior", portraitColor: "#4a1a4a" },
  cultist_heavy: { id: "cultist_heavy", name: "Cult Enforcer", desc: "Heavily armed cult warrior.", classId: "fighter", level: 6, faction: "enemy", inventory: ["iron_axe"], modelId: "Skeleton_Warrior", portraitColor: "#3a0a3a" },
  cult_archer: { id: "cult_archer", name: "Cult Archer", desc: "Cult ranged unit.", classId: "archer", level: 4, faction: "enemy", inventory: ["iron_bow"], modelId: "Skeleton_Rogue", portraitColor: "#4a2a1a" },
  acolyte_veyne: { id: "acolyte_veyne", name: "Acolyte Veyne", desc: "Umbral Cult mid-ranking leader.", classId: "mage", level: 8, faction: "enemy", isBoss: true, growthBonus: { mag: 25, res: 20 }, inventory: ["fire"], modelId: "Skeleton_Mage", portraitColor: "#6a0a6a" },
  cult_captain: { id: "cult_captain", name: "Cult Captain", desc: "Cult field commander.", classId: "mercenary", level: 8, faction: "enemy", isBoss: true, growthBonus: { hp: 20, str: 15, def: 10 }, inventory: ["steel_sword"], modelId: "Skeleton_Warrior", portraitColor: "#5a0a0a" },
  traitor_guard: { id: "traitor_guard", name: "Traitor Guard", desc: "City guard turned traitor.", classId: "knight", level: 7, faction: "enemy", inventory: ["iron_lance"], modelId: "Skeleton_Warrior", portraitColor: "#5a3a1a" },
  malachar: { id: "malachar", name: "Inquisitor Malachar", desc: "Fallen Throne Guardian. Cult military commander.", classId: "knight", level: 12, faction: "enemy", isBoss: true, growthBonus: { hp: 30, str: 20, def: 25, res: 15 }, inventory: ["silver_sword"], modelId: "Paladin_with_Helmet", portraitColor: "#1a0a1a" },
  umbral_horror: { id: "umbral_horror", name: "Umbral Horror", desc: "Creature of pure darkness.", classId: "fighter", level: 10, faction: "enemy", inventory: ["iron_axe"], modelId: "Skeleton_Minion", portraitColor: "#0a0a1a" },
  void_wraith: { id: "void_wraith", name: "Void Wraith", desc: "Ethereal being from the Umbral realm.", classId: "mage", level: 12, faction: "enemy", inventory: ["fire"], modelId: "Skeleton_Mage", portraitColor: "#1a0a2a" },
  zethar: { id: "zethar", name: "Lord Zethar", desc: "The Endless Night. First Guardian of the Ember Throne.", classId: "lord", level: 20, faction: "enemy", isBoss: true, growthBonus: { hp: 40, str: 25, mag: 20, skl: 20, spd: 15, def: 25, res: 25 }, inventory: ["silver_sword"], modelId: "Vampire", portraitColor: "#000010" },
};

export const CHAPTERS: ChapterDef[] = [
  {
    id: "ch01", name: "Prologue", desc: "Defeat Garrick", objective: "Defeat Garrick",
    objectiveType: "boss", mapSize: { w: 16, h: 12 },
    terrain: { "5,2":"forest","5,3":"forest","6,2":"forest","6,3":"forest","11,8":"forest","11,9":"forest","12,8":"forest","12,9":"forest","3,9":"fort","4,9":"fort","2,3":"wall","3,3":"wall","4,3":"wall","0,5":"wall","0,6":"wall","0,7":"wall","0,8":"wall","14,0":"wall","14,1":"wall","14,10":"wall","14,11":"wall" },
    deploymentPoints: [{x:2,y:6},{x:2,y:7},{x:2,y:8},{x:3,y:7}],
    enemies: [
      { unitId:"bandit_axe",pos:{x:8,y:3},aiType:"aggressive" },{ unitId:"bandit_axe",pos:{x:10,y:5},aiType:"aggressive" },
      { unitId:"bandit_sword",pos:{x:9,y:8},aiType:"aggressive" },{ unitId:"bandit_sword",pos:{x:12,y:7},aiType:"aggressive" },
      { unitId:"bandit_axe",pos:{x:13,y:4},aiType:"aggressive" },{ unitId:"boss_garrick",pos:{x:14,y:6},aiType:"boss",isBoss:true },
    ],
    reinforcements: [{turn:4,unitId:"bandit_sword",pos:{x:15,y:1},aiType:"aggressive"},{turn:4,unitId:"bandit_sword",pos:{x:15,y:10},aiType:"aggressive"}],
  },
  {
    id: "ch02", name: "Forest of Whispers", desc: "Defeat all enemies", objective: "Defeat all enemies",
    objectiveType: "route", mapSize: { w: 20, h: 15 },
    terrain: { "4,3":"forest","4,4":"forest","4,5":"forest","5,3":"forest","5,4":"forest","6,2":"forest","6,3":"forest","6,11":"forest","7,1":"forest","7,2":"forest","7,12":"forest","9,9":"forest","9,10":"forest","9,11":"forest","11,2":"forest","11,3":"forest","12,11":"forest","12,12":"forest","14,2":"forest","14,12":"forest","14,13":"forest","17,4":"forest","17,10":"forest","3,7":"fort","8,6":"fort","13,7":"fort" },
    deploymentPoints: [{x:1,y:6},{x:1,y:7},{x:1,y:8},{x:2,y:5},{x:2,y:6},{x:2,y:8},{x:2,y:9}],
    enemies: [
      {unitId:"bandit_axe",pos:{x:8,y:4},aiType:"aggressive"},{unitId:"bandit_sword",pos:{x:8,y:10},aiType:"aggressive"},
      {unitId:"bandit_axe",pos:{x:10,y:7},aiType:"defensive"},{unitId:"umbral_mage",pos:{x:12,y:5},aiType:"sniper"},
      {unitId:"umbral_mage",pos:{x:13,y:9},aiType:"sniper"},{unitId:"bandit_sword",pos:{x:14,y:6},aiType:"aggressive"},
      {unitId:"bandit_axe",pos:{x:15,y:8},aiType:"aggressive"},{unitId:"bandit_sword",pos:{x:16,y:3},aiType:"stationary"},
      {unitId:"boss_garrick",pos:{x:18,y:7},aiType:"boss",isBoss:true},
    ],
    reinforcements: [{turn:3,unitId:"bandit_sword",pos:{x:19,y:0},aiType:"aggressive"},{turn:5,unitId:"umbral_mage",pos:{x:10,y:14},aiType:"aggressive"}],
  },
  // === ACT I ===
  {
    id: "ch03", name: "The Forsaken Shrine", desc: "Defeat the cultist leader", objective: "Defeat Veyne",
    objectiveType: "boss", mapSize: { w: 18, h: 12 },
    terrain: { "5,5":"forest","6,5":"forest","7,5":"forest","5,6":"forest","6,6":"forest","7,6":"forest","5,7":"forest","6,7":"forest","7,7":"forest","5,4":"wall","6,4":"wall","7,4":"wall","8,4":"wall","4,4":"wall","9,4":"wall","8,7":"fort","8,8":"fort","11,5":"mountain","12,5":"mountain","12,6":"mountain","13,6":"mountain" },
    deploymentPoints: [{x:1,y:4},{x:1,y:5},{x:1,y:6},{x:1,y:7},{x:2,y:5},{x:2,y:6},{x:3,y:5}],
    enemies: [
      {unitId:"cultist",pos:{x:5,y:4},aiType:"aggressive"},{unitId:"cultist",pos:{x:7,y:4},aiType:"aggressive"},
      {unitId:"umbral_mage",pos:{x:8,y:5},aiType:"sniper"},{unitId:"umbral_mage",pos:{x:8,y:7},aiType:"sniper"},
      {unitId:"cultist",pos:{x:6,y:3},aiType:"aggressive"},{unitId:"cultist_heavy",pos:{x:9,y:3},aiType:"defensive"},
      {unitId:"cultist",pos:{x:11,y:4},aiType:"aggressive"},
      {unitId:"acolyte_veyne",pos:{x:9,y:9},aiType:"boss",isBoss:true},
    ],
    reinforcements: [{turn:3,unitId:"cult_archer",pos:{x:16,y:2},aiType:"aggressive"},{turn:4,unitId:"cultist",pos:{x:16,y:10},aiType:"aggressive"}],
  },
  {
    id: "ch04", name: "Crossroads of Fate", desc: "Hold for 8 turns", objective: "Survive 8 turns",
    objectiveType: "defend", objectiveTurns: 8, mapSize: { w: 16, h: 10 },
    terrain: { "5,3":"road","5,4":"road","5,5":"road","5,6":"road","5,7":"road","10,3":"road","10,4":"road","10,5":"road","10,6":"road","10,7":"road" },
    deploymentPoints: [{x:6,y:3},{x:6,y:4},{x:6,y:5},{x:6,y:6},{x:6,y:7},{x:7,y:5},{x:7,y:6}],
    enemies: [
      {unitId:"cultist",pos:{x:1,y:1},aiType:"aggressive"},{unitId:"cultist",pos:{x:1,y:3},aiType:"aggressive"},
      {unitId:"cultist",pos:{x:1,y:5},aiType:"aggressive"},{unitId:"cultist",pos:{x:1,y:7},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:2,y:2},aiType:"aggressive"},{unitId:"cultist_heavy",pos:{x:2,y:6},aiType:"aggressive"},
    ],
    reinforcements: [{turn:2,unitId:"umbral_mage",pos:{x:0,y:4},aiType:"aggressive"},{turn:4,unitId:"cultist",pos:{x:15,y:1},aiType:"aggressive"},{turn:4,unitId:"cultist",pos:{x:15,y:8},aiType:"aggressive"},{turn:6,unitId:"cult_archer",pos:{x:3,y:4},aiType:"sniper"}],
  },
  {
    id: "ch05", name: "Gates of Valdris", desc: "Break through to the capital", objective: "Reach the Throne Hall",
    objectiveType: "seize", mapSize: { w: 20, h: 10 },
    terrain: { "4,0":"wall","4,1":"wall","4,2":"wall","4,3":"wall","4,6":"wall","4,7":"wall","4,8":"wall","4,9":"wall","15,0":"wall","15,1":"wall","15,2":"wall","15,3":"wall","15,6":"wall","15,7":"wall","15,8":"wall","15,9":"wall" },
    deploymentPoints: [{x:1,y:4},{x:1,y:5},{x:1,y:6},{x:2,y:4},{x:2,y:6},{x:3,y:5},{x:3,y:6}],
    enemies: [
      {unitId:"cultist",pos:{x:7,y:4},aiType:"aggressive"},{unitId:"cultist",pos:{x:7,y:5},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:9,y:4},aiType:"defensive"},{unitId:"cultist_heavy",pos:{x:9,y:5},aiType:"defensive"},
      {unitId:"cult_archer",pos:{x:11,y:3},aiType:"sniper"},{unitId:"cult_archer",pos:{x:11,y:6},aiType:"sniper"},
      {unitId:"cult_captain",pos:{x:10,y:4},aiType:"boss",isBoss:true},
    ],
  },
  // === ACT II ===
  {
    id: "ch06", name: "A City Divided", desc: "Clear the streets of cultists", objective: "Defeat 10 enemies",
    objectiveType: "route", mapSize: { w: 18, h: 12 },
    terrain: { "3,0":"wall","3,11":"wall","4,0":"wall","4,11":"wall","5,0":"wall","5,11":"wall","6,0":"wall","6,11":"wall","9,2":"road","9,3":"road","9,4":"road","9,5":"road","9,6":"road","9,7":"road","9,8":"road" },
    deploymentPoints: [{x:1,y:5},{x:1,y:6},{x:2,y:5},{x:2,y:6},{x:3,y:5},{x:3,y:6},{x:4,y:5}],
    enemies: [
      {unitId:"cultist",pos:{x:6,y:2},aiType:"aggressive"},{unitId:"cultist",pos:{x:6,y:8},aiType:"aggressive"},
      {unitId:"cultist",pos:{x:8,y:3},aiType:"aggressive"},{unitId:"cultist",pos:{x:8,y:7},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:10,y:4},aiType:"sniper"},{unitId:"cult_archer",pos:{x:10,y:6},aiType:"sniper"},
      {unitId:"cultist_heavy",pos:{x:12,y:5},aiType:"defensive"},
    ],
    reinforcements: [{turn:2,unitId:"cultist",pos:{x:15,y:3},aiType:"aggressive"},{turn:3,unitId:"cultist_heavy",pos:{x:15,y:9},aiType:"aggressive"},{turn:5,unitId:"umbral_mage",pos:{x:14,y:5},aiType:"sniper"}],
  },
  {
    id: "ch07", name: "The Undercity", desc: "Find the cult temple in the sewers", objective: "Reach the temple",
    objectiveType: "seize", mapSize: { w: 18, h: 10 },
    terrain: { "0,0":"wall","17,0":"wall","0,9":"wall","17,9":"wall" },
    deploymentPoints: [{x:1,y:1},{x:1,y:8},{x:2,y:1},{x:2,y:8},{x:3,y:4},{x:3,y:5},{x:4,y:4}],
    enemies: [
      {unitId:"cultist",pos:{x:5,y:2},aiType:"aggressive"},{unitId:"cultist",pos:{x:5,y:7},aiType:"aggressive"},
      {unitId:"cultist",pos:{x:9,y:3},aiType:"aggressive"},{unitId:"cultist",pos:{x:9,y:6},aiType:"aggressive"},
      {unitId:"umbral_mage",pos:{x:13,y:2},aiType:"sniper"},{unitId:"umbral_mage",pos:{x:13,y:7},aiType:"sniper"},
      {unitId:"acolyte_veyne",pos:{x:16,y:4},aiType:"boss",isBoss:true},
    ],
  },
  {
    id: "ch08", name: "The Arena of Kings", desc: "Protect the Council for 10 turns", objective: "Survive 10 turns",
    objectiveType: "defend", objectiveTurns: 10, mapSize: { w: 16, h: 10 },
    terrain: { "0,0":"wall","15,0":"wall","0,9":"wall","15,9":"wall","7,3":"fort","7,4":"fort","7,5":"fort","7,6":"fort" },
    deploymentPoints: [{x:1,y:1},{x:1,y:8},{x:2,y:1},{x:2,y:8},{x:3,y:4},{x:3,y:5},{x:4,y:5}],
    enemies: [
      {unitId:"cultist",pos:{x:10,y:1},aiType:"aggressive"},{unitId:"cultist",pos:{x:10,y:8},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:11,y:2},aiType:"aggressive"},{unitId:"cultist_heavy",pos:{x:11,y:7},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:13,y:4},aiType:"sniper"},{unitId:"cult_archer",pos:{x:13,y:5},aiType:"sniper"},
    ],
    reinforcements: [{turn:3,unitId:"cultist",pos:{x:14,y:1},aiType:"aggressive"},{turn:5,unitId:"umbral_mage",pos:{x:14,y:8},aiType:"sniper"},{turn:7,unitId:"cultist_heavy",pos:{x:12,y:1},aiType:"aggressive"},{turn:9,unitId:"cult_captain",pos:{x:10,y:4},aiType:"boss",isBoss:true}],
  },
  {
    id: "ch09", name: "Betrayal at Dawn", desc: "Execute or spare the traitor", objective: "Defeat the traitor",
    objectiveType: "boss", mapSize: { w: 16, h: 10 },
    terrain: { "7,4":"floor","8,4":"floor","7,5":"floor","8,5":"floor" },
    deploymentPoints: [{x:1,y:1},{x:1,y:3},{x:1,y:5},{x:1,y:7},{x:2,y:1},{x:2,y:9},{x:3,y:4}],
    enemies: [
      {unitId:"traitor_guard",pos:{x:7,y:2},aiType:"aggressive"},{unitId:"traitor_guard",pos:{x:7,y:7},aiType:"aggressive"},
      {unitId:"traitor_guard",pos:{x:10,y:3},aiType:"aggressive"},{unitId:"traitor_guard",pos:{x:10,y:6},aiType:"aggressive"},
      {unitId:"cult_captain",pos:{x:9,y:4},aiType:"boss",isBoss:true},
    ],
  },
  {
    id: "ch10", name: "The Fall of Valdris", desc: "Defend the Ember Throne", objective: "Survive 12 turns",
    objectiveType: "defend", objectiveTurns: 12, mapSize: { w: 20, h: 12 },
    terrain: { "0,0":"wall","19,0":"wall","0,11":"wall","19,11":"wall","8,5":"fort","8,6":"fort" },
    deploymentPoints: [{x:7,y:5},{x:7,y:6},{x:7,y:4},{x:7,y:7}],
    enemies: [
      {unitId:"cultist",pos:{x:1,y:2},aiType:"aggressive"},{unitId:"cultist",pos:{x:1,y:9},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:3,y:3},aiType:"aggressive"},{unitId:"cultist_heavy",pos:{x:3,y:8},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:5,y:1},aiType:"sniper"},{unitId:"cult_archer",pos:{x:5,y:10},aiType:"sniper"},
      {unitId:"umbral_mage",pos:{x:2,y:5},aiType:"sniper"},{unitId:"umbral_mage",pos:{x:2,y:6},aiType:"sniper"},
      {unitId:"malachar",pos:{x:9,y:5},aiType:"boss",isBoss:true},
    ],
    reinforcements: [{turn:3,unitId:"cultist",pos:{x:18,y:1},aiType:"aggressive"},{turn:6,unitId:"umbral_horror",pos:{x:0,y:5},aiType:"aggressive"},{turn:8,unitId:"cultist_heavy",pos:{x:18,y:10},aiType:"aggressive"}],
  },
  // === ACT III ===
  {
    id: "ch11", name: "Into the Mountains", desc: "Cross the Frostpeak pass", objective: "Reach the far side",
    objectiveType: "seize", mapSize: { w: 20, h: 10 },
    terrain: { "0,0":"wall","19,0":"wall","0,9":"wall","19,9":"wall","5,2":"mountain","6,2":"mountain","5,3":"mountain","6,3":"mountain","5,7":"mountain","6,7":"mountain","5,8":"mountain","6,8":"mountain","10,4":"mountain","11,4":"mountain","10,5":"mountain","11,5":"mountain","10,6":"mountain","11,6":"mountain" },
    deploymentPoints: [{x:1,y:1},{x:1,y:4},{x:1,y:7},{x:2,y:4},{x:3,y:2},{x:3,y:7}],
    enemies: [
      {unitId:"cultist",pos:{x:8,y:4},aiType:"aggressive"},{unitId:"cultist",pos:{x:8,y:5},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:13,y:3},aiType:"sniper"},{unitId:"cult_archer",pos:{x:13,y:6},aiType:"sniper"},
    ],
  },
  {
    id: "ch12", name: "The Dragon's Roost", desc: "Defeat the Umbral Dragon", objective: "Defeat the dragon",
    objectiveType: "boss", mapSize: { w: 16, h: 12 },
    terrain: { "0,0":"wall","15,0":"wall","0,11":"wall","15,11":"wall","7,3":"mountain","7,8":"mountain","6,4":"mountain","8,4":"mountain","6,7":"mountain","8,7":"mountain" },
    deploymentPoints: [{x:1,y:5},{x:1,y:6},{x:2,y:5},{x:2,y:6},{x:3,y:4},{x:3,y:7}],
    enemies: [
      {unitId:"cultist",pos:{x:5,y:4},aiType:"aggressive"},{unitId:"cultist",pos:{x:5,y:7},aiType:"aggressive"},
      {unitId:"umbral_horror",pos:{x:8,y:3},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:8,y:8},aiType:"aggressive"},
      {unitId:"umbral_horror",pos:{x:9,y:5},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:9,y:6},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:7,y:4},aiType:"aggressive"},{unitId:"void_wraith",pos:{x:7,y:7},aiType:"aggressive"},
    ],
  },
  {
    id: "ch13", name: "The Pegasus Riders", desc: "Reach the mountain clans", objective: "Defeat all enemies",
    objectiveType: "route", mapSize: { w: 18, h: 12 },
    terrain: { "0,0":"wall","17,0":"wall","0,11":"wall","17,11":"wall","5,2":"mountain","6,2":"mountain","5,9":"mountain","6,9":"mountain" },
    deploymentPoints: [{x:1,y:1},{x:1,y:5},{x:1,y:9},{x:2,y:5}],
    enemies: [
      {unitId:"cultist",pos:{x:8,y:3},aiType:"aggressive"},{unitId:"cultist",pos:{x:8,y:8},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:10,y:4},aiType:"defensive"},{unitId:"cultist_heavy",pos:{x:10,y:7},aiType:"defensive"},
      {unitId:"cult_archer",pos:{x:12,y:2},aiType:"sniper"},{unitId:"cult_archer",pos:{x:12,y:9},aiType:"sniper"},
      {unitId:"umbral_mage",pos:{x:14,y:5},aiType:"sniper"},
    ],
  },
  {
    id: "ch14", name: "The Frozen Lake", desc: "Cross the ice without falling", objective: "Reach the far shore",
    objectiveType: "seize", mapSize: { w: 18, h: 10 },
    terrain: {}, // All default (water would be here, but simplified)
    deploymentPoints: [{x:1,y:4},{x:1,y:5},{x:1,y:6},{x:2,y:5}],
    enemies: [
      {unitId:"cultist",pos:{x:7,y:2},aiType:"aggressive"},{unitId:"cultist",pos:{x:7,y:7},aiType:"aggressive"},
      {unitId:"cultist",pos:{x:10,y:3},aiType:"aggressive"},{unitId:"cultist",pos:{x:10,y:6},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:13,y:4},aiType:"sniper"},{unitId:"cult_archer",pos:{x:13,y:5},aiType:"sniper"},
    ],
  },
  {
    id: "ch15", name: "The Umbral Fortress", desc: "Infiltrate and defeat Malachar", objective: "Defeat Malachar",
    objectiveType: "boss", mapSize: { w: 18, h: 12 },
    terrain: { "0,0":"wall","17,0":"wall","0,11":"wall","17,11":"wall","8,5":"fort","8,6":"fort" },
    deploymentPoints: [{x:1,y:1},{x:1,y:10},{x:2,y:1},{x:2,y:10},{x:3,y:4},{x:3,y:6}],
    enemies: [
      {unitId:"cultist",pos:{x:5,y:2},aiType:"aggressive"},{unitId:"cultist",pos:{x:5,y:9},aiType:"aggressive"},
      {unitId:"cultist_heavy",pos:{x:7,y:3},aiType:"aggressive"},{unitId:"cultist_heavy",pos:{x:7,y:8},aiType:"aggressive"},
      {unitId:"cult_archer",pos:{x:9,y:1},aiType:"sniper"},{unitId:"cult_archer",pos:{x:9,y:10},aiType:"sniper"},
      {unitId:"umbral_mage",pos:{x:10,y:4},aiType:"sniper"},{unitId:"umbral_mage",pos:{x:10,y:7},aiType:"sniper"},
      {unitId:"umbral_horror",pos:{x:6,y:5},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:6,y:6},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:11,y:5},aiType:"sniper"},{unitId:"void_wraith",pos:{x:11,y:6},aiType:"sniper"},
      {unitId:"malachar",pos:{x:9,y:5},aiType:"boss",isBoss:true},
    ],
  },
  // === ACT IV ===
  {
    id: "ch16", name: "The Void Gate", desc: "Close the portal", objective: "Reach the gate",
    objectiveType: "seize", mapSize: { w: 18, h: 10 },
    terrain: { "0,0":"wall","17,0":"wall","0,9":"wall","17,9":"wall" },
    deploymentPoints: [{x:1,y:1},{x:1,y:8},{x:2,y:1},{x:2,y:8},{x:3,y:4},{x:3,y:5}],
    enemies: [
      {unitId:"umbral_horror",pos:{x:6,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:6,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:8,y:4},aiType:"sniper"},{unitId:"void_wraith",pos:{x:8,y:5},aiType:"sniper"},
      {unitId:"umbral_horror",pos:{x:10,y:3},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:10,y:6},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:12,y:2},aiType:"sniper"},{unitId:"void_wraith",pos:{x:12,y:7},aiType:"sniper"},
    ],
    reinforcements: [{turn:2,unitId:"umbral_horror",pos:{x:15,y:3},aiType:"aggressive"},{turn:3,unitId:"void_wraith",pos:{x:15,y:6},aiType:"aggressive"},{turn:4,unitId:"umbral_horror",pos:{x:16,y:1},aiType:"aggressive"},{turn:5,unitId:"void_wraith",pos:{x:16,y:8},aiType:"aggressive"}],
  },
  {
    id: "ch17", name: "Echoes of the Past", desc: "Remember the sacrifice", objective: "Reach the old throne",
    objectiveType: "seize", mapSize: { w: 16, h: 10 },
    terrain: { "0,0":"wall","15,0":"wall","0,9":"wall","15,9":"wall","7,4":"fort","8,4":"fort","7,5":"fort","8,5":"fort" },
    deploymentPoints: [{x:1,y:4},{x:1,y:5},{x:2,y:4},{x:2,y:5}],
    enemies: [
      {unitId:"umbral_horror",pos:{x:5,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:5,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:10,y:4},aiType:"sniper"},{unitId:"void_wraith",pos:{x:10,y:5},aiType:"sniper"},
    ],
  },
  {
    id: "ch18", name: "The Lord of Night", desc: "Confront Zethar at the Throne's foundation", objective: "Defeat Zethar",
    objectiveType: "boss", mapSize: { w: 14, h: 10 },
    terrain: { "0,0":"wall","13,0":"wall","0,9":"wall","13,9":"wall","6,3":"floor","7,3":"floor","8,3":"floor","6,4":"floor","7,4":"floor","8,4":"floor","6,5":"floor","7,5":"floor","8,5":"floor","6,6":"floor","7,6":"floor","8,6":"floor" },
    deploymentPoints: [{x:1,y:4},{x:1,y:5},{x:2,y:4},{x:2,y:5}],
    enemies: [
      {unitId:"umbral_horror",pos:{x:4,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:4,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:5,y:4},aiType:"sniper"},{unitId:"void_wraith",pos:{x:5,y:5},aiType:"sniper"},
      {unitId:"umbral_horror",pos:{x:9,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:9,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:8,y:4},aiType:"sniper"},{unitId:"void_wraith",pos:{x:8,y:5},aiType:"sniper"},
      {unitId:"zethar",pos:{x:7,y:4},aiType:"boss",isBoss:true},
    ],
  },
  {
    id: "ch19", name: "The Last Ember", desc: "Defend Lyra for 15 turns while she restores the Throne", objective: "Survive 15 turns",
    objectiveType: "defend", objectiveTurns: 15, mapSize: { w: 16, h: 10 },
    terrain: { "0,0":"wall","15,0":"wall","0,9":"wall","15,9":"wall","7,4":"fort","8,4":"fort" },
    deploymentPoints: [{x:1,y:1},{x:1,y:8},{x:2,y:1},{x:2,y:8},{x:3,y:4},{x:3,y:5}],
    enemies: [
      {unitId:"umbral_horror",pos:{x:6,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:6,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:7,y:3},aiType:"sniper"},{unitId:"void_wraith",pos:{x:7,y:6},aiType:"sniper"},
      {unitId:"umbral_horror",pos:{x:9,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:9,y:7},aiType:"aggressive"},
    ],
    reinforcements: [{turn:2,unitId:"void_wraith",pos:{x:13,y:4},aiType:"sniper"},{turn:4,unitId:"umbral_horror",pos:{x:14,y:2},aiType:"aggressive"},{turn:6,unitId:"void_wraith",pos:{x:14,y:6},aiType:"sniper"},{turn:8,unitId:"umbral_horror",pos:{x:13,y:1},aiType:"aggressive"},{turn:10,unitId:"void_wraith",pos:{x:13,y:7},aiType:"sniper"},{turn:13,unitId:"umbral_horror",pos:{x:14,y:4},aiType:"aggressive"}],
  },
  {
    id: "ch20", name: "Dawn of Aetheria", desc: "Defeat Zethar and choose the world's fate", objective: "Defeat Zethar",
    objectiveType: "boss", mapSize: { w: 16, h: 10 },
    terrain: { "0,0":"wall","15,0":"wall","0,9":"wall","15,9":"wall" },
    deploymentPoints: [{x:1,y:1},{x:1,y:8},{x:2,y:1},{x:2,y:8},{x:3,y:4},{x:3,y:5}],
    enemies: [
      {unitId:"umbral_horror",pos:{x:5,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:5,y:7},aiType:"aggressive"},
      {unitId:"umbral_horror",pos:{x:6,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:6,y:7},aiType:"aggressive"},
      {unitId:"void_wraith",pos:{x:10,y:3},aiType:"sniper"},{unitId:"void_wraith",pos:{x:10,y:6},aiType:"sniper"},
      {unitId:"umbral_horror",pos:{x:11,y:2},aiType:"aggressive"},{unitId:"umbral_horror",pos:{x:11,y:7},aiType:"aggressive"},
      {unitId:"zethar",pos:{x:8,y:4},aiType:"boss",isBoss:true},
    ],
  },
];
