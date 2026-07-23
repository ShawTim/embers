// Save / load system. Persists complete campaign state to localStorage.
//
// Version 2 adds campaign roster, gold, promoted classes, weapon durability,
// and one-shot chapter state. Version 1 payloads are migrated on read.

import { CHAPTERS, CLASSES, UNITS, WEAPONS } from "../data/gameData";
import { createUnit } from "../data/unitFactory";
import { GameGrid } from "./grid";
import type { RuntimeUnit, Faction } from "../types";
import type {
  CampaignRoster,
  CampaignUnitState,
  CampaignWeaponState,
} from "./campaign";

const KEY_AUTOSAVE = "embers:autosave";
const KEY_META = "embers:meta";
const KEY_SLOT_PREFIX = "embers:save:";
const VERSION = 2;

export interface SerializedWeapon {
  id: string;
  uses: number;
}

export interface SerializedUnit {
  uid: string;
  defId: string;
  classId: string;
  pos: { x: number; y: number };
  hp: number;
  maxHp: number;
  exp: number;
  level: number;
  stats: Record<string, number>;
  weapons: SerializedWeapon[];
  equippedWeaponIdx: number;
  hasMoved: boolean;
  hasActed: boolean;
  isDead: boolean;
  isBoss: boolean;
  aiType: RuntimeUnit["aiType"];
  faction: Faction;
  modelId: string;
}

export interface SavePayload {
  version: 2;
  chapterId: string;
  chapterIndex: number;
  turn: number;
  phase: "player" | "enemy" | "combat" | "victory" | "defeat" | "epilogue";
  units: SerializedUnit[];
  campaignRoster: CampaignRoster;
  convoy: { id: string; type: "weapon" | "item"; uses: number }[];
  gold: number;
  completedChapters: string[];
  activeDialogue: string | null;
  bossDeathDialogueComplete: boolean;
  victoryResolved: boolean;
  lang: "en" | "zh";
  savedAt: number;
}

export type SaveWritePayload = Omit<SavePayload, "version" | "savedAt">;

interface SavePayloadV1 {
  version: 1;
  chapterId: string;
  chapterIndex: number;
  turn: number;
  phase: SavePayload["phase"];
  units: Array<Omit<SerializedUnit, "classId" | "maxHp" | "weapons"> & {
    weapons: string[];
  }>;
  convoy: SavePayload["convoy"];
  lang: SavePayload["lang"];
  savedAt: number;
}

export interface SaveMeta {
  lastSaveAt: number;
  completedChapters: string[];
  slots: { id: string; label: string; savedAt: number; chapterId: string; turn: number }[];
}

function loadMeta(): SaveMeta {
  try {
    const raw = localStorage.getItem(KEY_META);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveMeta>;
      return {
        lastSaveAt: typeof parsed.lastSaveAt === "number" ? parsed.lastSaveAt : 0,
        completedChapters: Array.isArray(parsed.completedChapters)
          ? parsed.completedChapters.filter((id): id is string => typeof id === "string")
          : [],
        slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      };
    }
  } catch { /* ignore */ }
  return { lastSaveAt: 0, completedChapters: [], slots: [] };
}

function saveMeta(meta: SaveMeta) {
  try { localStorage.setItem(KEY_META, JSON.stringify(meta)); } catch { /* ignore */ }
}

export function serializeRuntimeUnit(unit: RuntimeUnit): SerializedUnit {
  return {
    uid: unit.uid,
    defId: unit.def.id,
    classId: unit.classDef.id,
    pos: { ...unit.pos },
    hp: unit.hp,
    maxHp: unit.maxHp,
    exp: unit.exp,
    level: unit.level,
    stats: { ...unit.stats },
    weapons: unit.weapons.map(weapon => ({ id: weapon.id, uses: weapon.uses })),
    equippedWeaponIdx: unit.equippedWeapon
      ? unit.weapons.findIndex(weapon => weapon === unit.equippedWeapon)
      : -1,
    hasMoved: unit.hasMoved,
    hasActed: unit.hasActed,
    isDead: unit.isDead,
    isBoss: unit.isBoss,
    aiType: unit.aiType,
    faction: unit.faction,
    modelId: unit.modelId,
  };
}

