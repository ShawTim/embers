import { create } from "zustand";
import type { RuntimeUnit } from "../types";
import { GameGrid, type Pos, posKey } from "./grid";
import { createUnit, useItemOnUnit, maybeLevelUp } from "../data/unitFactory";
import {
  calculateExp,
  consumeEquippedWeaponUse,
  previewCombat,
  removeBrokenWeapons,
  resolveCombat,
  type BrokenWeapon,
  type CombatPreview,
} from "./combat";
import { decideAIAction, type AIDecision } from "./ai";
import { CHAPTERS, WEAPONS, ITEMS } from "../data/gameData";
import {
  PLAYER_IDS_BY_CHAPTER,
  createCampaignRuntimeUnit,
  snapshotCampaignUnit,
  syncCampaignRoster,
  type CampaignRoster,
} from "./campaign";

// Village reward pools per chapter tier
// Shop items available between chapters
const SHOP_ITEMS: { id: string; price: number }[] = [
  { id: "vulnerary", price: 150 },
  { id: "elixir", price: 800 },
  { id: "master_seal", price: 3000 },
  { id: "str_ring", price: 2000 },
  { id: "spd_ring", price: 2000 },
  { id: "def_ring", price: 2000 },
  { id: "iron_sword", price: 200 },
  { id: "steel_sword", price: 500 },
  { id: "iron_lance", price: 200 },
  { id: "steel_lance", price: 500 },
  { id: "iron_axe", price: 200 },
  { id: "iron_bow", price: 250 },
  { id: "fire", price: 400 },
  { id: "heal_staff", price: 400 },
  { id: "hand_axe", price: 300 },
  { id: "javelin", price: 350 },
];

// Chapter completion rewards — only UPGRADE weapons (no Iron tier)
const CHAPTER_REWARDS: Record<string, { weapons: string[]; gold: number }> = {
  ch01: { weapons: ["steel_sword"], gold: 500 },
  ch02: { weapons: ["steel_bow"], gold: 600 },
  ch03: { weapons: ["elfire"], gold: 800 },
  ch04: { weapons: ["hand_axe"], gold: 700 },
  ch05: { weapons: ["steel_lance", "killing_edge"], gold: 1000 },
  ch06: { weapons: ["mend_staff"], gold: 1000 },
  ch07: { weapons: ["javelin"], gold: 1200 },
  ch08: { weapons: ["lightning", "silver_sword"], gold: 1200 },
  ch09: { weapons: ["killer_axe"], gold: 1500 },
  ch10: { weapons: ["silver_lance", "silver_bow"], gold: 2000 },
  ch11: { weapons: ["silver_axe"], gold: 1500 },
  ch12: { weapons: ["elfire", "brave_sword"], gold: 2000 },
  ch13: { weapons: ["silver_bow"], gold: 1800 },
  ch14: { weapons: ["javelin", "nosferatu"], gold: 2000 },
  ch15: { weapons: ["silver_lance", "silver_axe"], gold: 2500 },
  ch16: { weapons: ["silver_sword", "fimbulvetr"], gold: 2500 },
  ch17: { weapons: ["divinus"], gold: 3000 },
  ch18: { weapons: ["brave_sword", "silver_bow"], gold: 3000 },
  ch19: { weapons: ["fimbulvetr", "silver_lance"], gold: 3500 },
  ch20: { weapons: ["fimbulvetr", "brave_sword"], gold: 5000 },
};

// Village rewards — only useful upgrades
const VILLAGE_REWARDS: Record<string, string[]> = {
  ch01: ["vulnerary", "steel_sword"],
  ch02: ["steel_bow", "heal_staff"],
  ch03: ["elfire", "steel_sword"],
  ch04: ["javelin", "vulnerary"],
  ch05: ["steel_lance", "hand_axe"],
  ch06: ["killing_edge", "hand_axe"],
  ch07: ["elfire", "steel_bow"],
  ch08: ["mend_staff", "lightning"],
  ch09: ["killer_axe", "silver_sword"],
  ch10: ["silver_sword", "mend_staff"],
  ch11: ["steel_lance", "steel_bow"],
  ch12: ["elfire", "killing_edge"],
  ch13: ["silver_bow", "hand_axe"],
  ch14: ["silver_lance", "heal_staff"],
  ch15: ["killer_axe", "physic_staff"],
  ch16: ["silver_axe", "elfire"],
  ch17: ["silver_bow", "brave_sword"],
  ch18: ["nosferatu", "silver_sword"],
  ch19: ["divinus", "silver_lance"],
  ch20: ["brave_sword", "fimbulvetr"],
};

// Weapon drop chances
const DROP_CHANCE_BOSS = 1.0;
const DROP_CHANCE_NORMAL = 0.15;

// Iron-tier weapons that should NOT drop (useless duplicates)
const BASIC_WEAPONS = new Set(["iron_sword", "iron_lance", "iron_axe", "iron_bow", "fire", "heal_staff", "slim_sword", "slim_lance", "short_bow"]);

function createInitialConvoy() {
  return [
    { id: "vulnerary", type: "item" as const, uses: 3 },
    { id: "vulnerary", type: "item" as const, uses: 3 },
    { id: "iron_sword", type: "weapon" as const, uses: 45 },
    { id: "iron_lance", type: "weapon" as const, uses: 45 },
    { id: "master_seal", type: "item" as const, uses: 1 },
  ];
}

// Track visited villages
var visitedVillages: Set<string> = new Set();
import type { Lang } from "../i18n";
import { t, unitName, chapterInfo } from "../i18n";
import { getDialogueForTrigger } from "../data/dialogues";
import { audio } from "../audio/engine";
import type { WeaponType } from "../types";
import {
  save as saveSystem,
  serializeRuntimeUnit,
  type SavePayload,
  type SaveWritePayload,
} from "./save";

function weaponSfxName(w: WeaponType | undefined): string | null {
  if (!w) return "hit_sword";
  switch (w) {
    case "sword": return "hit_sword";
    case "axe": return "hit_axe";
    case "lance": return "hit_lance";
    case "bow": return "hit_lance";
    case "fire": return "fire";
    case "thunder": return "lightning";
    case "wind": return "move";
    case "light": return "crit";
    case "dark": return "dark";
    case "staff": return "heal";
    default: return "hit_sword";
  }
}

export type Phase = "player" | "enemy" | "combat" | "victory" | "defeat" | "epilogue";
export type SelectionMode = "idle" | "moving" | "actionMenu" | "targeting" | "enemyInfo";

