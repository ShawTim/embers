// Save / load system.  Persists game state to localStorage in JSON form.
//
// Save layout:
//   embers:autosave            — single most-recent autosave (overwritten)
//   embers:save:<slotId>       — manual save slot
//   embers:meta                — { lastSaveAt, completedChapters[] }
//
// Each save payload contains:
//   { version, chapterId, chapterIndex, turn, units, convoy, lang, savedAt }
//
// Units are stored as a minimal subset (uid, defId, pos, hp, exp, level,
// stats, weapons, equippedWeaponIndex, hasMoved, hasActed, isDead) so we
// can rehydrate them through createUnit() and don't have to serialise
// class metadata (which is fully derivable from defId + level).

import { UNITS, WEAPONS, ITEMS, CHAPTERS } from "../data/gameData";
import { createUnit } from "../data/unitFactory";
import { GameGrid } from "./grid";
import type { RuntimeUnit, WeaponDef, Faction } from "../types";

const KEY_AUTOSAVE = "embers:autosave";
const KEY_META = "embers:meta";
const KEY_SLOT_PREFIX = "embers:save:";
const VERSION = 1;

export interface SerializedUnit {
  uid: string;
  defId: string;
  pos: { x: number; y: number };
  hp: number;
  exp: number;
  level: number;
  stats: Record<string, number>;
  weapons: string[];        // weapon ids
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
  version: number;
  chapterId: string;
  chapterIndex: number;
  turn: number;
  phase: "player" | "enemy" | "combat" | "victory" | "defeat";
  units: SerializedUnit[];
  convoy: { id: string; type: "weapon" | "item"; uses: number }[];
  lang: "en" | "zh";
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
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { lastSaveAt: 0, completedChapters: [], slots: [] };
}

function saveMeta(m: SaveMeta) {
  try { localStorage.setItem(KEY_META, JSON.stringify(m)); } catch { /* ignore */ }
}

function unitToSerialized(u: RuntimeUnit): SerializedUnit {
  return {
    uid: u.uid,
    defId: u.def.id,
    pos: { ...u.pos },
    hp: u.hp,
    exp: u.exp,
    level: u.level,
    stats: { ...u.stats },
    weapons: u.weapons.map(w => w.id),
    equippedWeaponIdx: u.equippedWeapon ? u.weapons.findIndex(w => w.id === u.equippedWeapon!.id) : -1,
    hasMoved: u.hasMoved,
    hasActed: u.hasActed,
    isDead: u.isDead,
    isBoss: u.isBoss,
    aiType: u.aiType,
    faction: u.faction,
    modelId: u.modelId,
  };
}

// Hydrate a unit from its def id + serialized state.
function unitFromSerialized(s: SerializedUnit, pos?: { x: number; y: number }): RuntimeUnit {
  if (!UNITS[s.defId]) throw new Error(`Unknown unit defId in save: ${s.defId}`);
  // For player units we need the position chosen at init; for enemies we
  // use the saved position.  Pass pos as override.
  const u = createUnit(s.defId, s.pos, {
    aiType: s.aiType,
    isBoss: s.isBoss,
  });
  // Preserve the saved uid so references stay stable
  (u as any).uid = s.uid;
  if (pos) u.pos = { ...pos };
  u.hp = s.hp;
  u.exp = s.exp;
  u.level = s.level;
  u.stats = { ...s.stats };
  // Resolve weapons (player units start with their default inventory;
  // override only if the saved set differs from the default).
  if (s.weapons.length > 0) {
    u.weapons = s.weapons.map(wid => WEAPONS[wid]).filter(Boolean) as WeaponDef[];
    if (s.equippedWeaponIdx >= 0 && s.equippedWeaponIdx < u.weapons.length) {
      u.equippedWeapon = u.weapons[s.equippedWeaponIdx];
    } else if (u.weapons.length > 0) {
      u.equippedWeapon = u.weapons[0];
    }
  }
  u.hasMoved = s.hasMoved;
  u.hasActed = s.hasActed;
  u.isDead = s.isDead;
  u.modelId = s.modelId || u.modelId;
  return u;
}

export const save = {
  // ----- Save the current game state -----
  write(payload: Omit<SavePayload, "version" | "savedAt">, slotId: string | null = null): boolean {
    if (typeof localStorage === "undefined") return false;
    const full: SavePayload = { ...payload, version: VERSION, savedAt: Date.now() };
    const json = JSON.stringify(full);
    try {
      if (slotId) {
        localStorage.setItem(KEY_SLOT_PREFIX + slotId, json);
        // Update meta
        const m = loadMeta();
        const ch = CHAPTERS[payload.chapterIndex];
        const label = (ch?.name || payload.chapterId) + " · T" + payload.turn;
        const existing = m.slots.findIndex(s => s.id === slotId);
        const entry = { id: slotId, label, savedAt: full.savedAt, chapterId: payload.chapterId, turn: payload.turn };
        if (existing >= 0) m.slots[existing] = entry; else m.slots.push(entry);
        m.lastSaveAt = full.savedAt;
        saveMeta(m);
      } else {
        localStorage.setItem(KEY_AUTOSAVE, json);
        const m = loadMeta();
        m.lastSaveAt = full.savedAt;
        saveMeta(m);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  // ----- Read a save -----
  read(slotId: string): SavePayload | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY_SLOT_PREFIX + slotId);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SavePayload;
      if (data.version !== VERSION) return null;
      return data;
    } catch { return null; }
  },

  readAutosave(): SavePayload | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY_AUTOSAVE);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SavePayload;
      if (data.version !== VERSION) return null;
      return data;
    } catch { return null; }
  },

  hasAutosave(): boolean {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(KEY_AUTOSAVE);
  },

  // ----- Delete a save -----
  remove(slotId: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(KEY_SLOT_PREFIX + slotId);
    const m = loadMeta();
    m.slots = m.slots.filter(s => s.id !== slotId);
    saveMeta(m);
  },

  removeAutosave(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(KEY_AUTOSAVE);
  },

  // ----- Meta -----
  getMeta(): SaveMeta {
    return loadMeta();
  },

  markChapterComplete(chapterId: string): void {
    const m = loadMeta();
    if (!m.completedChapters.includes(chapterId)) {
      m.completedChapters.push(chapterId);
      saveMeta(m);
    }
  },

  isChapterComplete(chapterId: string): boolean {
    return loadMeta().completedChapters.includes(chapterId);
  },

  // ----- Apply a save to a GameGrid + units array -----
  applyToGrid(payload: SavePayload): { units: RuntimeUnit[]; grid: GameGrid } {
    const ch = CHAPTERS.find(c => c.id === payload.chapterId);
    if (!ch) throw new Error("Unknown chapter: " + payload.chapterId);
    const grid = new GameGrid(ch.mapSize.w, ch.mapSize.h, ch.terrain as any);
    for (const dp of ch.deploymentPoints) grid.terrain[dp.y][dp.x] = "deployment";
    const units: RuntimeUnit[] = [];
    for (const s of payload.units) {
      const u = unitFromSerialized(s);
      if (!u.isDead) grid.placeUnit(u, u.pos);
      units.push(u);
    }
    return { units, grid };
  },
};
