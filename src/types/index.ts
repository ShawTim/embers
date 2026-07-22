export type Faction = "player" | "enemy" | "ally" | "neutral";

export type WeaponType =
  | "sword" | "lance" | "axe" | "bow"
  | "fire" | "thunder" | "wind" | "light" | "dark" | "staff";

export type TriangleCategory =
  | "none" | "sword" | "lance" | "axe"
  | "bow" | "anima" | "light" | "dark";

export type MoveType = "infantry" | "armored" | "cavalry" | "flying";

export type TerrainType =
  | "plain" | "forest" | "mountain" | "fort" | "road"
  | "water" | "deep_water" | "cliff" | "sand" | "thicket"
  | "floor" | "wall" | "throne" | "deployment" | "bridge"
  | "village";

export interface TerrainDef {
  type: TerrainType;
  name: string;
  defBonus: number;
  avoidBonus: number;
  healPercent: number;
  moveCost: number;
  moveOverrides?: Partial<Record<MoveType, number>>;
  impassable?: boolean;
  color: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  type: WeaponType;
  triangle: TriangleCategory;
  rank: number;
  might: number;
  hit: number;
  weight: number;
  crit: number;
  minRange: number;
  maxRange: number;
  uses: number;
  effective?: { vs: MoveType[]; multiplier: number };
  brave?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  type: "heal" | "cure" | "boost" | "promote" | "key";
  healAmount?: number;
  healPercent?: number;
  statTarget?: string;
  statAmount?: number;
  uses: number;
}

export interface ClassDef {
  id: string;
  name: string;
  desc: string;
  tier: number;
  moveType: MoveType;
  baseMove: number;
  base: Record<string, number>;
  growth: Record<string, number>;
  caps: Record<string, number>;
  weapons: WeaponType[];
}

export interface UnitDef {
  id: string;
  name: string;
  desc: string;
  classId: string;
  level: number;
  faction: Faction;
  isLord?: boolean;
  isBoss?: boolean;
  growthBonus?: Record<string, number>;
  personalSkills?: string[];
  inventory: string[];
  modelId: string;
  portraitColor: string;
  pos?: { x: number; y: number };
  aiType?: AIType;
  items?: string[]; // consumable items (vulnerary, elixir, master_seal, etc)
}

export type AIType =
  | "aggressive" | "aggressive_auto" | "defensive" | "stationary"
  | "sniper" | "healer" | "boss";

export interface ChapterDef {
  id: string;
  name: string;
  desc: string;
  objective: string;
  objectiveType: "route" | "boss" | "seize" | "defend";
  objectiveTurns?: number;
  mapSize: { w: number; h: number };
  terrain: Record<string, TerrainType>;
  deploymentPoints: { x: number; y: number }[];
  /** For objectiveType "seize": a player unit must stand on this tile to win. */
  seizeTile?: { x: number; y: number };
  enemies: Array<{
    unitId: string;
    pos: { x: number; y: number };
    aiType?: AIType;
    isBoss?: boolean;
  }>;
  reinforcements?: Array<{
    turn: number;
    unitId: string;
    pos: { x: number; y: number };
    aiType?: AIType;
    isBoss?: boolean;
  }>;
  maxTurns?: number;
}

export interface RuntimeUnit {
  uid: string;
  def: UnitDef;
  classDef: ClassDef;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  stats: Record<string, number>;
  weapons: WeaponDef[];
  equippedWeapon: WeaponDef | null;
  pos: { x: number; y: number };
  faction: Faction;
  hasMoved: boolean;
  hasActed: boolean;
  isDead: boolean;
  isBoss: boolean;
  aiType: AIType;
  skills: string[];
  modelId: string;
  /** Set by the store when this unit dies in combat. Drives death VFX. */
  _lastKilledByWeapon?: WeaponType;
}