interface GameState {
  grid: GameGrid | null;
  chapter: typeof CHAPTERS[0] | null;
  units: RuntimeUnit[];
  phase: Phase;
  turn: number;
  gold: number;
  campaignRoster: CampaignRoster;
  selectedUnit: RuntimeUnit | null;
  hoveredUnit: RuntimeUnit | null;
  hoveredTile: Pos | null;
  moveRange: Map<string, Pos[]>;
  attackRange: string[];
  selectionMode: SelectionMode;
  pendingMove: Pos | null;
  combatPreview: { attacker: RuntimeUnit; defender: RuntimeUnit; preview: CombatPreview } | null;
  combatLog: { text: string; color: string }[];
  objectiveText: string;
  message: string | null;
  lang: Lang;
  hitEffects: { id: number; position: [number, number, number]; isCrit: boolean; weaponType?: string }[];
  damageNumbers: { id: number; position: [number, number, number]; amount: number; isCrit: boolean; isHeal: boolean; isMiss: boolean }[];
  healAuras: { id: number; position: [number, number, number]; born: number }[];
  bloodDecals: { id: number; position: [number, number, number]; born: number }[];
  screenShake: number;
  timeScale: number;        // 1.0 = normal, 0.3 = slow-mo
  slowMoUntil: number;      // performance.now() ms timestamp
  bossEntrance: { name: string; born: number; dur: number } | null;  // BOSS intro cinematic
  activeCombat: { attacker: RuntimeUnit; defender: RuntimeUnit } | null;
  combatPhase: { phase: string; attackerId: string; defenderId: string; isCounter: boolean } | null;