function campaignUnitFromSerialized(unit: SerializedUnit): CampaignUnitState {
  return {
    uid: unit.uid,
    defId: unit.defId,
    classId: unit.classId,
    level: unit.level,
    exp: unit.exp,
    hp: unit.hp,
    maxHp: unit.maxHp,
    stats: { ...unit.stats },
    weapons: unit.weapons.map(weapon => ({ ...weapon })),
    equippedWeaponIdx: unit.equippedWeaponIdx,
    isDead: unit.isDead,
    modelId: unit.modelId,
  };
}

function rosterFromSerializedUnits(units: SerializedUnit[]): CampaignRoster {
  const roster: CampaignRoster = {};
  for (const unit of units) {
    if (unit.faction === "player") {
      roster[unit.defId] = campaignUnitFromSerialized(unit);
    }
  }
  return roster;
}

function normalizedWeapon(raw: unknown): SerializedWeapon | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SerializedWeapon>;
  if (typeof value.id !== "string" || !WEAPONS[value.id]) return null;
  const uses = typeof value.uses === "number" && Number.isFinite(value.uses)
    ? Math.max(0, value.uses)
    : WEAPONS[value.id].uses;
  return { id: value.id, uses };
}

function normalizedCampaignWeapon(raw: unknown): CampaignWeaponState | null {
  return normalizedWeapon(raw);
}

function normalizedCampaignUnit(raw: unknown): CampaignUnitState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CampaignUnitState>;
  if (
    typeof value.uid !== "string"
    || typeof value.defId !== "string"
    || !UNITS[value.defId]
    || typeof value.classId !== "string"
    || !CLASSES[value.classId]
    || typeof value.level !== "number"
    || typeof value.exp !== "number"
    || typeof value.hp !== "number"
    || typeof value.maxHp !== "number"
    || !value.stats
    || typeof value.stats !== "object"
    || !Array.isArray(value.weapons)
  ) {
    return null;
  }
  const weapons = value.weapons
    .map(normalizedCampaignWeapon)
    .filter((weapon): weapon is CampaignWeaponState => weapon !== null);
  return {
    uid: value.uid,
    defId: value.defId,
    classId: value.classId,
    level: value.level,
    exp: value.exp,
    hp: value.hp,
    maxHp: value.maxHp,
    stats: { ...value.stats },
    weapons,
    equippedWeaponIdx: typeof value.equippedWeaponIdx === "number"
      ? value.equippedWeaponIdx
      : -1,
    isDead: value.isDead === true,
    modelId: typeof value.modelId === "string"
      ? value.modelId
      : UNITS[value.defId].modelId,
  };
}

function normalizedRoster(raw: unknown): CampaignRoster {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const roster: CampaignRoster = {};
  for (const [defId, value] of Object.entries(raw)) {
    const unit = normalizedCampaignUnit(value);
    if (unit && unit.defId === defId) roster[defId] = unit;
  }
  return roster;
}

function normalizedUnit(raw: unknown): SerializedUnit | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SerializedUnit>;
  if (
    typeof value.uid !== "string"
    || typeof value.defId !== "string"
    || !UNITS[value.defId]
    || typeof value.classId !== "string"
    || !CLASSES[value.classId]
    || !value.pos
    || typeof value.pos.x !== "number"
    || typeof value.pos.y !== "number"
    || typeof value.hp !== "number"
    || typeof value.maxHp !== "number"
    || typeof value.exp !== "number"
    || typeof value.level !== "number"
    || !value.stats
    || typeof value.stats !== "object"
    || !Array.isArray(value.weapons)
    || typeof value.faction !== "string"
    || typeof value.aiType !== "string"
  ) {
    return null;
  }
  const weapons = value.weapons
    .map(normalizedWeapon)
    .filter((weapon): weapon is SerializedWeapon => weapon !== null);
  return {
    uid: value.uid,
    defId: value.defId,
    classId: value.classId,
    pos: { x: value.pos.x, y: value.pos.y },
    hp: value.hp,
    maxHp: value.maxHp,
    exp: value.exp,
    level: value.level,
    stats: { ...value.stats },
    weapons,
    equippedWeaponIdx: typeof value.equippedWeaponIdx === "number"
      ? value.equippedWeaponIdx
      : -1,
    hasMoved: value.hasMoved === true,
    hasActed: value.hasActed === true,
    isDead: value.isDead === true,
    isBoss: value.isBoss === true,
    aiType: value.aiType as RuntimeUnit["aiType"],
    faction: value.faction as Faction,
    modelId: typeof value.modelId === "string"
      ? value.modelId
      : UNITS[value.defId].modelId,
  };
}

