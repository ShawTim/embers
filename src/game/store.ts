import { create } from "zustand";
import type { RuntimeUnit } from "../types";
import { GameGrid, type Pos, posKey } from "./grid";
import { createUnit, useItemOnUnit, maybeLevelUp } from "../data/unitFactory";
import { resolveCombat, calculateExp, type CombatPreview, previewCombat } from "./combat";
import { decideAIAction, type AIDecision } from "./ai";
import { CHAPTERS } from "../data/gameData";
import type { Lang } from "../i18n";
import { t, unitName, chapterInfo } from "../i18n";
import { getDialogueForTrigger } from "../data/dialogues";

export type Phase = "player" | "enemy" | "combat" | "victory" | "defeat";
export type SelectionMode = "idle" | "moving" | "actionMenu" | "targeting" | "enemyInfo";

interface GameState {
  grid: GameGrid | null;
  chapter: typeof CHAPTERS[0] | null;
  units: RuntimeUnit[];
  phase: Phase;
  turn: number;
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
  setDialogue: (id: string | null) => void;
  clearDialogue: () => void;
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
  useItemAction: (itemId: string) => void;
  equipWeaponAction: (weaponIndex: number) => void;
  convoy: { id: string; type: "weapon" | "item"; uses: number }[];
  addToConvoy: (id: string, type: "weapon" | "item", uses?: number) => void;
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
function queueProjectileForAttack(set: (fn: (s: any) => any) => void, get: () => any, attacker: any, defender: any) {
  const wt = attacker.equippedWeapon?.type;
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

export const useGame = create<GameState>((set, get) => ({
  grid: null, chapter: null, units: [], phase: "player", turn: 1,
  selectedUnit: null, hoveredUnit: null, hoveredTile: null,
  moveRange: new Map(), attackRange: [], selectionMode: "idle", pendingMove: null,
  combatPreview: null, combatLog: [], objectiveText: "", message: null,
  lang: (typeof localStorage !== "undefined" && localStorage.getItem("srpg-lang") === "zh") ? "zh" : "en",
  hitEffects: [], damageNumbers: [], healAuras: [], bloodDecals: [], screenShake: 0, timeScale: 1, slowMoUntil: 0, bossEntrance: null, activeCombat: null, combatPhase: null, lastAction: null,
  activeDialogue: null,
  convoy: [
    { id: "vulnerary", type: "item", uses: 3 },
    { id: "vulnerary", type: "item", uses: 3 },
    { id: "iron_sword", type: "weapon", uses: 45 },
    { id: "iron_lance", type: "weapon", uses: 45 },
    { id: "master_seal", type: "item", uses: 1 },
  ],

  setLang: (lang) => { if (typeof localStorage !== "undefined") localStorage.setItem("srpg-lang", lang); set({ lang }); },

  initChapter: (i) => {
    const ch = CHAPTERS[i]; if (!ch) return;
    const grid = new GameGrid(ch.mapSize.w, ch.mapSize.h, ch.terrain as any);
    for (const dp of ch.deploymentPoints) grid.terrain[dp.y][dp.x] = "deployment";
    const units: RuntimeUnit[] = [];
    const playerIdsByChapter: Record<string, string[]> = {
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
    const playerIds = playerIdsByChapter[ch.id] || ["kael", "lyra", "borin", "serra"];
    for (let j = 0; j < playerIds.length && j < ch.deploymentPoints.length; j++) {
      const u = createUnit(playerIds[j], ch.deploymentPoints[j]); units.push(u); grid.placeUnit(u, ch.deploymentPoints[j]);
    }
    for (const e of ch.enemies) {
      const u = createUnit(e.unitId, e.pos, { aiType: e.aiType, isBoss: e.isBoss }); units.push(u); grid.placeUnit(u, e.pos);
    }
    const preDialogue = getDialogueForTrigger(ch.id, "pre");
    set({ grid, chapter: ch, units, phase: "player", turn: 1, selectedUnit: null, hoveredUnit: null, hoveredTile: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", pendingMove: null, combatPreview: null, combatLog: [], objectiveText: chapterInfo(ch.id, "obj", get().lang), message: null, hitEffects: [], damageNumbers: [], healAuras: [], bloodDecals: [], screenShake: 0, timeScale: 1, slowMoUntil: 0, bossEntrance: null, activeCombat: null, combatPhase: null, activeDialogue: preDialogue, _bossIntroDone: false, pendingProjectiles: [], pendingSlashTrails: [], lastAction: null } as any);
  },

  selectUnit: (u) => {
    const st = get(); if (st.phase !== "player") return;
    if (u.faction !== "player") { set({ hoveredUnit: u }); return; }
    if (u.hasActed || u.isDead) return;
    const g = st.grid!; const mr = g.computeMoveRange(u.pos, u.classDef.baseMove, u.classDef.moveType, u.uid);
    const w = u.equippedWeapon; let at: string[] = [];
    if (w) at = g.computeAttackRange(u.pos, w.minRange, w.maxRange).map(p => posKey(p));
    set({ selectedUnit: u, moveRange: mr, attackRange: at, selectionMode: "moving", hoveredUnit: u });
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
      queueProjectileForAttack(set, get, r.attacker, r.defender);
      await sleep(200);
      if (r.hit) {
        get().addLog(t("logDmg", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang), n: r.damage, crit: r.crit ? t("crit", get().lang) : "", ko: r.lethal ? t("ko", get().lang) : "" }), r.crit ? "#ff6a3a" : "#ffffff");
        get().addHitEffect([r.defender.pos.x, 1.0, r.defender.pos.y], r.crit, r.attacker.equippedWeapon?.type);
        get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], r.damage, { isCrit: r.crit });
        get().triggerShake(r.crit ? 0.7 : 0.25);
        if (r.crit) get().triggerSlowMo(0.25, 280);
      } else { get().addLog(t("logMiss", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang) }), "#888"); get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], 0, { isMiss: true }); }
      setP(pf + "impact", r.attacker.uid, r.defender.uid, ic); await sleep(150);
      setP(pf + "recoil", r.attacker.uid, r.defender.uid, ic); await sleep(350);
      setP(pf + "recovery", r.attacker.uid, r.defender.uid, ic); await sleep(250);
    }
    setP("exit", "", ""); await sleep(300);
    if (target.isDead) { g.removeUnit(target); get().addLog(t("logDefeated", get().lang, { name: unitName(target.def.id, get().lang) }), "#ff3a3a"); get().addBloodDecal([target.pos.x, 0.21, target.pos.y]); target._lastKilledByWeapon = atk.equippedWeapon?.type; }
    if (atk.isDead) { g.removeUnit(atk); get().addLog(t("logDefeated", get().lang, { name: unitName(atk.def.id, get().lang) }), "#ff3a3a"); get().addBloodDecal([atk.pos.x, 0.21, atk.pos.y]); atk._lastKilledByWeapon = target.equippedWeapon?.type; }
    if (!atk.isDead) {
      atk.exp += calculateExp(atk, target, target.isDead);
      const { leveledUp, newLevel } = maybeLevelUp(atk);
      if (leveledUp) get().addLog(t("logLevelUp", get().lang, { name: unitName(atk.def.id, get().lang), n: newLevel }), "#ffe070");
    }
    atk.hasActed = true;
    set({ phase: "player", selectedUnit: null, pendingMove: null, units: [...g.getAllUnits()], activeCombat: null, combatPhase: null, lastAction: { kind: "attack", targetUid: target.uid } });
    checkBattleEnd(set, get);
  },

  waitUnit: () => {
    const st = get(); if (!st.selectedUnit || !st.grid || !st.pendingMove) return;
    const u = st.selectedUnit; st.grid.moveUnit(u, st.pendingMove); u.hasActed = true;
    set({ selectedUnit: null, pendingMove: null, moveRange: new Map(), attackRange: [], selectionMode: "idle", units: [...st.grid.getAllUnits()] });
    checkBattleEnd(set, get);
  },

  healTarget: (target) => {
    const st = get(); if (!st.selectedUnit || !st.grid || !st.pendingMove) return;
    const healer = st.selectedUnit; st.grid.moveUnit(healer, st.pendingMove);
    const healAmt = (healer.equippedWeapon?.might || 10) + healer.stats.mag;
    const actual = Math.min(healAmt, target.maxHp - target.hp);
    target.hp += actual; healer.exp += 20;
    const { leveledUp, newLevel } = maybeLevelUp(healer);
    if (leveledUp) get().addLog(t("logLevelUp", get().lang, { name: unitName(healer.def.id, get().lang), n: newLevel }), "#ffe070");
    healer.hasActed = true;
    get().addLog(t("logHeal", get().lang, { healer: unitName(healer.def.id, get().lang), target: unitName(target.def.id, get().lang), n: actual }), "#3aff3a");
    get().addDamageNumber([target.pos.x, 1.5, target.pos.y], actual, { isHeal: true });
    get().addHealAura([target.pos.x, 0.22, target.pos.y]);
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
        const rounds = resolveCombat(u, target, g.getTerrain(u.pos), g.getTerrain(target.pos));
        set({ activeCombat: { attacker: u, defender: target } });
        const setP = (ph: string, a: string, d: string, ic = false) => set({ combatPhase: { phase: ph, attackerId: a, defenderId: d, isCounter: ic } });
        setP("approach", u.uid, target.uid); await sleep(500);
        for (let i = 0; i < rounds.length; i++) {
          const r = rounds[i]; const ic = i > 0; const pf = ic ? "counter_" : "";
          setP(pf + "windup", r.attacker.uid, r.defender.uid, ic); await sleep(350);
          setP(pf + "strike", r.attacker.uid, r.defender.uid, ic);
          // Per-weapon VFX on the strike frame.
          queueProjectileForAttack(set, get, r.attacker, r.defender);
          await sleep(200);
          if (r.hit) {
            get().addLog(t("logDmg", get().lang, { atk: unitName(r.attacker.def.id, get().lang), def: unitName(r.defender.def.id, get().lang), n: r.damage, crit: r.crit ? t("crit", get().lang) : "", ko: r.lethal ? t("ko", get().lang) : "" }), r.crit ? "#ff6a3a" : "#ff8a5a");
            get().addHitEffect([r.defender.pos.x, 1.0, r.defender.pos.y], r.crit, r.attacker.equippedWeapon?.type);
            get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], r.damage, { isCrit: r.crit });
            get().triggerShake(r.crit ? 0.7 : 0.25);
            if (r.crit) get().triggerSlowMo(0.25, 280);
          } else { get().addDamageNumber([r.defender.pos.x, 1.5, r.defender.pos.y], 0, { isMiss: true }); }
          setP(pf + "impact", r.attacker.uid, r.defender.uid, ic); await sleep(150);
          setP(pf + "recoil", r.attacker.uid, r.defender.uid, ic); await sleep(350);
          setP(pf + "recovery", r.attacker.uid, r.defender.uid, ic); await sleep(250);
        }
        setP("exit", "", ""); await sleep(300);
        if (target.isDead) { g.removeUnit(target); get().addLog(t("logDefeated", get().lang, { name: unitName(target.def.id, get().lang) }), "#ff3a3a"); get().addBloodDecal([target.pos.x, 0.21, target.pos.y]); target._lastKilledByWeapon = u.equippedWeapon?.type; }
        if (u.isDead) { g.removeUnit(u); get().addLog(t("logDefeated", get().lang, { name: unitName(u.def.id, get().lang) }), "#ff3a3a"); get().addBloodDecal([u.pos.x, 0.21, u.pos.y]); u._lastKilledByWeapon = target.equippedWeapon?.type; }
        if (!u.isDead) { u.exp += calculateExp(u, target, target.isDead); maybeLevelUp(u); }
        set({ units: [...g.getAllUnits()], activeCombat: null, combatPhase: null }); await sleep(200);
      } else if (dec.action === "heal" && dec.healTarget) {
        const healAmt = u.equippedWeapon?.might || 10; const actual = Math.min(healAmt, dec.healTarget.maxHp - dec.healTarget.hp);
        dec.healTarget.hp += actual;
        u.exp += 20; maybeLevelUp(u);
        get().addLog(t("logHeal", get().lang, { healer: unitName(u.def.id, get().lang), target: unitName(dec.healTarget.def.id, get().lang), n: actual }), "#3aff8a");
        get().addDamageNumber([dec.healTarget.pos.x, 1.5, dec.healTarget.pos.y], actual, { isHeal: true });
        get().addHealAura([dec.healTarget.pos.x, 0.22, dec.healTarget.pos.y]);
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
  triggerBossEntrance: (name, dur) => set({ bossEntrance: { name, born: performance.now() / 1000, dur } }),
  addLog: (text, color = "#fff") => set(s => ({ combatLog: [...s.combatLog.slice(-20), { text, color }] })),
  setDialogue: (id) => set({ activeDialogue: id }),
  clearDialogue: () => set({ activeDialogue: null }),
  pendingProjectiles: [],
  pendingSlashTrails: [],
  drainProjectiles: () => { const q = get().pendingProjectiles; set({ pendingProjectiles: [] }); return q; },
  drainSlashTrails: () => { const q = get().pendingSlashTrails; set({ pendingSlashTrails: [] }); return q; },
  useItemAction: (itemId) => {
    const st = get(); if (!st.selectedUnit) return;
    const unit = st.selectedUnit;
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
  setLastAction: (kind, targetUid) => set({ lastAction: { kind, targetUid } }),
  clearLastAction: () => set({ lastAction: null }),
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
}));