  setLang: (lang: Lang) => void;
  initChapter: (i: number) => void;
  startNewCampaign: () => void;
  startNextChapter: () => void;
  selectUnit: (u: RuntimeUnit) => void;
  deselectUnit: () => void;
  hoverTile: (p: Pos | null) => void;
  hoverUnit: (u: RuntimeUnit | null) => void;
  onTileClick: (p: Pos) => void;
  confirmMove: (p: Pos) => void;
  cancelMove: () => void;
  attackTarget: (target: RuntimeUnit) => Promise<void>;
  waitUnit: () => void;
  healTarget: (target: RuntimeUnit) => void;
  endPlayerTurn: () => void;
  processEnemyTurn: () => Promise<void>;
  setSelectionMode: (m: SelectionMode) => void;
  showCombatPreview: (a: RuntimeUnit, d: RuntimeUnit) => void;
  clearCombatPreview: () => void;
  addHitEffect: (p: [number, number, number], crit: boolean, weaponType?: string) => void;
  removeHitEffect: (id: number) => void;
  addHealAura: (p: [number, number, number]) => void;
  removeHealAura: (id: number) => void;
  addBloodDecal: (p: [number, number, number]) => void;
  removeBloodDecal: (id: number) => void;
  addDamageNumber: (p: [number, number, number], amt: number, opts?: { isCrit?: boolean; isHeal?: boolean; isMiss?: boolean }) => void;
  removeDamageNumber: (id: number) => void;
  triggerShake: (amt: number) => void;
  triggerSlowMo: (scale: number, durationMs: number) => void;
  triggerBossEntrance: (name: string, dur: number) => void;
  addLog: (text: string, color?: string) => void;
  activeDialogue: string | null;
  bossDeathDialogueComplete: boolean;
  victoryResolved: boolean;
  setDialogue: (id: string | null) => void;
  clearDialogue: () => void;
  // Crit events: increment a counter so React components can show a
  // brief screen flash on every crit hit.  Components use a per-mount
  // key derived from this counter to remount + replay the animation.
  critEvent: number;
  triggerCritFlash: () => void;
  // Projectile queue: the combat flow pushes a spec when the swing
  // animation reaches "strike" and the renderer drains + spawns the
  // flight.  Same for slash trails on melee.
  pendingProjectiles: { id: number; start: [number, number, number]; end: [number, number, number]; kind: string; color: number; duration: number }[];
  pendingSlashTrails: { id: number; at: [number, number, number]; color: number; duration: number }[];
  drainProjectiles: () => { id: number; start: [number, number, number]; end: [number, number, number]; kind: string; color: number; duration: number }[];
  drainSlashTrails: () => { id: number; at: [number, number, number]; color: number; duration: number }[];
  // Last attack: a (attackerId, targetId) pair.  When the player turns
  // end without spending all their actions, the next turn can offer a
  // "Repeat last attack" button that auto-attacks the same target again
  // with whoever is in range.  Set after attackTarget/healTarget resolve.
  lastAction: { kind: "attack" | "heal"; targetUid: string } | null;
  setLastAction: (kind: "attack" | "heal", targetUid: string) => void;
  clearLastAction: () => void;
  repeatLastAction: () => Promise<void>;
  // Chapter intro: the camera pans from a corner to centre on chapter
  // start, then lerps back to normal.  Stored as the chapter id + a
  // timestamp so the camera can decay out.
  chapterIntro: { chapterId: string; born: number } | null;
  triggerChapterIntro: (chapterId: string) => void;
  useItemAction: (itemId: string, unitUid?: string) => void;
  equipWeaponAction: (weaponIndex: number) => void;
  equipConvoyWeaponAction: (convoyIndex: number) => void;
  convoy: { id: string; type: "weapon" | "item"; uses: number }[];
  addToConvoy: (id: string, type: "weapon" | "item", uses?: number) => void;
  buyItem: (itemId: string) => boolean;
  expPopup: { unitName: string; amount: number; pos: [number, number, number]; leveledUp: boolean; newLevel: number; statGains: Record<string, number> } | null;
  showExpPopup: (name: string, amount: number, pos: [number, number, number], leveledUp: boolean, newLevel: number, statGains: Record<string, number>) => void;
  clearExpPopup: () => void;
  // Epilogue: triggered when the player finishes ch20_credits.  Sets
  // phase to "epilogue" and shows the OutroOverlay.  From the outro
  // the player can either return to the title or start a new game.
  startEpilogue: () => void;
  returnToTitle: () => void;
  // Save / load
  saveToSlot: (slotId: string) => boolean;
  loadFromSlot: (slotId: string) => boolean;
  loadAutosave: () => boolean;
  hasAutosave: () => boolean;
  autosave: () => boolean;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
//  Per-weapon VFX dispatch.  When a unit attacks, push a projectile spec
//  (for ranged / magic) or a slash trail (for melee) into the renderer
//  queue.  The renderer drains + spawns inside its useFrame so the timing
//  lines up with the swing/strike animation phase in the store.
// ---------------------------------------------------------------------------
const PROJ_COLOR: Record<string, number> = {
  fire: 0xff5530, light: 0xfff5b0, thunder: 0xfff060, dark: 0x8030c0,
  lance: 0xa0d0ff, axe: 0xff8030, bow: 0xc0a070, staff: 0x3aff8a,
  wind: 0xa0ffd0, sword: 0xffe080,
};
const PROJ_KIND: Record<string, string> = {
  fire: "fireball", light: "lightning", thunder: "lightning", dark: "dark",
  lance: "lance", axe: "axe", bow: "arrow", staff: "heal",
  wind: "ice", sword: "spark",
};
function queueProjectileForAttack(
  set: (fn: (s: any) => any) => void,
  attacker: RuntimeUnit,
  defender: RuntimeUnit,
  weaponType?: WeaponType,
) {
  const wt = weaponType || attacker.equippedWeapon?.type;
  if (!wt) return;
  // Melee weapons fire a slash trail (no flying projectile).
  if (wt === "sword" || wt === "axe" || wt === "lance") {
    const color = PROJ_COLOR[wt] ?? 0xffe080;
    set(s => ({ pendingSlashTrails: [...s.pendingSlashTrails, { id: Date.now() + Math.random(), at: [defender.pos.x, 0.9, defender.pos.y], color, duration: 0.4 }] }));
    return;
  }
  // Ranged / magic fire a projectile from attacker to defender.
  const kind = PROJ_KIND[wt] ?? "spark";
  const color = PROJ_COLOR[wt] ?? 0xffffff;
  set(s => ({ pendingProjectiles: [...s.pendingProjectiles, {
    id: Date.now() + Math.random(),
    start: [attacker.pos.x, 1.1, attacker.pos.y],
    end: [defender.pos.x, 1.0, defender.pos.y],
    kind, color, duration: 0.45,
  }] }));
}

function logBrokenWeapons(broken: BrokenWeapon[], get: () => GameState) {
  for (const { unit, weapon } of broken) {
    get().addLog(t("weaponBroke", get().lang, {
      unit: unitName(unit.def.id, get().lang),
      weapon: weapon.name,
    }), "#ff9a4a");
  }
}

function buildSavePayload(state: GameState, chapterIndex: number): SaveWritePayload {
  return {
    chapterId: state.chapter!.id,
    chapterIndex,
    turn: state.turn,
    phase: state.phase,
    units: state.units.map(serializeRuntimeUnit),
    campaignRoster: syncCampaignRoster(state.campaignRoster, state.units),
    convoy: state.convoy.map(item => ({ ...item })),
    gold: state.gold,
    completedChapters: [...saveSystem.getMeta().completedChapters],
    activeDialogue: state.activeDialogue,
    bossDeathDialogueComplete: state.bossDeathDialogueComplete,
    victoryResolved: state.victoryResolved,
    lang: state.lang,
  };
}

export const useGame = create<GameState>((set, get) => ({
  grid: null, chapter: null, units: [], phase: "player", turn: 1, gold: 0, campaignRoster: {},
  selectedUnit: null, hoveredUnit: null, hoveredTile: null,
  moveRange: new Map(), attackRange: [], selectionMode: "idle", pendingMove: null,
  combatPreview: null, combatLog: [], objectiveText: "", message: null,
  lang: (typeof localStorage !== "undefined" && localStorage.getItem("srpg-lang") === "zh") ? "zh" : "en",
  hitEffects: [], damageNumbers: [], healAuras: [], bloodDecals: [], screenShake: 0, timeScale: 1, slowMoUntil: 0, bossEntrance: null, activeCombat: null, combatPhase: null, lastAction: null, chapterIntro: null, critEvent: 0,
  activeDialogue: null,
  bossDeathDialogueComplete: false,
  victoryResolved: false,
  convoy: createInitialConvoy(),
  expPopup: null,

  setLang: (lang) => { if (typeof localStorage !== "undefined") localStorage.setItem("srpg-lang", lang); set({ lang }); },

  initChapter: (i) => initializeChapter(set, get, i, {}),
  startNewCampaign: () => {
    set({ campaignRoster: {}, gold: 0, convoy: createInitialConvoy() });
    initializeChapter(set, get, 0, {});
    get().autosave();
  },
  startNextChapter: () => {
    const st = get();
    if (!st.chapter || st.phase !== "victory") return;
    const currentIndex = CHAPTERS.findIndex(chapter => chapter.id === st.chapter!.id);
    if (currentIndex < 0 || currentIndex >= CHAPTERS.length - 1) return;
    const roster = syncCampaignRoster(st.campaignRoster, st.units);
    set({ campaignRoster: roster });
    initializeChapter(set, get, currentIndex + 1, roster);
    get().autosave();
  },

  selectUnit: (u) => {
    const st = get(); if (st.phase !== "player") return;
    if (u.faction !== "player") { set({ hoveredUnit: u }); return; }
    if (u.hasActed || u.isDead) return;
    const g = st.grid!; const mr = g.computeMoveRange(u.pos, u.classDef.baseMove, u.classDef.moveType, u.uid);
    const w = u.equippedWeapon; let at: string[] = [];
    if (w) at = g.computeAttackRange(u.pos, w.minRange, w.maxRange).map(p => posKey(p));
    set({ selectedUnit: u, moveRange: mr, attackRange: at, selectionMode: "moving", hoveredUnit: u });
    audio.play("select");
  },

  deselectUnit: () => set({ selectedUnit: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", pendingMove: null, combatPreview: null }),
  hoverTile: (p) => set({ hoveredTile: p }),
  hoverUnit: (u) => set({ hoveredUnit: u }),

  onTileClick: (p) => {
    const st = get(); if (st.phase !== "player") return;
    const g = st.grid!; const u = g.getUnitAt(p);
    if (st.selectionMode === "idle") {
      if (u && u.faction === "player" && !u.hasActed) get().selectUnit(u);
      else if (u) set({ hoveredUnit: u });
      return;
    }
    if (st.selectionMode === "moving") {
      if (st.selectedUnit && st.moveRange.has(posKey(p))) get().confirmMove(p);
      else if (u && u.faction === "player" && !u.hasActed) get().selectUnit(u);
      else get().deselectUnit();
      return;
    }
    if (st.selectionMode === "targeting") {
      if (u && st.attackRange.includes(posKey(p))) {
        const sel = st.selectedUnit;
        if (sel && sel.equippedWeapon && sel.equippedWeapon.type === "staff") get().healTarget(u);
        else get().attackTarget(u);
      } else get().deselectUnit();
      return;
    }
  },

  confirmMove: (p) => {
    set({ pendingMove: p, selectionMode: "actionMenu" });
    audio.play("move");
    // Seize check: if a player unit is already standing on the seize
    // tile (e.g. they just moved there via confirmMove), victory fires
    // immediately.  In practice the player will usually need to take
    // another action after moving, but we let them seize the moment
    // they are on the tile to keep the chapter ending snappy.
    checkBattleEnd(set, get);
  },
  cancelMove: () => set({ pendingMove: null, selectionMode: "moving" }),

  attackTarget: async (target) => {
    const st = get(); if (!st.selectedUnit || !st.grid || !st.pendingMove) return;
    const atk = st.selectedUnit; const g = st.grid;
    if (!atk.equippedWeapon || atk.equippedWeapon.uses <= 0) return;
    const attackWeaponType = atk.equippedWeapon.type;
    const targetWeaponType = target.equippedWeapon?.type;
    g.moveUnit(atk, st.pendingMove); atk.hasMoved = true;
    set({ phase: "combat", selectionMode: "idle", combatPreview: null, moveRange: new Map(), attackRange: [], activeCombat: { attacker: atk, defender: target }, units: [...g.getAllUnits()] });
    const setP = (ph: string, a: string, d: string, ic = false) => set({ combatPhase: { phase: ph, attackerId: a, defenderId: d, isCounter: ic } });
    setP("approach", atk.uid, target.uid); await sleep(500);
    const rounds = resolveCombat(atk, target, g.getTerrain(atk.pos), g.getTerrain(target.pos));
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i]; const ic = i > 0; const pf = ic ? "counter_" : "";
      setP(pf + "windup", r.attacker.uid, r.defender.uid, ic); await sleep(350);
      setP(pf + "strike", r.attacker.uid, r.defender.uid, ic);
      // Fire the per-weapon VFX on the strike frame so it lines up
      // with the visible weapon swing / cast animation.
      queueProjectileForAttack(set, r.attacker, r.defender, r.weapon.type);
      // SFX: per-weapon hit + crit sting
      const wpnType = r.weapon.type;
      const sfx = weaponSfxName(wpnType);
      if (sfx) audio.play(sfx);
      if (r.crit) audio.play("crit");
      await sleep(200);
      if (r.hit) {
        get().addLog(t("logDmg", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang), n: r.damage, crit: r.crit ? t("crit", get().lang) : "", ko: r.lethal ? t("ko", get().lang) : "" }), r.crit ? "#ff6a3a" : "#ffffff");
        get().addHitEffect([r.defender.pos.x, 1.0, r.defender.pos.y], r.crit, r.weapon.type);
        get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], r.damage, { isCrit: r.crit });
        get().triggerShake(r.crit ? 0.7 : 0.25);
        if (r.crit) { get().triggerSlowMo(0.25, 280); get().triggerCritFlash(); }
      } else { get().addLog(t("logMiss", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang) }), "#888"); get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], 0, { isMiss: true }); }
      setP(pf + "impact", r.attacker.uid, r.defender.uid, ic); await sleep(150);
      setP(pf + "recoil", r.attacker.uid, r.defender.uid, ic); await sleep(350);
      setP(pf + "recovery", r.attacker.uid, r.defender.uid, ic); await sleep(250);
    }
    setP("exit", "", ""); await sleep(300);
    if (target.isDead) {
      g.removeUnit(target);
      get().addLog(t("logDefeated", get().lang, { name: unitName(target.def.id, get().lang) }), "#ff3a3a");
      get().addBloodDecal([target.pos.x, 0.21, target.pos.y]);
      target._lastKilledByWeapon = attackWeaponType;
      audio.play("death");
      // Weapon drop
      tryWeaponDrop(target, get);
    }
    if (atk.isDead) {
      g.removeUnit(atk);
      get().addLog(t("logDefeated", get().lang, { name: unitName(atk.def.id, get().lang) }), "#ff3a3a");
      get().addBloodDecal([atk.pos.x, 0.21, atk.pos.y]);
      atk._lastKilledByWeapon = targetWeaponType;
      audio.play("death");
      set(s => ({
        campaignRoster: {
          ...s.campaignRoster,
          [atk.def.id]: snapshotCampaignUnit(atk),
        },
      }));
    }
    if (!atk.isDead) {
      const expGain = calculateExp(atk, target, target.isDead);
      atk.exp += expGain;
      const { leveledUp, newLevel, statGains } = maybeLevelUp(atk, (lv) => audio.play("level_up"));
      if (leveledUp) {
        get().addLog(t("logLevelUp", get().lang, { name: unitName(atk.def.id, get().lang), n: newLevel }), "#ffe070");
        get().showExpPopup(unitName(atk.def.id, get().lang), expGain, [atk.pos.x, 2.5, atk.pos.y], true, newLevel, statGains);
        await sleep(2500);
        get().clearExpPopup();
      } else {
        get().showExpPopup(unitName(atk.def.id, get().lang), expGain, [atk.pos.x, 2.5, atk.pos.y], false, atk.level, {});
        await sleep(1500);
        get().clearExpPopup();
      }
    }
    logBrokenWeapons(removeBrokenWeapons([atk, target]), get);
    atk.hasActed = true;
    set({ phase: "player", selectedUnit: null, pendingMove: null, units: [...g.getAllUnits()], activeCombat: null, combatPhase: null, lastAction: { kind: "attack", targetUid: target.uid } });
    checkBattleEnd(set, get);
  },

  waitUnit: () => {
    const st = get(); if (!st.selectedUnit || !st.grid || !st.pendingMove) return;
    const u = st.selectedUnit; st.grid.moveUnit(u, st.pendingMove); u.hasActed = true;
    tryVillageVisit(u, get);
    set({ selectedUnit: null, pendingMove: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", units: [...st.grid.getAllUnits()] });
    checkBattleEnd(set, get);
  },

  healTarget: (target) => {
    const st = get(); if (!st.selectedUnit || !st.grid || !st.pendingMove) return;
    const healer = st.selectedUnit;
    if (!healer.equippedWeapon || healer.equippedWeapon.uses <= 0) return;
    st.grid.moveUnit(healer, st.pendingMove);
    const healAmt = (healer.equippedWeapon?.might || 10) + healer.stats.mag;
    const actual = Math.min(healAmt, target.maxHp - target.hp);
    target.hp += actual; healer.exp += 20;
    const { leveledUp, newLevel } = maybeLevelUp(healer, (lv) => audio.play("level_up"));
    if (leveledUp) get().addLog(t("logLevelUp", get().lang, { name: unitName(healer.def.id, get().lang), n: newLevel }), "#ffe070");
    healer.hasActed = true;
    get().addLog(t("logHeal", get().lang, { healer: unitName(healer.def.id, get().lang), target: unitName(target.def.id, get().lang), n: actual }), "#3aff3a");
    get().addDamageNumber([target.pos.x, 1.5, target.pos.y], actual, { isHeal: true });
    get().addHealAura([target.pos.x, 0.22, target.pos.y]);
    logBrokenWeapons(consumeEquippedWeaponUse(healer), get);
    set({ phase: "player", selectedUnit: null, pendingMove: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", combatPreview: null, hoveredUnit: null, units: [...st.grid.getAllUnits()], lastAction: { kind: "heal", targetUid: target.uid } });
    checkBattleEnd(set, get);
  },

  endPlayerTurn: () => {
    const st = get(); if (st.phase !== "player") return;
    set({ phase: "enemy", selectedUnit: null, moveRange: new Map(), attackRange: [], selectionMode: "idle" });
    setTimeout(() => get().processEnemyTurn(), 500);
  },

  processEnemyTurn: async () => {
    const st = get(); const g = st.grid; if (!g) return;
    const enemies = st.units.filter(u => u.faction === "enemy" && !u.isDead);
    // Cinematic intro: the first time the boss is alive at the start
    // of an enemy turn (and we haven't already done it this chapter),
    // play a 1.2s name fade-in with a hard camera shake + 0.5s
    // slow-mo.  Sets a once-flag on the store so it only fires once.
    const boss = enemies.find(u => u.isBoss);
    if (boss && !(st as any)._bossIntroDone) {
      get().triggerBossEntrance(unitName(boss.def.id, get().lang), 1.2);
      get().triggerShake(0.8);
      get().triggerSlowMo(0.4, 500);
      audio.startMusic("boss");
      audio.play("boss_intro");
      set({ _bossIntroDone: true } as any);
      await sleep(900);
    }
    for (const u of enemies) { u.hasMoved = false; u.hasActed = false; }
    for (const u of enemies) {
      if (u.isDead) continue;
      const dec: AIDecision = decideAIAction(u, g, get().units);
      if (dec.action === "wait") continue;
      if (dec.moveTarget && dec.path && (dec.moveTarget.x !== u.pos.x || dec.moveTarget.y !== u.pos.y)) {
        g.moveUnit(u, dec.moveTarget); set({ units: [...g.getAllUnits()] }); await sleep(300);
      }
      if (dec.action === "attack" && dec.attackTarget) {
        const target = dec.attackTarget;
        const attackWeaponType = u.equippedWeapon?.type;
        const targetWeaponType = target.equippedWeapon?.type;
        const rounds = resolveCombat(u, target, g.getTerrain(u.pos), g.getTerrain(target.pos));
        set({ activeCombat: { attacker: u, defender: target } });
        const setP = (ph: string, a: string, d: string, ic = false) => set({ combatPhase: { phase: ph, attackerId: a, defenderId: d, isCounter: ic } });
        setP("approach", u.uid, target.uid); await sleep(500);
        for (let i = 0; i < rounds.length; i++) {
          const r = rounds[i]; const ic = i > 0; const pf = ic ? "counter_" : "";
          setP(pf + "windup", r.attacker.uid, r.defender.uid, ic); await sleep(350);
          setP(pf + "strike", r.attacker.uid, r.defender.uid, ic);
          // Per-weapon VFX on the strike frame.
          queueProjectileForAttack(set, r.attacker, r.defender, r.weapon.type);
          await sleep(200);
          if (r.hit) {
            get().addLog(t("logDmg", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang), n: r.damage, crit: r.crit ? t("crit", get().lang) : "", ko: r.lethal ? t("ko", get().lang) : "" }), r.crit ? "#ff6a3a" : "#ff8a5a");
            get().addHitEffect([r.defender.pos.x, 1.0, r.defender.pos.y], r.crit, r.weapon.type);
            get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], r.damage, { isCrit: r.crit });
            get().triggerShake(r.crit ? 0.7 : 0.25);
            if (r.crit) { get().triggerSlowMo(0.25, 280); get().triggerCritFlash(); }
          } else { get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], 0, { isMiss: true }); }
          setP(pf + "impact", r.attacker.uid, r.defender.uid, ic); await sleep(150);
          setP(pf + "recoil", r.attacker.uid, r.defender.uid, ic); await sleep(350);
          setP(pf + "recovery", r.attacker.uid, r.defender.uid, ic); await sleep(250);
        }
        setP("exit", "", ""); await sleep(300);
        if (target.isDead) {
          g.removeUnit(target);
          get().addLog(t("logDefeated", get().lang, { name: unitName(target.def.id, get().lang) }), "#ff3a3a");
          get().addBloodDecal([target.pos.x, 0.21, target.pos.y]);
          target._lastKilledByWeapon = attackWeaponType;
          audio.play("death");
          if (target.faction === "player") {
            set(s => ({
              campaignRoster: {
                ...s.campaignRoster,
                [target.def.id]: snapshotCampaignUnit(target),
              },
            }));
          }
        }
        if (u.isDead) { g.removeUnit(u); get().addLog(t("logDefeated", get().lang, { name: unitName(u.def.id, get().lang) }), "#ff3a3a"); get().addBloodDecal([u.pos.x, 0.21, u.pos.y]); u._lastKilledByWeapon = targetWeaponType; audio.play("death"); }
        if (!u.isDead) { u.exp += calculateExp(u, target, target.isDead); maybeLevelUp(u, (lv) => audio.play("level_up")); }
        logBrokenWeapons(removeBrokenWeapons([u, target]), get);
        set({ units: [...g.getAllUnits()], activeCombat: null, combatPhase: null }); await sleep(200);
      } else if (dec.action === "heal" && dec.healTarget) {
        const healAmt = u.equippedWeapon?.might || 10; const actual = Math.min(healAmt, dec.healTarget.maxHp - dec.healTarget.hp);
        dec.healTarget.hp += actual;
        u.exp += 20; maybeLevelUp(u, (lv) => audio.play("level_up"));
        get().addLog(t("logHeal", get().lang, { healer: unitName(u.def.id, get().lang), target: unitName(dec.healTarget.def.id, get().lang), n: actual }), "#3aff8a");
        get().addDamageNumber([dec.healTarget.pos.x, 1.5, dec.healTarget.pos.y], actual, { isHeal: true });
        get().addHealAura([dec.healTarget.pos.x, 0.22, dec.healTarget.pos.y]);
        audio.play("heal");
        logBrokenWeapons(consumeEquippedWeaponUse(u), get);
        set({ units: [...g.getAllUnits()] }); await sleep(300);
      }
    }
    const players = g.getAllUnits().filter(u => u.faction === "player");
    for (const u of players) { u.hasMoved = false; u.hasActed = false; }
    const nt = get().turn + 1;
    set({ phase: "player", turn: nt, message: null, units: [...g.getAllUnits()] });
    const ch = get().chapter;
    if (ch?.reinforcements) for (const r of ch.reinforcements) if (r.turn === nt) { const nu = createUnit(r.unitId, r.pos, { aiType: r.aiType }); g.placeUnit(nu, r.pos); get().addLog(t("logReinforce", get().lang), "#ffaa3a"); set({ units: [...g.getAllUnits()] }); }
    checkBattleEnd(set, get);
    // Keep autosave as a tactical retry point. Saving after the enemy phase
    // restores a player turn before any unit has committed its next action.
    if (get().phase === "player") get().autosave();
  },

  setSelectionMode: (m) => set({ selectionMode: m }),
  showCombatPreview: (a, d) => { const st = get(); if (!st.grid) return; const p = previewCombat(a, d, st.grid.getTerrain(a.pos), st.grid.getTerrain(d.pos)); set({ combatPreview: { attacker: a, defender: d, preview: p } }); },
  clearCombatPreview: () => set({ combatPreview: null }),

  addHitEffect: (p, crit, weaponType) => set(s => ({ hitEffects: [...s.hitEffects, { id: Date.now() + Math.random(), position: p, isCrit: crit, weaponType }] })),
  removeHitEffect: (id) => set(s => ({ hitEffects: s.hitEffects.filter(e => e.id !== id) })),
  addHealAura: (p) => set(s => ({ healAuras: [...(s.healAuras || []), { id: Date.now() + Math.random(), position: p, born: performance.now() / 1000 }] })),
  removeHealAura: (id) => set(s => ({ healAuras: (s.healAuras || []).filter(a => a.id !== id) })),
  addBloodDecal: (p) => set(s => ({ bloodDecals: [...(s.bloodDecals || []), { id: Date.now() + Math.random(), position: p, born: performance.now() / 1000 }] })),
  removeBloodDecal: (id) => set(s => ({ bloodDecals: (s.bloodDecals || []).filter(a => a.id !== id) })),
  addDamageNumber: (p, amt, opts = {}) => set(s => ({ damageNumbers: [...s.damageNumbers, { id: Date.now() + Math.random(), position: p, amount: amt, isCrit: opts.isCrit || false, isHeal: opts.isHeal || false, isMiss: opts.isMiss || false }] })),
  removeDamageNumber: (id) => set(s => ({ damageNumbers: s.damageNumbers.filter(n => n.id !== id) })),
  triggerShake: (amt) => set({ screenShake: amt }),
  triggerSlowMo: (scale, durationMs) => set({ timeScale: scale, slowMoUntil: performance.now() + durationMs }),
  triggerCritFlash: () => set(s => ({ critEvent: s.critEvent + 1 })),
  triggerBossEntrance: (name, dur) => set({ bossEntrance: { name, born: performance.now() / 1000, dur } }),
  addLog: (text, color = "#fff") => set(s => ({ combatLog: [...s.combatLog.slice(-20), { text, color }] })),
  setDialogue: (id) => set({ activeDialogue: id }),
  clearDialogue: () => {
    const st = get();
    const ch = st.chapter;
    const dialogueId = st.activeDialogue;
    if (!dialogueId) return;

    // Boss-death dialogue is part of the objective state machine. Mark it
    // consumed before checking the objective again so it cannot reopen.
    const bossDeathId = ch ? getDialogueForTrigger(ch.id, "boss_death") : null;
    if (dialogueId === bossDeathId) {
      set({ activeDialogue: null, bossDeathDialogueComplete: true });
      checkBattleEnd(set, get);
      return;
    }

    // The final chapter chains victory dialogue into credits, then into the
    // epilogue overlay.
    if (ch?.id === "ch20" && dialogueId === "ch20_victory") {
      set({ activeDialogue: "ch20_credits" });
      return;
    }
    if (ch?.id === "ch20" && dialogueId === "ch20_credits") {
      set({ activeDialogue: null, phase: "epilogue" });
      return;
    }
    set({ activeDialogue: null });
  },
  pendingProjectiles: [],
  pendingSlashTrails: [],
  drainProjectiles: () => { const q = get().pendingProjectiles; set({ pendingProjectiles: [] }); return q; },
  drainSlashTrails: () => { const q = get().pendingSlashTrails; set({ pendingSlashTrails: [] }); return q; },
  useItemAction: (itemId, unitUid) => {
    const st = get();
    const unit = unitUid
      ? st.units.find(candidate => candidate.uid === unitUid)
      : st.selectedUnit;
    if (!unit || unit.faction !== "player" || unit.isDead) return;
    const result = useItemOnUnit(itemId, unit);
    if (result.success) {
      // Remove item from convoy
      const idx = st.convoy.findIndex(c => c.id === itemId);
      if (idx >= 0) {
        const newConvoy = [...st.convoy];
        newConvoy[idx] = { ...newConvoy[idx], uses: newConvoy[idx].uses - 1 };
        if (newConvoy[idx].uses <= 0) newConvoy.splice(idx, 1);
        get().addLog(`${unitName(unit.def.id, st.lang)} used ${itemId}: ${result.message}`, "#3aff3a");
        set({ convoy: newConvoy, units: [...st.grid!.getAllUnits()] });
      }
      unit.hasActed = true;
      set({ selectedUnit: null, pendingMove: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", units: [...st.grid!.getAllUnits()] });
    }
  },
  equipWeaponAction: (weaponIndex) => {
    const st = get(); if (!st.selectedUnit) return;
    const unit = st.selectedUnit;
    if (weaponIndex >= 0 && weaponIndex < unit.weapons.length) {
      unit.equippedWeapon = unit.weapons[weaponIndex];
      get().addLog(`${unitName(unit.def.id, st.lang)} equipped ${unit.equippedWeapon.name}`, "#8cf");
      set({ units: [...st.grid!.getAllUnits()] });
    }
  },
  equipConvoyWeaponAction: (convoyIndex) => {
    const st = get();
    const unit = st.selectedUnit;
    const convoyEntry = st.convoy[convoyIndex];
    if (!unit || !convoyEntry || convoyEntry.type !== "weapon") return;
    const definition = WEAPONS[convoyEntry.id];
    if (!definition || !unit.classDef.weapons.includes(definition.type)) return;
    const weapon = { ...definition, uses: convoyEntry.uses };
    const convoy = [...st.convoy];
    convoy.splice(convoyIndex, 1);
    unit.weapons.push(weapon);
    unit.equippedWeapon = weapon;
    get().addLog(`${unitName(unit.def.id, st.lang)} equipped ${weapon.name}`, "#8cf");
    set({ convoy, units: [...st.grid!.getAllUnits()] });
  },
  setLastAction: (kind, targetUid) => set({ lastAction: { kind, targetUid } }),
  clearLastAction: () => set({ lastAction: null }),
  triggerChapterIntro: (chapterId) => set({ chapterIntro: { chapterId, born: performance.now() / 1000 } }),
  repeatLastAction: async () => {
    const st = get();
    if (!st.grid || !st.lastAction) return;
    const target = st.units.find(u => u.uid === st.lastAction!.targetUid);
    if (!target || target.isDead) { set({ lastAction: null }); return; }
    const kind = st.lastAction.kind;
    for (const u of st.units) {
      if (u.faction !== "player" || u.isDead || u.hasActed) continue;
      const w = u.equippedWeapon; if (!w) continue;
      if (kind === "heal" && w.type !== "staff") continue;
      if (kind === "attack" && w.type === "staff") continue;
      const moveRange = st.grid.computeMoveRange(u.pos, u.classDef.baseMove, u.classDef.moveType, u.uid);
      // Find a move target that gets us in range
      for (const [k, path] of moveRange) {
        const from = path[path.length - 1];
        const atk = st.grid.computeAttackRange(from, w.minRange, w.maxRange);
        if (atk.some(p => p.x === target.pos.x && p.y === target.pos.y)) {
          set({ pendingMove: from, selectionMode: "actionMenu", selectedUnit: u, moveRange });
          if (kind === "heal") { st.healTarget(target); }
          else { st.attackTarget(target); }
          return;
        }
      }
    }
  },
  addToConvoy: (id, type, uses) => set(s => ({ convoy: [...s.convoy, { id, type, uses: uses || 1 }] })),
  buyItem: (itemId) => {
    const st = get();
    const shopItem = SHOP_ITEMS.find(s => s.id === itemId);
    if (!shopItem) return false;
    if (st.gold < shopItem.price) return false;
    const w = WEAPONS[itemId];
    const i = ITEMS[itemId];
    if (w) get().addToConvoy(itemId, "weapon", w.uses);
    else if (i) get().addToConvoy(itemId, "item", i.uses);
    set({ gold: st.gold - shopItem.price });
    return true;
  },
  showExpPopup: (name, amount, pos, leveledUp, newLevel, statGains) => set({ expPopup: { unitName: name, amount, pos, leveledUp, newLevel, statGains } }),
  clearExpPopup: () => set({ expPopup: null }),

  startEpilogue: () => {
    // Direct entry: clear any active dialogue, jump to epilogue phase.
    // The OutroOverlay takes over the screen.
    set({ activeDialogue: null, phase: "epilogue" });
  },
  returnToTitle: () => {
    // Reset the game to the title screen.  Preserves language + audio
    // settings but discards the in-flight chapter state.
    set({
      grid: null,
      chapter: null,
      units: [],
      phase: "player",
      turn: 1,
      selectedUnit: null,
      hoveredUnit: null,
      hoveredTile: null,
      moveRange: new Map(),
      attackRange: [],
      selectionMode: "idle",
      pendingMove: null,
      combatPreview: null,
      combatLog: [],
      objectiveText: "",
      message: null,
      gold: 0,
      campaignRoster: {},
      convoy: createInitialConvoy(),
      hitEffects: [],
      damageNumbers: [],
      healAuras: [],
      bloodDecals: [],
      screenShake: 0,
      timeScale: 1,
      slowMoUntil: 0,
      bossEntrance: null,
      activeCombat: null,
      combatPhase: null,
      activeDialogue: null,
      bossDeathDialogueComplete: false,
      victoryResolved: false,
      pendingProjectiles: [],
      pendingSlashTrails: [],
      lastAction: null,
      chapterIntro: null,
      critEvent: 0,
      expPopup: null,
    } as any);
  },

  saveToSlot: (slotId) => {
    const st = get();
    if (!st.chapter || !st.grid) return false;
    const chapterIndex = CHAPTERS.findIndex(c => c.id === st.chapter!.id);
    if (chapterIndex < 0) return false;
    return saveSystem.write(buildSavePayload(st, chapterIndex), slotId);
  },

  loadFromSlot: (slotId) => {
    const payload = saveSystem.read(slotId);
    if (!payload) return false;
    return applySavePayload(set, get, payload);
  },

  loadAutosave: () => {
    const payload = saveSystem.readAutosave();
    if (!payload) return false;
    return applySavePayload(set, get, payload);
  },

  hasAutosave: () => saveSystem.hasAutosave(),

  autosave: () => {
    const st = get();
    if (!st.chapter || !st.grid || st.phase !== "player") return false;
    const chapterIndex = CHAPTERS.findIndex(c => c.id === st.chapter!.id);
    if (chapterIndex < 0) return false;
    return saveSystem.write(buildSavePayload(st, chapterIndex), null);
  },
}));