function migrateV1(data: SavePayloadV1): SavePayload | null {
  if (!Array.isArray(data.units)) return null;
  const units: SerializedUnit[] = [];
  for (const saved of data.units) {
    if (!saved || typeof saved.defId !== "string" || !UNITS[saved.defId]) return null;
    const classId = UNITS[saved.defId].classId;
    const weapons = Array.isArray(saved.weapons)
      ? saved.weapons
        .filter((id): id is string => typeof id === "string" && !!WEAPONS[id])
        .map(id => ({ id, uses: WEAPONS[id].uses }))
      : [];
    const maxHp = typeof saved.stats?.hp === "number"
      ? saved.stats.hp
      : saved.hp;
    const normalized = normalizedUnit({
      ...saved,
      classId,
      maxHp,
      weapons,
    });
    if (!normalized) return null;
    units.push(normalized);
  }
  const completedChapters = loadMeta().completedChapters;
  return {
    version: 2,
    chapterId: data.chapterId,
    chapterIndex: data.chapterIndex,
    turn: data.turn,
    phase: data.phase,
    units,
    campaignRoster: rosterFromSerializedUnits(units),
    convoy: Array.isArray(data.convoy) ? data.convoy : [],
    gold: 0,
    completedChapters,
    activeDialogue: null,
    bossDeathDialogueComplete: false,
    victoryResolved: data.phase === "victory" || data.phase === "epilogue",
    lang: data.lang === "zh" ? "zh" : "en",
    savedAt: typeof data.savedAt === "number" ? data.savedAt : Date.now(),
  };
}

function normalizePayload(raw: unknown): SavePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.version === 1) return migrateV1(data as unknown as SavePayloadV1);
  if (data.version !== VERSION || !Array.isArray(data.units)) return null;

  const units: SerializedUnit[] = [];
  for (const rawUnit of data.units) {
    const unit = normalizedUnit(rawUnit);
    if (!unit) return null;
    units.push(unit);
  }
  if (
    typeof data.chapterId !== "string"
    || typeof data.chapterIndex !== "number"
    || typeof data.turn !== "number"
    || typeof data.phase !== "string"
    || !Array.isArray(data.convoy)
  ) {
    return null;
  }
  const roster = normalizedRoster(data.campaignRoster);
  return {
    version: 2,
    chapterId: data.chapterId,
    chapterIndex: data.chapterIndex,
    turn: data.turn,
    phase: data.phase as SavePayload["phase"],
    units,
    campaignRoster: Object.keys(roster).length > 0
      ? roster
      : rosterFromSerializedUnits(units),
    convoy: data.convoy as SavePayload["convoy"],
    gold: typeof data.gold === "number" && Number.isFinite(data.gold)
      ? data.gold
      : 0,
    completedChapters: Array.isArray(data.completedChapters)
      ? data.completedChapters.filter((id): id is string => typeof id === "string")
      : [],
    activeDialogue: typeof data.activeDialogue === "string"
      ? data.activeDialogue
      : null,
    bossDeathDialogueComplete: data.bossDeathDialogueComplete === true,
    victoryResolved: data.victoryResolved === true,
    lang: data.lang === "zh" ? "zh" : "en",
    savedAt: typeof data.savedAt === "number" ? data.savedAt : Date.now(),
  };
}