function checkBattleEnd(set: any, get: any) {
  const s: GameState = get();
  const players = s.units.filter((u: RuntimeUnit) => u.faction === "player" && !u.isDead);
  const enemies = s.units.filter((u: RuntimeUnit) => u.faction === "enemy" && !u.isDead);
  const lord = s.units.find((u: RuntimeUnit) => u.def.isLord);
  if (!players.length || lord?.isDead) { set({ phase: "defeat", message: t("defeat", get().lang) }); return; }
  const ch = s.chapter; if (!ch) return;
  if (ch.objectiveType === "route" && !enemies.length) {
    const vd = getDialogueForTrigger(ch.id, "victory");
    set({ phase: "victory", message: t("victory", get().lang), activeDialogue: vd });
  }
  else if (ch.objectiveType === "boss") {
    // Look up the boss from the grid (which keeps dead bosses removed) AND
    // from any dead-unit reference — but since `g.removeUnit` removes the
    // unit from the grid entirely, we need to track dead bosses separately.
    // Simpler: check the live enemy list for any boss still alive; if no
    // boss is alive at all (i.e. the boss was killed and removed), win.
    const liveBoss = s.units.find((u: RuntimeUnit) => u.isBoss && !u.isDead);
    if (!liveBoss) {
      const bd = getDialogueForTrigger(ch.id, "boss_death");
      const vd = getDialogueForTrigger(ch.id, "victory");
      // Show boss death dialogue first if exists
      if (bd && !s.activeDialogue) { set({ activeDialogue: bd }); return; }
      set({ phase: "victory", message: t("victory", get().lang), activeDialogue: vd });
    }
  }
  else if (ch.objectiveType === "defend") {
    // Win when the turn counter has reached the survival target.
    const need = ch.objectiveTurns ?? 99;
    if (s.turn >= need) {
      const vd = getDialogueForTrigger(ch.id, "victory");
      set({ phase: "victory", message: t("victory", get().lang), activeDialogue: vd });
    }
  }
  else if (ch.objectiveType === "seize" && ch.seizeTile) {
    // Win when any living player unit is standing on the seize tile.
    const stTile = ch.seizeTile;
    const onTile = players.some((u: RuntimeUnit) => u.pos.x === stTile.x && u.pos.y === stTile.y);
    if (onTile) {
      const vd = getDialogueForTrigger(ch.id, "victory");
      set({ phase: "victory", message: t("victory", get().lang), activeDialogue: vd });
    }
  }
}

// Dev hook — exposes the store + a few helpers on window so the headless
// verification scripts can drive chapters + combat without replaying the
// full UI.  Production builds skip this entirely (no leaked references).
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).__game = useGame;
  (window as any).__initChapter = (i: number) => useGame.getState().initChapter(i);
  (window as any).__endTurn = () => useGame.getState().endPlayerTurn();
}