function applySavePayload(set: any, get: any, payload: SavePayload): boolean {
  try {
    const ch = CHAPTERS[payload.chapterIndex] || CHAPTERS.find(c => c.id === payload.chapterId);
    if (!ch) return false;
    const { grid, units } = saveSystem.applyToGrid(payload);
    saveSystem.mergeCompletedChapters(payload.completedChapters);
    const restoredPhase: Phase = payload.phase === "victory"
      || payload.phase === "defeat"
      || payload.phase === "epilogue"
      ? payload.phase
      : "player";
    set({
      grid,
      chapter: ch,
      units,
      phase: restoredPhase,
      turn: payload.turn,
      selectedUnit: null,
      hoveredUnit: null,
      hoveredTile: null,
      moveRange: new Map(),
      attackRange: [],
      selectionMode: "idle",
      pendingMove: null,
      combatPreview: null,
      combatLog: [],
      objectiveText: chapterInfo(ch.id, "obj", payload.lang),
      message: restoredPhase === "victory"
        ? t("victory", payload.lang)
        : restoredPhase === "defeat"
          ? t("defeat", payload.lang)
          : null,
      hitEffects: [],
      damageNumbers: [],
      healAuras: [],
      bloodDecals: [],
      screenShake: 0,
      timeScale: 1,
      slowMoUntil: 0,
      bossEntrance: null,
      activeCombat: null,
      combatPhase: null,
      activeDialogue: payload.activeDialogue,
      bossDeathDialogueComplete: payload.bossDeathDialogueComplete,
      victoryResolved: payload.victoryResolved,
      _bossIntroDone: false,
      pendingProjectiles: [],
      pendingSlashTrails: [],
      lastAction: null,
      chapterIntro: null,
      convoy: payload.convoy.map(item => ({ ...item })),
      gold: payload.gold,
      campaignRoster: syncCampaignRoster(payload.campaignRoster, units),
      lang: payload.lang,
      critEvent: 0,
    } as any);
    audio.play("menu");
    return true;
  } catch (e) {
    return false;
  }
}