function unitFromSerialized(saved: SerializedUnit): RuntimeUnit {
  const unit = createUnit(saved.defId, saved.pos, {
    aiType: saved.aiType,
    isBoss: saved.isBoss,
  });
  unit.uid = saved.uid;
  unit.classDef = CLASSES[saved.classId] || unit.classDef;
  unit.hp = saved.hp;
  unit.maxHp = saved.maxHp;
  unit.exp = saved.exp;
  unit.level = saved.level;
  unit.stats = { ...saved.stats };
  unit.weapons = saved.weapons
    .map(weapon => {
      const definition = WEAPONS[weapon.id];
      return definition ? { ...definition, uses: weapon.uses } : null;
    })
    .filter((weapon): weapon is NonNullable<typeof weapon> => weapon !== null);
  unit.equippedWeapon = saved.equippedWeaponIdx >= 0
    ? unit.weapons[saved.equippedWeaponIdx] || unit.weapons[0] || null
    : unit.weapons[0] || null;
  unit.hasMoved = saved.hasMoved;
  unit.hasActed = saved.hasActed;
  unit.isDead = saved.isDead;
  unit.modelId = saved.modelId || unit.modelId;
  return unit;
}

function readStoredPayload(key: string): SavePayload | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return normalizePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const save = {
  write(payload: SaveWritePayload, slotId: string | null = null): boolean {
    if (typeof localStorage === "undefined") return false;
    const full: SavePayload = { ...payload, version: VERSION, savedAt: Date.now() };
    const json = JSON.stringify(full);
    try {
      if (slotId) {
        localStorage.setItem(KEY_SLOT_PREFIX + slotId, json);
        const meta = loadMeta();
        const chapter = CHAPTERS[payload.chapterIndex];
        const label = (chapter?.name || payload.chapterId) + " · T" + payload.turn;
        const existing = meta.slots.findIndex(slot => slot.id === slotId);
        const entry = {
          id: slotId,
          label,
          savedAt: full.savedAt,
          chapterId: payload.chapterId,
          turn: payload.turn,
        };
        if (existing >= 0) meta.slots[existing] = entry;
        else meta.slots.push(entry);
        meta.lastSaveAt = full.savedAt;
        saveMeta(meta);
      } else {
        localStorage.setItem(KEY_AUTOSAVE, json);
        const meta = loadMeta();
        meta.lastSaveAt = full.savedAt;
        saveMeta(meta);
      }
      return true;
    } catch {
      return false;
    }
  },

  read(slotId: string): SavePayload | null {
    return readStoredPayload(KEY_SLOT_PREFIX + slotId);
  },

  readAutosave(): SavePayload | null {
    return readStoredPayload(KEY_AUTOSAVE);
  },

  hasAutosave(): boolean {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(KEY_AUTOSAVE);
  },

  remove(slotId: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(KEY_SLOT_PREFIX + slotId);
    const meta = loadMeta();
    meta.slots = meta.slots.filter(slot => slot.id !== slotId);
    saveMeta(meta);
  },

  removeAutosave(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(KEY_AUTOSAVE);
  },

  getMeta(): SaveMeta {
    return loadMeta();
  },

  markChapterComplete(chapterId: string): void {
    const meta = loadMeta();
    if (!meta.completedChapters.includes(chapterId)) {
      meta.completedChapters.push(chapterId);
      saveMeta(meta);
    }
  },

  mergeCompletedChapters(chapterIds: string[]): void {
    const meta = loadMeta();
    const merged = new Set([...meta.completedChapters, ...chapterIds]);
    meta.completedChapters = [...merged];
    saveMeta(meta);
  },

  isChapterComplete(chapterId: string): boolean {
    return loadMeta().completedChapters.includes(chapterId);
  },

  applyToGrid(payload: SavePayload): { units: RuntimeUnit[]; grid: GameGrid } {
    const chapter = CHAPTERS[payload.chapterIndex]
      || CHAPTERS.find(candidate => candidate.id === payload.chapterId);
    if (!chapter) throw new Error("Unknown chapter: " + payload.chapterId);
    const grid = new GameGrid(chapter.mapSize.w, chapter.mapSize.h, chapter.terrain as any);
    for (const point of chapter.deploymentPoints) {
      grid.terrain[point.y][point.x] = "deployment";
    }
    const units: RuntimeUnit[] = [];
    for (const saved of payload.units) {
      const unit = unitFromSerialized(saved);
      if (!unit.isDead) grid.placeUnit(unit, unit.pos);
      units.push(unit);
    }
    return { units, grid };
  },
};
