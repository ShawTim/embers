import type {
  TerrainDef, TerrainType, ClassDef, WeaponDef, MoveType,
  UnitDef, ChapterDef,
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
  iron_sword:  { id: "iron_sword",  name: "Iron Sword",  desc: "Standard steel sword.",            type: "sword", triangle: "sword", rank: 1, might: 5,  hit: 90, weight: 5, crit: 0, minRange: 1, maxRange: 1, uses: 45 },
  steel_sword: { id: "steel_sword", name: "Steel Sword", desc: "Heavier, harder-hitting.",         type: "sword", triangle: "sword", rank: 2, might: 8,  hit: 75, weight: 8, crit: 0, minRange: 1, maxRange: 1, uses: 30 },
  silver_sword:{ id: "silver_sword",name: "Silver Sword",desc: "Masterwork blade.",                type: "sword", triangle: "sword", rank: 3, might: 13, hit: 75, weight: 6, crit: 0, minRange: 1, maxRange: 1, uses: 20 },
  iron_lance:  { id: "iron_lance",  name: "Iron Lance",  desc: "Cavalry and knight weapon.",       type: "lance", triangle: "lance", rank: 1, might: 6,  hit: 85, weight: 6, crit: 0, minRange: 1, maxRange: 1, uses: 45 },
  iron_axe:    { id: "iron_axe",    name: "Iron Axe",    desc: "Heavy-hitting but inaccurate.",    type: "axe",   triangle: "axe",   rank: 1, might: 7,  hit: 70, weight: 7, crit: 0, minRange: 1, maxRange: 1, uses: 45 },
  iron_bow:    { id: "iron_bow",    name: "Iron Bow",    desc: "Ranged. Effective vs flying.",     type: "bow",   triangle: "none",  rank: 1, might: 5,  hit: 80, weight: 5, crit: 0, minRange: 2, maxRange: 2, uses: 45, effective: { vs: ["flying"], multiplier: 3 } },
  fire:        { id: "fire",        name: "Fire",        desc: "Basic anima fire magic.",          type: "fire",  triangle: "anima", rank: 1, might: 5,  hit: 90, weight: 4, crit: 0, minRange: 1, maxRange: 2, uses: 40 },
  heal_staff:  { id: "heal_staff",  name: "Heal",        desc: "Restores HP to adjacent ally.",    type: "staff", triangle: "none",  rank: 1, might: 8,  hit: 100,weight: 2, crit: 0, minRange: 1, maxRange: 1, uses: 45 },
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
};

export const UNITS: Record<string, UnitDef> = {
  kael: { id: "kael", name: "Kael", desc: "Young lord of House Ashwood.", classId: "lord", level: 1, faction: "player", isLord: true, growthBonus: { hp: 15, str: 10, skl: 10, spd: 10, lck: 10, def: 10, res: 10 }, inventory: ["iron_sword"], modelId: "Paladin", portraitColor: "#3a6ad8" },
  lyra: { id: "lyra", name: "Lyra", desc: "Devoted healer.", classId: "cleric", level: 1, faction: "player", growthBonus: { mag: 15, res: 15 }, inventory: ["heal_staff"], modelId: "Witch", portraitColor: "#d8c850" },
  borin: { id: "borin", name: "Borin", desc: "Veteran knight.", classId: "knight", level: 3, faction: "player", growthBonus: { hp: 15, str: 10, def: 15 }, inventory: ["iron_lance"], modelId: "BlackKnight", portraitColor: "#686872" },
  serra: { id: "serra", name: "Serra", desc: "Sharp-eyed hunter.", classId: "archer", level: 2, faction: "player", growthBonus: { skl: 15, spd: 10 }, inventory: ["iron_bow"], modelId: "MagicalGirl", portraitColor: "#3a8a3a" },
  bandit_sword: { id: "bandit_sword", name: "Bandit", desc: "Common brigand.", classId: "mercenary", level: 1, faction: "enemy", inventory: ["iron_sword"], modelId: "Skeleton_Warrior", portraitColor: "#8a4a2a" },
  bandit_axe: { id: "bandit_axe", name: "Brigand", desc: "Thug with an axe.", classId: "fighter", level: 2, faction: "enemy", inventory: ["iron_axe"], modelId: "Skeleton_Warrior", portraitColor: "#6a3a1a" },
  boss_garrick: { id: "boss_garrick", name: "Garrick the Cruel", desc: "Leader of the Ashwood Bandits.", classId: "fighter", level: 5, faction: "enemy", isBoss: true, growthBonus: { hp: 20, str: 15, def: 10 }, inventory: ["steel_sword"], modelId: "Skeleton_Warrior", portraitColor: "#9a1a1a" },
  umbral_mage: { id: "umbral_mage", name: "Umbral Acolyte", desc: "Cultist with fire magic.", classId: "mage", level: 3, faction: "enemy", inventory: ["fire"], modelId: "Skeleton_Mage", portraitColor: "#5a1a6a" },
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
];