function checkBattleEnd(set: any, get: any) {
  const s: GameState = get();
  if (s.victoryResolved || s.phase === "victory" || s.phase === "epilogue") return;
  const players = s.units.filter((u: RuntimeUnit) => u.faction === "player" && !u.isDead);
  const enemies = s.units.filter((u: RuntimeUnit) => u.faction === "enemy" && !u.isDead);
  const hasLivingLord = players.some((u: RuntimeUnit) => u.def.isLord);
  // Dead units are removed from GameGrid and therefore from the runtime unit
  // list. An absent lord must still cause defeat.
  if (!players.length || !hasLivingLord) {
    set({ phase: "defeat", message: t("defeat", get().lang) });
    return;
  }
  const ch = s.chapter; if (!ch) return;
  let won = false;
  if (ch.objectiveType === "route" && !enemies.length) won = true;
  else if (ch.objectiveType === "boss") {
    const liveBoss = s.units.find((u: RuntimeUnit) => u.isBoss && !u.isDead);
    if (!liveBoss) {
      const bd = getDialogueForTrigger(ch.id, "boss_death");
      if (bd && !s.bossDeathDialogueComplete) {
        if (s.activeDialogue !== bd) set({ activeDialogue: bd });
        return;
      }
      won = true;
    }
  }
  else if (ch.objectiveType === "defend") {
    const need = ch.objectiveTurns ?? 99;
    if (s.turn >= need) won = true;
  }
  else if (ch.objectiveType === "seize" && ch.seizeTile) {
    const stTile = ch.seizeTile;
    const onTile = players.some((u: RuntimeUnit) => u.pos.x === stTile.x && u.pos.y === stTile.y);
    if (onTile) won = true;
  }
  if (won) resolveChapterVictory(set, get);
}

function resolveChapterVictory(set: any, get: any) {
  const s: GameState = get();
  const ch = s.chapter;
  if (!ch || s.victoryResolved) return;

  saveSystem.markChapterComplete(ch.id);
  const reward = CHAPTER_REWARDS[ch.id];
  const convoy = [...s.convoy];
  let gold = s.gold;
  let combatLog = s.combatLog;
  if (reward) {
    for (const wid of reward.weapons) {
      const w = WEAPONS[wid];
      if (w) convoy.push({ id: wid, type: "weapon", uses: w.uses });
    }
    gold += reward.gold;
    combatLog = [
      ...s.combatLog.slice(-20),
      {
        text: t("chapterReward", s.lang, { item: reward.weapons.join(", ") + " + " + reward.gold + "G" }),
        color: "#ffcc6a",
      },
    ];
  }

  set({
    victoryResolved: true,
    campaignRoster: syncCampaignRoster(s.campaignRoster, s.units),
    phase: "victory",
    message: t("victory", s.lang),
    activeDialogue: getDialogueForTrigger(ch.id, "victory"),
    convoy,
    gold,
    combatLog,
  });
}

function initializeChapter(
  set: any,
  get: any,
  chapterIndex: number,
  sourceRoster: CampaignRoster,
) {
  const ch = CHAPTERS[chapterIndex];
  if (!ch) return;
  visitedVillages = new Set();
  const grid = new GameGrid(ch.mapSize.w, ch.mapSize.h, ch.terrain as any);
  for (const point of ch.deploymentPoints) grid.terrain[point.y][point.x] = "deployment";

  const roster = { ...sourceRoster };
  const units: RuntimeUnit[] = [];
  const playerIds = PLAYER_IDS_BY_CHAPTER[ch.id] || ["kael", "lyra", "borin", "serra"];
  let deploymentIndex = 0;
  for (const playerId of playerIds) {
    if (deploymentIndex >= ch.deploymentPoints.length) break;
    let saved = roster[playerId];
    if (!saved) {
      const fresh = createUnit(playerId, ch.deploymentPoints[deploymentIndex]);
      saved = snapshotCampaignUnit(fresh);
      roster[playerId] = saved;
    }
    if (saved.isDead) continue;
    const unit = createCampaignRuntimeUnit(saved, ch.deploymentPoints[deploymentIndex], true);
    units.push(unit);
    grid.placeUnit(unit, ch.deploymentPoints[deploymentIndex]);
    deploymentIndex++;
  }
  for (const enemy of ch.enemies) {
    const unit = createUnit(enemy.unitId, enemy.pos, { aiType: enemy.aiType, isBoss: enemy.isBoss });
    units.push(unit);
    grid.placeUnit(unit, enemy.pos);
  }

  set({
    grid,
    chapter: ch,
    units,
    campaignRoster: roster,
    phase: "player",
    turn: 1,
    selectedUnit: null,
    hoveredUnit: null,
    hoveredTile: null,
    moveRange: new Map(),
    attackRange: [],
    selectionMode: "idle",
    pendingMove: null,
    combatPreview: null,
    combatLog: [],
    objectiveText: chapterInfo(ch.id, "obj", get().lang),
    message: null,
    hitEffects: [],
    damageNumbers: [],
    healAuras: [],
    bloodDecals: [],
    screenShake: 0,
    timeScale: 1,
    slowMoUntil: 0,
    bossEntrance: null,
    activeCombat: null,
    combatPhase: null,
    activeDialogue: getDialogueForTrigger(ch.id, "pre"),
    bossDeathDialogueComplete: false,
    victoryResolved: false,
    _bossIntroDone: false,
    pendingProjectiles: [],
    pendingSlashTrails: [],
    lastAction: null,
    chapterIntro: { chapterId: ch.id, born: performance.now() / 1000 },
  } as any);
}

// === Weapon drop system ===
function tryWeaponDrop(killed: RuntimeUnit, get: any): void {
  const dropChance = killed.isBoss ? DROP_CHANCE_BOSS : DROP_CHANCE_NORMAL;
  if (Math.random() > dropChance) return;
  const wpn = killed.equippedWeapon;
  if (!wpn || wpn.type === "staff") return;
  if (BASIC_WEAPONS.has(wpn.id)) {
    get().addLog(t("itemDrop", get().lang, { item: "50G" }) as any, "#ffd060");
    const g = get() as any;
    g.gold = (g.gold || 0) + 50;
    useGame.setState({ gold: g.gold });
    return;
  }
  get().addToConvoy(wpn.id, "weapon", wpn.uses);
  get().addLog(t("itemDrop", get().lang, { item: wpn.name }) as any, "#8cf");
}

// Village visit

// === Village visit system ===
function tryVillageVisit(unit: RuntimeUnit, get: any): void {
  const st: GameState = get();
  if (!st.chapter) return;
  if (unit.faction !== "player") return;
  const villageKey = st.chapter.id + ":" + unit.pos.x + "," + unit.pos.y;
  if (visitedVillages.has(villageKey)) return;
  const terrain = st.grid?.getTerrain(unit.pos);
  if (terrain !== "village") return;
  visitedVillages.add(villageKey);
  const pool = VILLAGE_REWARDS[st.chapter.id];
  if (!pool || pool.length === 0) return;
  const rewardId = pool[Math.floor(Math.random() * pool.length)];
  const w = WEAPONS[rewardId];
  const i = ITEMS[rewardId];
  if (w) {
    get().addToConvoy(rewardId, "weapon", w.uses);
    get().addLog(t("villageReward", get().lang, { item: w.name }), "#6c6");
  } else if (i) {
    get().addToConvoy(rewardId, "item", i.uses);
    get().addLog(t("villageReward", get().lang, { item: i.name }), "#6c6");
  }
}

// Gold helpers

// Export shop data for UI
export function getShopItems() { return SHOP_ITEMS; }

// Dev hook — exposes the store + a few helpers on window so the headless
// verification scripts can drive chapters + combat without replaying the
// full UI.  Production builds skip this entirely (no leaked references).
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).__game = useGame;
  (window as any).__initChapter = (i: number) => useGame.getState().initChapter(i);
  (window as any).__endTurn = () => useGame.getState().endPlayerTurn();
}
