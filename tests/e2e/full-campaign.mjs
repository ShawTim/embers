import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { validateFullCampaignRun } from "./full-campaign-validator.mjs";

const EXPECTED_CHAPTERS = Array.from(
  { length: 20 },
  (_, index) => `ch${String(index + 1).padStart(2, "0")}`,
);
const VIEWPORT = { width: 1280, height: 720 };
const MAX_CHAPTERS = Math.min(20, Math.max(1, Number(process.env.E2E_MAX_CHAPTERS || 20)));
const MAX_ATTEMPTS = Math.min(5, Math.max(1, Number(process.env.E2E_MAX_ATTEMPTS || 3)));
const MAX_TURNS = Math.max(5, Number(process.env.E2E_MAX_TURNS || 80));
const TIMING_SCALE = Math.min(1, Math.max(0.01, Number(process.env.E2E_SPEED || 0.04)));
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000/";
const RUN_STAMP = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const OUTPUT_DIR = path.resolve(
  process.env.E2E_OUTPUT_DIR || `/tmp/embers-e2e-${RUN_STAMP}`,
);
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");

const SHOP_PRICES = {
  vulnerary: 150,
  elixir: 800,
  master_seal: 3000,
  iron_sword: 200,
  steel_sword: 500,
  iron_lance: 200,
  steel_lance: 500,
  iron_axe: 200,
  iron_bow: 250,
  fire: 400,
  heal_staff: 400,
  hand_axe: 300,
  javelin: 350,
};

const CLASS_WEAPON_TYPES = {
  lord: ["sword"],
  knight: ["lance"],
  archer: ["bow"],
  mage: ["fire"],
  cleric: ["staff"],
  mercenary: ["sword"],
  fighter: ["axe"],
  cavalier: ["sword", "lance"],
  lord_knight: ["sword"],
  general: ["lance", "axe"],
  sniper: ["bow"],
  sage: ["fire", "staff"],
  bishop: ["staff", "light"],
  hero: ["sword", "axe"],
  warrior: ["axe", "bow"],
  paladin: ["sword", "lance"],
};

function withTimingScale(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.set("e2eSpeed", String(TIMING_SCALE));
  return url.toString();
}

function relativeArtifact(filePath) {
  return path.relative(OUTPUT_DIR, filePath);
}

function screenshotPath(name) {
  return path.join(SCREENSHOT_DIR, name);
}

function getCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function classifyBrowserEvent(text) {
  if (/Automatic fallback to software WebGL has been deprecated/i.test(text)) {
    return "known-headless-webgl-warning";
  }
  if (/GroupMarkerNotSet/i.test(text)) {
    return "known-headless-gpu-warning";
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logProgress(message) {
  console.log(`[full-campaign] ${new Date().toISOString()} ${message}`);
}

function unitSummary(unit) {
  return {
    uid: unit.uid,
    id: unit.id,
    faction: unit.faction,
    classId: unit.classId,
    level: unit.level,
    exp: unit.exp,
    hp: unit.hp,
    maxHp: unit.maxHp,
    isLord: unit.isLord,
    isDead: unit.isDead,
    position: unit.position,
    weapons: unit.weapons,
    equippedWeaponId: unit.equippedWeaponId,
  };
}

async function getSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__game?.getState();
    if (!state) throw new Error("Development game-store hook is unavailable");
    let completedChapters = [];
    try {
      const raw = localStorage.getItem("embers:meta");
      completedChapters = raw ? JSON.parse(raw).completedChapters || [] : [];
    } catch {
      completedChapters = [];
    }
    const units = state.units.map(unit => ({
      uid: unit.uid,
      id: unit.def.id,
      faction: unit.faction,
      classId: unit.classDef.id,
      level: unit.level,
      exp: unit.exp,
      hp: unit.hp,
      maxHp: unit.maxHp,
      isLord: !!unit.def.isLord,
      isDead: unit.isDead,
      hasActed: unit.hasActed,
      position: { ...unit.pos },
      weapons: unit.weapons.map(weapon => ({
        id: weapon.id,
        type: weapon.type,
        uses: weapon.uses,
      })),
      equippedWeaponId: unit.equippedWeapon?.id ?? null,
    }));
    const campaignRoster = Object.fromEntries(
      Object.entries(state.campaignRoster).map(([id, unit]) => [id, {
        uid: unit.uid,
        id: unit.defId,
        classId: unit.classId,
        level: unit.level,
        exp: unit.exp,
        hp: unit.hp,
        maxHp: unit.maxHp,
        isDead: unit.isDead,
        weapons: unit.weapons.map(weapon => ({ ...weapon })),
        equippedWeaponIdx: unit.equippedWeaponIdx,
      }]),
    );
    return {
      timestamp: new Date().toISOString(),
      chapterId: state.chapter?.id ?? null,
      chapterName: state.chapter?.name ?? null,
      objectiveType: state.chapter?.objectiveType ?? null,
      objectiveText: state.objectiveText || state.chapter?.objective || "",
      objectiveTurns: state.chapter?.objectiveTurns ?? null,
      seizeTile: state.chapter?.seizeTile ? { ...state.chapter.seizeTile } : null,
      turn: state.turn,
      phase: state.phase,
      activeDialogue: state.activeDialogue,
      gold: state.gold,
      convoy: state.convoy.map(item => ({ ...item })),
      completedChapters,
      units,
      campaignRoster,
      combatLog: state.combatLog.map(entry => entry.text),
      ui: {
        title: !!document.querySelector(".start-screen"),
        dialogue: !!document.querySelector(".dialogue-overlay"),
        shop: !!document.querySelector(".shop-card"),
        victory: state.phase === "victory" && !!document.querySelector(".big-message"),
        defeat: state.phase === "defeat" && !!document.querySelector(".big-message"),
        outro: !!document.querySelector(".outro-overlay"),
      },
    };
  });
}

function livingPlayers(snapshot) {
  return snapshot.units.filter(unit => unit.faction === "player" && !unit.isDead);
}

function assertLivingLord(snapshot, context) {
  if (snapshot.phase === "defeat") return;
  const lordAlive = livingPlayers(snapshot).some(unit => unit.isLord);
  if (!lordAlive) {
    throw new Error(`${context}: no living lord while phase=${snapshot.phase}`);
  }
}

async function capture(page, name) {
  const filePath = screenshotPath(name);
  await page.screenshot({ path: filePath, fullPage: true });
  return relativeArtifact(filePath);
}

async function dismissCurrentDialogue(page, dialogueSequence) {
  const initial = await getSnapshot(page);
  const dialogueId = initial.activeDialogue;
  if (!dialogueId) return false;
  dialogueSequence.push(dialogueId);

  for (let click = 0; click < 240; click++) {
    const current = await getSnapshot(page);
    if (current.activeDialogue !== dialogueId) return true;
    const overlay = page.locator(".dialogue-overlay");
    if (await overlay.count() === 0) {
      throw new Error(`Dialogue ${dialogueId} has no visible overlay`);
    }
    await overlay.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(8);
  }
  throw new Error(`Dialogue ${dialogueId} did not finish after 240 clicks`);
}

async function dismissPlayerDialogues(page, dialogueSequence) {
  for (let script = 0; script < 20; script++) {
    const state = await getSnapshot(page);
    if (!state.activeDialogue || state.phase !== "player") return;
    await dismissCurrentDialogue(page, dialogueSequence);
  }
  throw new Error("Player-phase dialogue chain exceeded 20 scripts");
}

async function chooseTacticalPlan(page, attempt) {
  return page.evaluate(({ attemptNumber }) => {
    const state = window.__game?.getState();
    if (!state?.grid || state.phase !== "player" || state.activeDialogue) return null;
    const grid = state.grid;
    const units = state.units.filter(unit => unit.faction === "player" && !unit.isDead);
    const enemies = state.units.filter(unit => unit.faction === "enemy" && !unit.isDead);
    const ready = units.filter(unit => !unit.hasActed);
    if (!ready.length) return { kind: "end-turn", rationale: "all players acted" };

    const magicalTypes = new Set(["fire", "thunder", "wind", "light", "dark"]);
    const weaponTypeById = {
      iron_sword: "sword", steel_sword: "sword", silver_sword: "sword",
      slim_sword: "sword", brave_sword: "sword", killing_edge: "sword", rapier: "sword",
      iron_lance: "lance", steel_lance: "lance", silver_lance: "lance",
      slim_lance: "lance", javelin: "lance",
      iron_axe: "axe", steel_axe: "axe", silver_axe: "axe", hand_axe: "axe",
      killer_axe: "axe",
      iron_bow: "bow", steel_bow: "bow", silver_bow: "bow", short_bow: "bow",
      fire: "fire", elfire: "fire", fimbulvetr: "fire",
      lightning: "light", divinus: "light",
      flux: "dark", nosferatu: "dark",
      heal_staff: "staff", mend_staff: "staff", physic_staff: "staff",
    };
    const triangleAdvantage = {
      sword: "axe",
      lance: "sword",
      axe: "lance",
      light: "dark",
      dark: "anima",
      anima: "light",
    };
    const posKey = position => `${position.x},${position.y}`;
    const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const moveCost = (position, moveType) => {
      const terrain = grid.getTerrainDef(position);
      if (moveType === "flying") return 1;
      return terrain.moveOverrides?.[moveType] ?? terrain.moveCost;
    };
    const attackSpeed = unit => {
      const weapon = unit.equippedWeapon;
      return unit.stats.spd - Math.max(0, (weapon?.weight || 0) - Math.floor(unit.stats.str / 5));
    };
    const attackPower = (unit, weapon) => {
      if (!weapon || weapon.type === "staff") return 0;
      return (magicalTypes.has(weapon.type) ? unit.stats.mag : unit.stats.str) + weapon.might;
    };
    const triangle = (attackerWeapon, defenderWeapon) => {
      if (!attackerWeapon || !defenderWeapon) return 0;
      if (attackerWeapon.triangle === "none" || defenderWeapon.triangle === "none") return 0;
      if (triangleAdvantage[attackerWeapon.triangle] === defenderWeapon.triangle) return 1;
      if (triangleAdvantage[defenderWeapon.triangle] === attackerWeapon.triangle) return -1;
      return 0;
    };
    const effectiveness = (weapon, defender) =>
      weapon?.effective?.vs?.includes(defender.classDef.moveType)
        ? weapon.effective.multiplier
        : 1;
    const preview = (attacker, defender, from) => {
      const attackerWeapon = attacker.equippedWeapon;
      const defenderWeapon = defender.equippedWeapon;
      if (!attackerWeapon || attackerWeapon.uses <= 0 || attackerWeapon.type === "staff") {
        return {
          attackerDamage: 0,
          attackerHit: 0,
          counterDamage: 0,
          counterHit: 0,
          willCounter: false,
          lethal: false,
        };
      }
      const defenderTerrain = grid.getTerrainDef(defender.pos);
      const attackerTerrain = grid.getTerrainDef(from);
      const weaponTriangle = triangle(attackerWeapon, defenderWeapon);
      const defenderDefense = magicalTypes.has(attackerWeapon.type)
        ? defender.stats.res
        : defender.stats.def;
      const hit = Math.max(
        1,
        Math.min(
          100,
          attackerWeapon.hit
            + attacker.stats.skl * 2
            + Math.floor(attacker.stats.lck / 2)
            + weaponTriangle * 15
            - (attackSpeed(defender) * 2 + defender.stats.lck)
            - defenderTerrain.avoidBonus,
        ),
      );
      const damage = Math.max(
        0,
        Math.floor(
          (attackPower(attacker, attackerWeapon) + weaponTriangle)
            * effectiveness(attackerWeapon, defender),
        ) - defenderDefense - defenderTerrain.defBonus,
      );
      const attackerDoubles = attackSpeed(attacker) >= attackSpeed(defender) + 4
        && attackerWeapon.uses >= 2;
      const totalDamage = damage * (attackerDoubles ? 2 : 1);
      const range = distance(from, defender.pos);
      const usableDefenderWeapon = defenderWeapon
        && defenderWeapon.uses > 0
        && defenderWeapon.type !== "staff"
        ? defenderWeapon
        : null;
      const willCounter = !!usableDefenderWeapon
        && range >= usableDefenderWeapon.minRange
        && range <= usableDefenderWeapon.maxRange;
      let counterDamage = 0;
      let counterHit = 0;
      if (willCounter) {
        const counterTriangle = triangle(usableDefenderWeapon, attackerWeapon);
        const attackerDefense = magicalTypes.has(usableDefenderWeapon.type)
          ? attacker.stats.res
          : attacker.stats.def;
        counterDamage = Math.max(
          0,
          Math.floor(
            (attackPower(defender, usableDefenderWeapon) + counterTriangle)
              * effectiveness(usableDefenderWeapon, attacker),
          ) - attackerDefense - attackerTerrain.defBonus,
        );
        if (attackSpeed(defender) >= attackSpeed(attacker) + 4 && usableDefenderWeapon.uses >= 2) {
          counterDamage *= 2;
        }
        counterHit = Math.max(
          1,
          Math.min(
            100,
            usableDefenderWeapon.hit
              + defender.stats.skl * 2
              + Math.floor(defender.stats.lck / 2)
              + counterTriangle * 15
              - (attackSpeed(attacker) * 2 + attacker.stats.lck)
              - attackerTerrain.avoidBonus,
          ),
        );
      }
      return {
        attackerDamage: totalDamage,
        attackerHit: hit,
        counterDamage,
        counterHit,
        willCounter,
        lethal: totalDamage >= defender.hp,
      };
    };
    const pathCostCache = new Map();
    const globalPathCost = (unit, start, goal, allowOccupiedGoal = false) => {
      const cacheKey = [
        unit.uid,
        posKey(start),
        posKey(goal),
        allowOccupiedGoal ? "occupied" : "open",
      ].join("|");
      if (pathCostCache.has(cacheKey)) return pathCostCache.get(cacheKey);
      const costs = new Map([[posKey(start), 0]]);
      const queue = [{ position: start, cost: 0 }];
      const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();
        if (current.position.x === goal.x && current.position.y === goal.y) {
          pathCostCache.set(cacheKey, current.cost);
          return current.cost;
        }
        for (const direction of directions) {
          const next = {
            x: current.position.x + direction.x,
            y: current.position.y + direction.y,
          };
          if (!grid.isPassable(next, unit.classDef.moveType)) continue;
          const occupant = grid.getUnitAt(next);
          const isGoal = next.x === goal.x && next.y === goal.y;
          if (
            occupant
            && occupant.uid !== unit.uid
            && occupant.faction === "enemy"
            && !(allowOccupiedGoal && isGoal)
          ) continue;
          const nextCost = current.cost + moveCost(next, unit.classDef.moveType);
          if (nextCost >= (costs.get(posKey(next)) ?? Infinity)) continue;
          costs.set(posKey(next), nextCost);
          queue.push({ position: next, cost: nextCost });
        }
      }
      pathCostCache.set(cacheKey, Infinity);
      return Infinity;
    };
    const potentialMoveDestinations = (unit) => {
      const costs = new Map([[posKey(unit.pos), 0]]);
      const queue = [{ position: unit.pos, cost: 0 }];
      const destinations = [];
      const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();
        destinations.push(current.position);
        for (const direction of directions) {
          const next = {
            x: current.position.x + direction.x,
            y: current.position.y + direction.y,
          };
          if (!grid.isPassable(next, unit.classDef.moveType)) continue;
          const nextCost = current.cost + moveCost(next, unit.classDef.moveType);
          if (nextCost > unit.classDef.baseMove) continue;
          if (nextCost >= (costs.get(posKey(next)) ?? Infinity)) continue;
          costs.set(posKey(next), nextCost);
          queue.push({ position: next, cost: nextCost });
        }
      }
      return destinations;
    };
    const enemyMoveDestinations = new Map(
      enemies.map(enemy => [enemy.uid, potentialMoveDestinations(enemy)]),
    );
    const threatCache = new Map();
    const threatAt = (unit, position, ignoredEnemyUid = null) => {
      const cacheKey = `${unit.uid}|${posKey(position)}|${ignoredEnemyUid || ""}`;
      const cached = threatCache.get(cacheKey);
      if (cached) return cached;
      let expectedDamage = 0;
      let potentialDamage = 0;
      let attackers = 0;
      for (const enemy of enemies) {
        if (enemy.uid === ignoredEnemyUid || !enemy.equippedWeapon || enemy.equippedWeapon.uses <= 0) continue;
        let bestDamage = 0;
        let bestHit = 0;
        for (const from of enemyMoveDestinations.get(enemy.uid) || []) {
          const range = distance(from, position);
          if (range < enemy.equippedWeapon.minRange || range > enemy.equippedWeapon.maxRange) continue;
          const terrain = grid.getTerrainDef(position);
          const magical = magicalTypes.has(enemy.equippedWeapon.type);
          const raw = attackPower(enemy, enemy.equippedWeapon)
            - (magical ? unit.stats.res : unit.stats.def)
            - terrain.defBonus;
          let damage = Math.max(0, raw);
          if (attackSpeed(enemy) >= attackSpeed(unit) + 4 && enemy.equippedWeapon.uses >= 2) {
            damage *= 2;
          }
          const hit = Math.max(
            1,
            Math.min(
              100,
              enemy.equippedWeapon.hit
                + enemy.stats.skl * 2
                + Math.floor(enemy.stats.lck / 2)
                - (attackSpeed(unit) * 2 + unit.stats.lck)
                - terrain.avoidBonus,
            ),
          );
          if (damage * hit > bestDamage * bestHit) {
            bestDamage = damage;
            bestHit = hit;
          }
        }
        if (bestDamage > 0) {
          attackers++;
          potentialDamage += bestDamage;
          expectedDamage += bestDamage * (bestHit / 100);
        }
      }
      const result = { expectedDamage, potentialDamage, attackers };
      threatCache.set(cacheKey, result);
      return result;
    };
    const moveRangeFor = unit => grid.computeMoveRange(
      unit.pos,
      unit.classDef.baseMove,
      unit.classDef.moveType,
      unit.uid,
    );
    const lord = units.find(unit => unit.def.isLord);
    const fighters = units.filter(unit => unit.equippedWeapon?.type !== "staff");
    const medianCoordinate = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    };
    const groupAnchor = fighters.length > 0
      ? {
        x: medianCoordinate(fighters.map(unit => unit.pos.x)),
        y: medianCoordinate(fighters.map(unit => unit.pos.y)),
      }
      : lord?.pos ?? units[0]?.pos;
    const supportAnchor = lord?.pos ?? groupAnchor;
    const closestAllyDistance = (unit, position) => units
      .filter(ally => ally.uid !== unit.uid)
      .reduce((best, ally) => Math.min(best, distance(position, ally.pos)), Infinity);

    for (const unit of ready) {
      const equippedUsable = unit.equippedWeapon && unit.equippedWeapon.uses > 0;
      if (equippedUsable) continue;
      const carriedIndex = unit.weapons.findIndex(weapon => weapon.uses > 0);
      if (carriedIndex >= 0) {
        return {
          kind: "equip",
          unitUid: unit.uid,
          destination: { ...unit.pos },
          equipOrdinal: carriedIndex + 1,
          rationale: "equip carried usable weapon",
        };
      }
      const compatibleConvoy = state.convoy
        .map((entry, index) => ({
          entry,
          index,
          type: weaponTypeById[entry.id],
        }))
        .filter(candidate =>
          candidate.entry.type === "weapon"
          && candidate.type
          && unit.classDef.weapons.includes(candidate.type),
        );
      if (compatibleConvoy.length > 0) {
        return {
          kind: "equip",
          unitUid: unit.uid,
          destination: { ...unit.pos },
          equipOrdinal: unit.weapons.length + 1,
          rationale: `withdraw ${compatibleConvoy[0].entry.id} from convoy`,
        };
      }
    }

    let bestHeal = null;
    for (const healer of ready) {
      const staff = healer.equippedWeapon;
      if (!staff || staff.type !== "staff" || staff.uses <= 0) continue;
      const moveRange = moveRangeFor(healer);
      for (const path of moveRange.values()) {
        const from = path[path.length - 1];
        const threat = threatAt(healer, from);
        for (const target of units) {
          if (target.uid === healer.uid || target.hp >= target.maxHp) continue;
          const range = distance(from, target.pos);
          if (range < staff.minRange || range > staff.maxRange) continue;
          const deficit = target.maxHp - target.hp;
          const emergencyLordHeal = target.def.isLord && target.hp / target.maxHp < 0.35;
          if (threat.attackers > 0 && !emergencyLordHeal) continue;
          if (threat.potentialDamage >= healer.hp) continue;
          const score = deficit * 8
            + (target.def.isLord ? 350 : 0)
            + (target.hp / target.maxHp < 0.35 ? 180 : 0)
            - threat.expectedDamage * 20
            - threat.potentialDamage * 12
            - threat.attackers * 120;
          if (!bestHeal || score > bestHeal.score) {
            bestHeal = {
              kind: "heal",
              unitUid: healer.uid,
              targetUid: target.uid,
              destination: { ...from },
              score,
              rationale: `heal ${target.def.id} deficit=${deficit}`,
            };
          }
        }
      }
    }
    if (bestHeal) return bestHeal;

    const healingItems = state.convoy.filter(item =>
      item.type === "item"
      && item.uses > 0
      && (item.id === "vulnerary" || item.id === "elixir"),
    );
    if (healingItems.length > 0) {
      const wounded = ready
        .filter(unit => {
          const hpRatio = unit.hp / unit.maxHp;
          const isStaffOnly = unit.classDef.weapons.includes("staff")
            && !unit.classDef.weapons.some(type => type !== "staff");
          if (isStaffOnly) return hpRatio < 0.25;
          if (unit.def.isLord) return hpRatio < (attemptNumber > 1 ? 0.65 : 0.5);
          return hpRatio < (attemptNumber > 1 ? 0.45 : 0.35);
        })
        .sort((a, b) => {
          const aScore = (a.def.isLord ? 1000 : 0)
            + (1 - a.hp / a.maxHp) * 100
            + threatAt(a, a.pos).expectedDamage * 10;
          const bScore = (b.def.isLord ? 1000 : 0)
            + (1 - b.hp / b.maxHp) * 100
            + threatAt(b, b.pos).expectedDamage * 10;
          return bScore - aScore;
        });
      if (wounded[0]) {
        const wantsElixir = wounded[0].hp < wounded[0].maxHp * 0.3;
        const itemId = wantsElixir && healingItems.some(item => item.id === "elixir")
          ? "elixir"
          : healingItems.some(item => item.id === "vulnerary")
            ? "vulnerary"
            : "elixir";
        return {
          kind: "item",
          unitUid: wounded[0].uid,
          destination: { ...wounded[0].pos },
          itemId,
          rationale: "self-heal before taking tactical risk",
        };
      }
    }

    const chapter = state.chapter;
    let seizeRunner = null;
    if (chapter?.objectiveType === "seize" && chapter.seizeTile) {
      const candidates = ready
        .filter(unit => unit.equippedWeapon?.type !== "staff")
        .map(unit => ({
          unit,
          cost: globalPathCost(unit, unit.pos, chapter.seizeTile),
          score: unit.classDef.baseMove * 20
            + unit.hp / unit.maxHp * 50
            - (unit.def.isLord ? 60 : 0),
        }))
        .filter(candidate => Number.isFinite(candidate.cost))
        .sort((a, b) => b.score - a.score || a.cost - b.cost);
      seizeRunner = candidates[0]?.unit ?? null;
      if (seizeRunner) {
        const moveRange = moveRangeFor(seizeRunner);
        if (moveRange.has(posKey(chapter.seizeTile))) {
          return {
            kind: "move",
            unitUid: seizeRunner.uid,
            destination: { ...chapter.seizeTile },
            score: 100000,
            rationale: "complete seize objective",
          };
        }
      }
    }

    let bestAttack = null;
    for (const attacker of ready) {
      const weapon = attacker.equippedWeapon;
      if (!weapon || weapon.type === "staff" || weapon.uses <= 0) continue;
      const moveRange = moveRangeFor(attacker);
      for (const path of moveRange.values()) {
        const from = path[path.length - 1];
        for (const target of enemies) {
          const range = distance(from, target.pos);
          if (range < weapon.minRange || range > weapon.maxRange) continue;
          const result = preview(attacker, target, from);
          const expectedAttack = result.attackerDamage * result.attackerHit / 100;
          const expectedCounter = result.willCounter
            ? result.counterDamage * result.counterHit / 100
            : 0;
          const ignored = result.lethal ? target.uid : null;
          const threat = threatAt(attacker, from, ignored);
          const expectedRemaining = attacker.hp - expectedCounter - threat.expectedDamage;
          const worstRemaining = attacker.hp - result.counterDamage - threat.potentialDamage;
          const allyDistance = closestAllyDistance(attacker, from);
          const isFragile = ["archer", "mage", "cleric"].includes(attacker.classDef.id);
          const terrain = grid.getTerrainDef(from);
          let score = expectedAttack * 6
            + result.attackerHit
            + terrain.defBonus * 12
            + terrain.avoidBonus
            - expectedCounter * 10
            - threat.expectedDamage * (attemptNumber > 1 ? 12 : 8)
            - threat.potentialDamage * (attemptNumber > 1 ? 9 : 5)
            - threat.attackers * 18;
          if (result.lethal) score += 240;
          if (target.isBoss) score += result.lethal ? 300 : 80;
          if (target.equippedWeapon?.type === "staff") score += 80;
          if (target.hp / target.maxHp < 0.4) score += 60;
          if (expectedRemaining <= 0) score -= 3000;
          if (worstRemaining <= 0) score -= 3000;
          if (isFragile && worstRemaining < attacker.maxHp * 0.4) score -= 1800;
          const safeRatio = attacker.def.isLord ? 0.5 : 0.25;
          if (expectedRemaining < attacker.maxHp * safeRatio) {
            score -= attacker.def.isLord ? 1000 : 250;
          }
          if (chapter?.objectiveType === "seize" && seizeRunner?.uid === attacker.uid) {
            score -= 120;
          }
          if (attacker.def.isLord) {
            score -= Math.max(0, allyDistance - 3) * 180;
            if (allyDistance > 5 || threat.attackers > 1) score -= 1500;
          }
          if (!bestAttack || score > bestAttack.score) {
            bestAttack = {
              kind: "attack",
              unitUid: attacker.uid,
              targetUid: target.uid,
              destination: { ...from },
              score,
              rationale: `attack ${target.def.id}; expected remaining ${expectedRemaining.toFixed(1)}`,
            };
          }
        }
      }
    }
    if (bestAttack && bestAttack.score > (attemptNumber > 1 ? -40 : -120)) return bestAttack;

    const forts = [];
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const position = { x, y };
        if (grid.getTerrain(position) === "fort" && !grid.getUnitAt(position)) forts.push(position);
      }
    }
    let bestMove = null;
    for (const unit of ready) {
      const moveRange = moveRangeFor(unit);
      let goal = null;
      let allowOccupiedGoal = false;
      const isStaffOnly = unit.classDef.weapons.includes("staff")
        && !unit.classDef.weapons.some(type => type !== "staff");
      const currentLordDistance = lord ? distance(unit.pos, lord.pos) : 0;
      const currentThreat = threatAt(unit, unit.pos);
      if (isStaffOnly && supportAnchor) {
        const supportGoals = [];
        for (let radius = 1; radius <= 2; radius++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
              const position = {
                x: supportAnchor.x + dx,
                y: supportAnchor.y + dy,
              };
              if (!grid.isPassable(position, unit.classDef.moveType)) continue;
              const occupant = grid.getUnitAt(position);
              if (occupant && occupant.uid !== unit.uid) continue;
              supportGoals.push(position);
            }
          }
        }
        goal = supportGoals
          .map(position => ({
            position,
            cost: globalPathCost(unit, unit.pos, position),
            threat: threatAt(unit, position),
          }))
          .filter(candidate => Number.isFinite(candidate.cost))
          .sort((a, b) =>
            a.threat.attackers - b.threat.attackers
            || a.threat.expectedDamage - b.threat.expectedDamage
            || a.cost - b.cost
          )[0]?.position
          ?? unit.pos;
      } else if (chapter?.objectiveType === "seize" && seizeRunner?.uid === unit.uid) {
        goal = chapter.seizeTile;
      } else if (chapter?.objectiveType === "boss") {
        goal = enemies.find(enemy => enemy.isBoss)?.pos ?? enemies[0]?.pos ?? null;
        allowOccupiedGoal = true;
      } else if (chapter?.objectiveType === "defend") {
        goal = forts
          .map(position => ({
            position,
            cost: globalPathCost(unit, unit.pos, position),
          }))
          .sort((a, b) => a.cost - b.cost)[0]?.position
          ?? lord?.pos
          ?? unit.pos;
      } else {
        goal = enemies
          .map(enemy => ({
            position: enemy.pos,
            cost: globalPathCost(unit, unit.pos, enemy.pos, true),
          }))
          .sort((a, b) => a.cost - b.cost)[0]?.position
          ?? chapter?.seizeTile
          ?? unit.pos;
        allowOccupiedGoal = !!enemies.length;
      }
      if (!goal) goal = unit.pos;
      const currentCost = globalPathCost(unit, unit.pos, goal, allowOccupiedGoal);
      for (const path of moveRange.values()) {
        const destination = path[path.length - 1];
        const remainingCost = globalPathCost(unit, destination, goal, allowOccupiedGoal);
        if (!Number.isFinite(remainingCost)) continue;
        const threat = threatAt(unit, destination);
        const terrain = grid.getTerrainDef(destination);
        const progress = Number.isFinite(currentCost) ? currentCost - remainingCost : 0;
        const lordDistance = lord ? distance(destination, lord.pos) : 0;
        const groupDistance = groupAnchor ? distance(destination, groupAnchor) : 0;
        const allyDistance = closestAllyDistance(unit, destination);
        if (
          isStaffOnly
          && (
            (threat.attackers > 1 && threat.expectedDamage >= unit.hp * 0.8)
            || lordDistance > Math.max(3, currentLordDistance)
          )
        ) continue;
        if (
          chapter?.objectiveType !== "defend"
          && !isStaffOnly
          && progress < 0
          && (destination.x !== unit.pos.x || destination.y !== unit.pos.y)
        ) continue;
        let score = progress * (isStaffOnly ? 34 : 26)
          + terrain.defBonus * 15
          + terrain.avoidBonus
          - threat.expectedDamage * (attemptNumber > 1 ? 14 : 8)
          - threat.attackers * (isStaffOnly ? 90 : 24)
          - Math.max(0, groupDistance - (isStaffOnly ? 2 : 4)) * (isStaffOnly ? 24 : 14);
        if (isStaffOnly) {
          score += (currentThreat.expectedDamage - threat.expectedDamage) * 80;
          score += (currentThreat.attackers - threat.attackers) * 220;
          score -= lordDistance * 14;
          if (threat.expectedDamage > 0) score -= 250;
          if (threat.expectedDamage >= unit.hp * 0.5) score -= 2000;
        }
        if (chapter?.objectiveType === "defend") {
          score += terrain.healPercent * 3;
          score -= distance(destination, lord?.pos ?? destination) * 3;
        }
        if (unit.def.isLord) {
          score -= Math.max(0, allyDistance - 3) * 160;
          if (
            allyDistance > 5
            || threat.attackers > 2
            || threat.expectedDamage >= unit.hp * 0.7
          ) continue;
          if (threat.expectedDamage > unit.hp * 0.35) score -= 1000;
        }
        if (destination.x === unit.pos.x && destination.y === unit.pos.y) score -= 8;
        if (!bestMove || score > bestMove.score) {
          bestMove = {
            kind: "move",
            unitUid: unit.uid,
            destination: { ...destination },
            score,
            rationale: `advance toward objective; path remaining=${remainingCost}`,
          };
        }
      }
    }
    if (bestMove) return bestMove;

    const fallback = ready[0];
    return {
      kind: "wait",
      unitUid: fallback.uid,
      destination: { ...fallback.pos },
      rationale: "no legal tactical improvement",
    };
  }, { attemptNumber: attempt });
}

async function selectAndMove(page, plan) {
  await page.evaluate(({ unitUid, destination }) => {
    const store = window.__game;
    if (!store) throw new Error("Development game-store hook is unavailable");
    const unit = store.getState().units.find(candidate => candidate.uid === unitUid);
    if (!unit) throw new Error(`Unit ${unitUid} is unavailable`);
    store.getState().selectUnit(unit);
    store.getState().onTileClick(destination);
  }, plan);
  await page.waitForFunction(() => {
    const state = window.__game?.getState();
    return state?.selectionMode === "actionMenu"
      || state?.phase === "victory"
      || state?.phase === "defeat"
      || state?.phase === "epilogue";
  });
}

async function executePlan(page, plan) {
  const before = await getSnapshot(page);
  if (plan.kind === "end-turn") {
    await page.locator(".btn-end-turn").click();
    await page.waitForFunction(() => {
      const state = window.__game?.getState();
      return state?.phase === "player"
        || state?.phase === "victory"
        || state?.phase === "defeat"
        || state?.phase === "epilogue"
        || !!state?.activeDialogue;
    }, null, { timeout: 30_000 });
    return { before, after: await getSnapshot(page), brokenWeapons: [] };
  }

  await selectAndMove(page, plan);
  const selectedState = await getSnapshot(page);
  if (["victory", "defeat", "epilogue"].includes(selectedState.phase)) {
    return { before, after: selectedState, brokenWeapons: [] };
  }

  const actionMenu = page.locator(".action-menu");
  await actionMenu.waitFor({ state: "visible", timeout: 5_000 });
  let equippedWithoutActing = false;
  if (plan.kind === "attack" || plan.kind === "heal") {
    const label = plan.kind === "attack" ? /Attack|攻擊/ : /Heal|治療/;
    await actionMenu.getByRole("button", { name: label }).click();
    await page.waitForFunction(() => window.__game?.getState().selectionMode === "targeting");
    await page.evaluate(targetUid => {
      const store = window.__game;
      if (!store) throw new Error("Development game-store hook is unavailable");
      const target = store.getState().units.find(candidate => candidate.uid === targetUid);
      if (!target) throw new Error(`Target ${targetUid} is unavailable`);
      store.getState().onTileClick(target.pos);
    }, plan.targetUid);
  } else if (plan.kind === "item") {
    await actionMenu.getByRole("button", { name: /Item|道具/ }).click();
    const preferred = plan.itemId === "elixir"
      ? /Elixir|萬靈藥/
      : /Vulnerary|傷藥/;
    const preferredButton = page.locator(".action-menu").getByRole("button", { name: preferred });
    if (await preferredButton.count()) await preferredButton.first().click();
    else {
      const fallback = page.locator(".action-menu button").filter({ hasNotText: /Cancel|取消/ });
      if (await fallback.count() === 0) throw new Error(`No healing item UI for ${plan.unitUid}`);
      await fallback.first().click();
    }
  } else if (plan.kind === "equip") {
    const equipButton = actionMenu.getByRole("button", { name: /Equip|裝備/ });
    if (await equipButton.count() === 0) {
      await actionMenu.getByRole("button", { name: /Wait|待命/ }).click();
    } else {
      await equipButton.click();
      const equipChoices = page.locator(".action-menu button");
      const count = await equipChoices.count();
      if (plan.equipOrdinal >= count) {
        throw new Error(`Equip choice ${plan.equipOrdinal} is unavailable for ${plan.unitUid}`);
      }
      await equipChoices.nth(plan.equipOrdinal).click();
      equippedWithoutActing = true;
    }
  } else {
    await actionMenu.getByRole("button", { name: /Wait|待命/ }).click();
  }

  if (equippedWithoutActing) {
    await page.waitForTimeout(10);
    return { before, after: await getSnapshot(page), brokenWeapons: [] };
  }

  await page.waitForFunction(() => {
    const state = window.__game?.getState();
    return state?.phase !== "combat"
      && !state?.activeCombat
      && (
        state?.selectionMode === "idle"
        || state?.phase === "victory"
        || state?.phase === "defeat"
        || state?.phase === "epilogue"
        || !!state?.activeDialogue
      );
  }, null, { timeout: 30_000 });
  const after = await getSnapshot(page);
  const brokenWeapons = [];
  for (const unitBefore of before.units) {
    const unitAfter = after.units.find(unit => unit.uid === unitBefore.uid);
    if (!unitAfter) continue;
    for (const weaponBefore of unitBefore.weapons) {
      if (
        weaponBefore.uses <= 2
        && !unitAfter.weapons.some(weapon => weapon.id === weaponBefore.id)
      ) {
        brokenWeapons.push({
          unitId: unitBefore.id,
          weaponId: weaponBefore.id,
          turn: before.turn,
        });
      }
    }
  }
  return { before, after, brokenWeapons };
}

async function saveChapterCheckpointThroughUI(page, chapterId) {
  await page.locator(".btn-save-load").click({ force: true });
  const modal = page.locator(".save-load-card");
  await modal.waitFor({ state: "visible", timeout: 5_000 });
  const firstSlot = modal.locator(".save-load-slot").first();
  await firstSlot.locator(".btn-save-slot").click();
  await page.waitForFunction(expectedChapter => {
    try {
      const raw = localStorage.getItem("embers:meta");
      const meta = raw ? JSON.parse(raw) : null;
      return meta?.slots?.some(slot => slot.id === "slot0" && slot.chapterId === expectedChapter);
    } catch {
      return false;
    }
  }, chapterId, { timeout: 5_000 });
  await modal.locator(".save-load-close").click();
  await modal.waitFor({ state: "hidden", timeout: 5_000 });
}

async function loadAutosaveThroughUI(page, chapterId, dialogueSequence) {
  for (let script = 0; script < 20; script++) {
    const state = await getSnapshot(page);
    if (!state.activeDialogue) break;
    await dismissCurrentDialogue(page, dialogueSequence);
  }
  await page.locator(".btn-save-load").click({ force: true });
  const modal = page.locator(".save-load-card");
  await modal.waitFor({ state: "visible", timeout: 5_000 });
  await modal.locator(".save-load-tabs button").nth(1).click();
  const autosave = modal.locator(".save-load-autosave button");
  if (await autosave.count() === 0) throw new Error("No autosave is available for retry");
  await autosave.click();
  await page.waitForFunction(expectedChapter => {
    const state = window.__game?.getState();
    const ready = state?.units.filter(unit =>
      unit.faction === "player" && !unit.isDead && !unit.hasActed,
    ).length ?? 0;
    return state?.chapter?.id === expectedChapter
      && state.phase === "player"
      && ready > 0
      && state.units.some(unit => unit.def.isLord && !unit.isDead);
  }, chapterId, { timeout: 8_000 });
}

async function loadChapterCheckpointThroughUI(page, chapterId, dialogueSequence) {
  for (let script = 0; script < 20; script++) {
    const state = await getSnapshot(page);
    if (!state.activeDialogue) break;
    await dismissCurrentDialogue(page, dialogueSequence);
  }
  await page.locator(".btn-save-load").click({ force: true });
  const modal = page.locator(".save-load-card");
  await modal.waitFor({ state: "visible", timeout: 5_000 });
  await modal.locator(".save-load-tabs button").nth(1).click();
  const firstSlot = modal.locator(".save-load-slot").first();
  const loadButton = firstSlot.locator(".btn-load-slot");
  if (await loadButton.isDisabled()) {
    throw new Error(`Manual chapter checkpoint for ${chapterId} is unavailable`);
  }
  await loadButton.click();
  await page.waitForFunction(expectedChapter => {
    const state = window.__game?.getState();
    const ready = state?.units.filter(unit =>
      unit.faction === "player" && !unit.isDead && !unit.hasActed,
    ).length ?? 0;
    return state?.chapter?.id === expectedChapter
      && state.phase === "player"
      && ready > 0
      && state.units.some(unit => unit.def.isLord && !unit.isDead);
  }, chapterId, { timeout: 8_000 });
}

async function playAttempt(page, chapterRecord, attemptNumber) {
  const startedAt = Date.now();
  const attemptStart = await getSnapshot(page);
  const detail = {
    attempt: attemptNumber,
    status: "incomplete",
    startTurn: attemptStart.turn,
    endTurn: null,
    casualties: [],
    retryReason: null,
    actions: [],
    turnSnapshots: [],
    brokenWeapons: [],
    screenshots: [],
    error: null,
  };
  let lastRecordedTurn = null;
  let actionCount = 0;
  let equipActionsWithoutTurnProgress = 0;
  logProgress(`${chapterRecord.id} attempt ${attemptNumber} started`);

  while (true) {
    const state = await getSnapshot(page);
    if (state.chapterId !== chapterRecord.id) {
      throw new Error(`Expected ${chapterRecord.id}, found ${state.chapterId}`);
    }
    if (state.phase === "victory") {
      detail.status = "victory";
      detail.endTurn = state.turn;
      detail.casualties = deathsBetween(attemptStart, state);
      break;
    }
    if (state.phase === "defeat") {
      detail.status = "defeat";
      detail.endTurn = state.turn;
      const screenshot = await capture(
        page,
        `${chapterRecord.id}_defeat_attempt_${attemptNumber}.png`,
      );
      detail.screenshots.push(screenshot);
      break;
    }
    if (state.phase === "epilogue") {
      detail.status = "victory";
      detail.endTurn = state.turn;
      detail.casualties = deathsBetween(attemptStart, state);
      break;
    }
    const currentCasualties = deathsBetween(attemptStart, state);
    const criticalCasualty = victoryRetryReason(
      { casualties: currentCasualties },
      attemptStart.units.filter(unit => unit.faction === "player"),
    );
    if (criticalCasualty) {
      detail.status = "critical-casualty";
      detail.endTurn = state.turn;
      detail.casualties = currentCasualties;
      detail.retryReason = criticalCasualty;
      detail.screenshots.push(await capture(
        page,
        `${chapterRecord.id}_critical_casualty_attempt_${attemptNumber}.png`,
      ));
      break;
    }
    assertLivingLord(state, `${chapterRecord.id} attempt ${attemptNumber}`);
    if (state.turn > MAX_TURNS) {
      throw new Error(`${chapterRecord.id} exceeded ${MAX_TURNS} store turns`);
    }
    if (state.activeDialogue) {
      await dismissCurrentDialogue(page, chapterRecord.dialogueSequence);
      continue;
    }
    if (lastRecordedTurn !== state.turn) {
      detail.turnSnapshots.push({
        turn: state.turn,
        playerAlive: livingPlayers(state).length,
        enemyAlive: state.units.filter(unit => unit.faction === "enemy" && !unit.isDead).length,
        lordHp: livingPlayers(state).find(unit => unit.isLord)?.hp ?? null,
        gold: state.gold,
      });
      logProgress(
        `${chapterRecord.id} attempt ${attemptNumber} turn ${state.turn}: `
        + `${livingPlayers(state).length} players, `
        + `${state.units.filter(unit => unit.faction === "enemy" && !unit.isDead).length} enemies`,
      );
      lastRecordedTurn = state.turn;
      equipActionsWithoutTurnProgress = 0;
      if (state.turn > 1 && state.turn % 5 === 0) {
        detail.screenshots.push(await capture(
          page,
          `${chapterRecord.id}_turn_${String(state.turn).padStart(2, "0")}.png`,
        ));
      }
    }

    const plan = await chooseTacticalPlan(page, attemptNumber);
    if (!plan) {
      await page.waitForTimeout(10);
      continue;
    }
    if (actionCount++ > 800) {
      throw new Error(`${chapterRecord.id} exceeded 800 tactical actions`);
    }
    logProgress(
      `${chapterRecord.id} attempt ${attemptNumber} turn ${state.turn}: `
      + `${plan.kind}${plan.unitUid ? ` ${plan.unitUid}` : ""}`
      + `${plan.targetUid ? ` -> ${plan.targetUid}` : ""}; ${plan.rationale}`,
    );
    const result = await executePlan(page, plan);
    detail.actions.push({
      turn: result.before.turn,
      kind: plan.kind,
      unitId: result.before.units.find(unit => unit.uid === plan.unitUid)?.id ?? null,
      targetId: result.before.units.find(unit => unit.uid === plan.targetUid)?.id ?? null,
      destination: plan.destination ?? null,
      rationale: plan.rationale,
    });
    detail.brokenWeapons.push(...result.brokenWeapons);
    if (plan.kind === "equip") {
      equipActionsWithoutTurnProgress++;
      if (equipActionsWithoutTurnProgress > 12) {
        throw new Error(`${chapterRecord.id} is stuck repeatedly equipping weapons`);
      }
    }
  }

  detail.wallMs = Date.now() - startedAt;
  logProgress(
    `${chapterRecord.id} attempt ${attemptNumber} ${detail.status} `
    + `on turn ${detail.endTurn} in ${(detail.wallMs / 1000).toFixed(1)}s`
    + `${detail.casualties.length ? `; casualties=${detail.casualties.join(",")}` : ""}`,
  );
  return detail;
}

function planShopPurchases(snapshot) {
  const totalUses = new Map();
  for (const unit of livingPlayers(snapshot)) {
    for (const weapon of unit.weapons) {
      totalUses.set(weapon.type, (totalUses.get(weapon.type) || 0) + weapon.uses);
    }
  }
  const convoyTypeById = {
    iron_sword: "sword", steel_sword: "sword", silver_sword: "sword",
    iron_lance: "lance", steel_lance: "lance", silver_lance: "lance", javelin: "lance",
    iron_axe: "axe", steel_axe: "axe", silver_axe: "axe", hand_axe: "axe",
    iron_bow: "bow", steel_bow: "bow", silver_bow: "bow",
    fire: "fire", elfire: "fire", fimbulvetr: "fire",
    heal_staff: "staff", mend_staff: "staff", physic_staff: "staff",
  };
  for (const item of snapshot.convoy) {
    const type = convoyTypeById[item.id];
    if (type) totalUses.set(type, (totalUses.get(type) || 0) + item.uses);
  }
  const requiredTypes = new Set(
    livingPlayers(snapshot).flatMap(unit =>
      unit.weapons.length > 0
        ? unit.weapons.map(weapon => weapon.type)
        : CLASS_WEAPON_TYPES[unit.classId] || [],
    ),
  );
  const purchases = [];
  const eligiblePromotion = livingPlayers(snapshot).some(unit =>
    unit.level >= 10 && ![
      "lord_knight", "general", "sniper", "sage",
      "bishop", "hero", "warrior", "paladin",
    ].includes(unit.classId),
  );
  const hasSeal = snapshot.convoy.some(item => item.id === "master_seal" && item.uses > 0);
  if (eligiblePromotion && !hasSeal) purchases.push("master_seal");
  const basics = {
    sword: "iron_sword",
    lance: "iron_lance",
    axe: "iron_axe",
    bow: "iron_bow",
    fire: "fire",
    staff: "heal_staff",
  };
  for (const type of requiredTypes) {
    if ((totalUses.get(type) || 0) < (type === "staff" ? 25 : 35) && basics[type]) {
      purchases.push(basics[type]);
    }
  }
  const healingItems = snapshot.convoy.filter(item =>
    item.type === "item" && (item.id === "vulnerary" || item.id === "elixir"),
  ).length;
  if (healingItems < 2) purchases.push("vulnerary");
  return [...new Set(purchases)].slice(0, 4);
}

async function useVictoryShop(page, chapterRecord) {
  const before = await getSnapshot(page);
  const desired = planShopPurchases(before);
  if (!desired.length || before.chapterId === "ch20") return;
  const openShop = page.locator(".victory-shop-btn");
  if (await openShop.count() === 0) throw new Error(`${before.chapterId} has no Victory Shop button`);
  await openShop.click();
  const shop = page.locator(".shop-card");
  await shop.waitFor({ state: "visible", timeout: 5_000 });

  for (const itemId of desired) {
    const current = await getSnapshot(page);
    const price = SHOP_PRICES[itemId];
    if (!price || current.gold < price) continue;
    const card = shop.locator(`[data-shop-item="${itemId}"]`);
    if (await card.count() === 0) continue;
    const convoyBefore = current.convoy.filter(item => item.id === itemId).length;
    await card.locator(".shop-buy-btn").click();
    await page.waitForFunction(({ id, gold, count }) => {
      const state = window.__game?.getState();
      return state?.gold < gold
        && state.convoy.filter(item => item.id === id).length > count;
    }, { id: itemId, gold: current.gold, count: convoyBefore });
    const after = await getSnapshot(page);
    chapterRecord.purchases.push({
      itemId,
      price,
      goldBefore: current.gold,
      goldAfter: after.gold,
    });
  }
  await shop.locator(".shop-close").click();
}

async function promoteEligibleUnit(page, chapterRecord) {
  const trigger = page.locator(".promo-trigger button");
  if (await trigger.count() === 0) return;
  const before = await getSnapshot(page);
  await trigger.click();
  const panel = page.locator(".promo-panel");
  await panel.waitFor({ state: "visible", timeout: 5_000 });
  let buttons = panel.locator(".promo-confirm-btn");
  if (await buttons.count() > 1) {
    await buttons.first().click();
    await page.waitForTimeout(20);
    buttons = page.locator(".promo-panel .promo-confirm-btn");
  }
  if (await buttons.count() === 0) throw new Error("Promotion panel has no confirmation button");
  await buttons.last().click();
  await panel.waitFor({ state: "hidden", timeout: 5_000 });
  const after = await getSnapshot(page);
  for (const unitBefore of before.units) {
    const unitAfter = after.units.find(unit => unit.uid === unitBefore.uid);
    if (unitAfter && unitAfter.classId !== unitBefore.classId) {
      chapterRecord.promotions.push({
        unitId: unitBefore.id,
        from: unitBefore.classId,
        to: unitAfter.classId,
        level: unitAfter.level,
      });
    }
  }
}

function chapterProgression(start, end) {
  const changes = [];
  for (const unitStart of start.units.filter(unit => unit.faction === "player")) {
    const unitEnd = end.units.find(unit => unit.uid === unitStart.uid);
    const rosterEnd = end.campaignRoster[unitStart.id];
    if (!unitEnd && !rosterEnd) continue;
    const final = unitEnd || rosterEnd;
    if (
      final.level !== unitStart.level
      || final.exp !== unitStart.exp
      || final.classId !== unitStart.classId
    ) {
      changes.push({
        unitId: unitStart.id,
        levelBefore: unitStart.level,
        levelAfter: final.level,
        expBefore: unitStart.exp,
        expAfter: final.exp,
        classBefore: unitStart.classId,
        classAfter: final.classId,
      });
    }
  }
  return changes;
}

function deathsBetween(start, end) {
  return start.units
    .filter(unit => unit.faction === "player")
    .filter(unit => end.campaignRoster[unit.id]?.isDead)
    .map(unit => unit.id);
}

function victoryRetryReason(detail, startRoster) {
  if (!detail.casualties?.length) return null;
  const startById = new Map(startRoster.map(unit => [unit.id, unit]));
  const healerDied = detail.casualties.some(id => {
    const unit = startById.get(id);
    return unit?.classId === "cleric"
      || unit?.classId === "bishop"
      || unit?.weapons.some(weapon => weapon.type === "staff");
  });
  if (healerDied) return `critical healer casualty: ${detail.casualties.join(", ")}`;
  if (startRoster.length <= 4) {
    return `early-campaign roster casualty: ${detail.casualties.join(", ")}`;
  }
  if (detail.casualties.length > 1) {
    return `multiple player casualties: ${detail.casualties.join(", ")}`;
  }
  return null;
}

async function runChapter(page, chapterIndex) {
  const expectedId = EXPECTED_CHAPTERS[chapterIndex];
  const initial = await getSnapshot(page);
  if (initial.chapterId !== expectedId) {
    throw new Error(`Expected ${expectedId}, found ${initial.chapterId}`);
  }
  assertLivingLord(initial, `${expectedId} start`);
  const chapterRecord = {
    index: chapterIndex,
    id: expectedId,
    name: initial.chapterName,
    objectiveType: initial.objectiveType,
    objectiveText: initial.objectiveText,
    attempts: 0,
    status: "incomplete",
    startTurn: initial.turn,
    endTurn: null,
    startRoster: initial.units.filter(unit => unit.faction === "player").map(unitSummary),
    endRoster: [],
    deaths: [],
    levelChanges: [],
    promotions: [],
    goldBefore: initial.gold,
    goldAfter: null,
    convoyBefore: initial.convoy,
    convoyAfter: [],
    purchases: [],
    brokenWeapons: [],
    dialogueSequence: [],
    screenshots: [],
    errors: [],
    attemptDetails: [],
    manualCheckpoint: false,
    lordAlive: true,
  };
  activeChapterRecord = chapterRecord;
  logProgress(`${expectedId} ${initial.chapterName} started (${initial.objectiveType})`);

  if (initial.activeDialogue || await page.locator(".chapter-intro-card").count()) {
    chapterRecord.screenshots.push(await capture(page, `${expectedId}_intro.png`));
  }
  await dismissPlayerDialogues(page, chapterRecord.dialogueSequence);
  chapterRecord.screenshots.push(await capture(page, `${expectedId}_start.png`));
  await saveChapterCheckpointThroughUI(page, expectedId);
  chapterRecord.manualCheckpoint = true;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    chapterRecord.attempts++;
    const detail = await playAttempt(page, chapterRecord, attempt);
    chapterRecord.attemptDetails.push(detail);
    chapterRecord.brokenWeapons.push(...detail.brokenWeapons);
    if (detail.status === "victory") {
      const retryReason = victoryRetryReason(detail, chapterRecord.startRoster);
      if (retryReason && attempt < MAX_ATTEMPTS) {
        detail.status = "victory-retry";
        detail.retryReason = retryReason;
        logProgress(`${expectedId} retrying from manual checkpoint: ${retryReason}`);
        await loadChapterCheckpointThroughUI(page, expectedId, chapterRecord.dialogueSequence);
        continue;
      }
      chapterRecord.status = "victory";
      break;
    }
    if (attempt < MAX_ATTEMPTS) {
      if (detail.status === "critical-casualty") {
        logProgress(`${expectedId} retrying from manual checkpoint: ${detail.retryReason}`);
        await loadChapterCheckpointThroughUI(page, expectedId, chapterRecord.dialogueSequence);
      } else {
        logProgress(`${expectedId} retrying from autosave after ${detail.status}`);
        await loadAutosaveThroughUI(page, expectedId, chapterRecord.dialogueSequence);
      }
    }
  }

  let end = await getSnapshot(page);
  chapterRecord.endTurn = end.turn;
  chapterRecord.lordAlive = livingPlayers(end).some(unit => unit.isLord);
  if (chapterRecord.status !== "victory") {
    chapterRecord.status = "defeat";
    chapterRecord.errors.push(`${expectedId} failed after ${chapterRecord.attempts} attempts`);
    chapterRecord.endRoster = end.units.filter(unit => unit.faction === "player").map(unitSummary);
    chapterRecord.goldAfter = end.gold;
    chapterRecord.convoyAfter = end.convoy;
    return chapterRecord;
  }

  assertLivingLord(end, `${expectedId} victory`);
  chapterRecord.screenshots.push(await capture(page, `${expectedId}_victory.png`));
  while (end.activeDialogue && end.phase === "victory") {
    await dismissCurrentDialogue(page, chapterRecord.dialogueSequence);
    end = await getSnapshot(page);
  }

  if (expectedId === "ch20") {
    if (end.phase !== "epilogue") {
      throw new Error(`ch20 dialogue chain ended in ${end.phase}, expected epilogue`);
    }
  } else {
    await useVictoryShop(page, chapterRecord);
    await promoteEligibleUnit(page, chapterRecord);
    end = await getSnapshot(page);
  }

  chapterRecord.endRoster = end.units.filter(unit => unit.faction === "player").map(unitSummary);
  chapterRecord.deaths = deathsBetween(initial, end);
  chapterRecord.levelChanges = chapterProgression(initial, end);
  chapterRecord.goldAfter = end.gold;
  chapterRecord.convoyAfter = end.convoy;
  chapterRecord.lordAlive = livingPlayers(end).some(unit => unit.isLord);
  return chapterRecord;
}

function renderReport(run) {
  const rows = run.chapters.map((chapter, index) => {
    const attempts = chapter.attempts ?? 0;
    const endTurn = chapter.endTurn ?? "—";
    const deaths = chapter.deaths?.join(", ") || "—";
    const promotions = chapter.promotions?.map(item => `${item.unitId}:${item.to}`).join(", ") || "—";
    return `| ${index + 1} | ${chapter.id} | ${chapter.objectiveType || "—"} | ${chapter.status} | ${attempts} | ${endTurn} | ${deaths} | ${promotions} |`;
  }).join("\n");
  const progression = run.chapters
    .flatMap(chapter => chapter.levelChanges?.map(change =>
      `- ${chapter.id}: ${change.unitId} Lv${change.levelBefore} ${change.expBefore}EXP → Lv${change.levelAfter} ${change.expAfter}EXP (${change.classBefore} → ${change.classAfter})`,
    ) || [])
    .join("\n") || "- No recorded level or class changes.";
  const economy = run.chapters.map(chapter =>
    `- ${chapter.id}: ${chapter.goldBefore ?? "?"}G → ${chapter.goldAfter ?? "?"}G; purchases: ${
      chapter.purchases?.map(item => `${item.itemId} ${item.price}G`).join(", ") || "none"
    }; broken: ${
      chapter.brokenWeapons?.map(item => `${item.unitId}/${item.weaponId}`).join(", ") || "none"
    }`,
  ).join("\n");
  const dialogues = run.chapters.map(chapter =>
    `- ${chapter.id}: ${chapter.dialogueSequence?.join(" → ") || "none"}`,
  ).join("\n");
  const validation = run.validation?.errors?.length
    ? run.validation.errors.map(error => `- ${error}`).join("\n")
    : "- Artifact validation passed.";
  return `# Embers — full-campaign E2E report

## Executive Result

- **Status:** \`${run.status}\`
- **Started:** ${run.metadata.startedAt}
- **Finished:** ${run.metadata.finishedAt || "in progress"}
- **Commit:** \`${run.metadata.commit}\`
- **Last completed chapter:** ${run.lastCompletedChapter || "none"}
- **Reached epilogue:** ${run.ending.reachedEpilogue}
- **Returned to title:** ${run.ending.returnedToTitle}
- **Browser events:** ${run.browserEvents.length}

## Chapter Results

| # | Chapter | Objective | Result | Attempts | End turn | Deaths | Promotions |
|---|---|---|---|---:|---:|---|---|
${rows}

## Campaign Progression

${progression}

## Economy and Durability

${economy}

## Dialogue and Ending

${dialogues}

## Bugs and Validation

${validation}
${run.error ? `\n### Fatal error\n\n\`\`\`text\n${run.error}\n\`\`\`\n` : ""}

## Balance Observations

- Tactical outcomes in this report are automated-player results, not a claim
  that the same chapter is equally difficult for a human player.
- Review raw turns, deaths, healing, and retry counts before changing balance.

## Artifacts

- \`${path.join(OUTPUT_DIR, "run.json")}\`
- \`${path.join(OUTPUT_DIR, "browser-errors.log")}\`
- \`${SCREENSHOT_DIR}\`
`;
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const run = {
  status: "running",
  metadata: {
    commit: getCommit(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    baseUrl: withTimingScale(BASE_URL),
    browser: "chromium",
    viewport: VIEWPORT,
    timingScale: TIMING_SCALE,
    maxChapters: MAX_CHAPTERS,
    maxAttempts: MAX_ATTEMPTS,
    maxTurns: MAX_TURNS,
    commands: [
      "npm test",
      "npm run build",
      "npm run test:e2e:campaign",
      "npm run test:e2e:final",
      "npm run test:e2e:full",
    ],
  },
  title: {
    visibleBeforeStart: false,
    screenshot: null,
  },
  chapters: [],
  lastCompletedChapter: null,
  ending: {
    reachedEpilogue: false,
    returnedToTitle: false,
    epilogueScreenshot: null,
    titleScreenshot: null,
  },
  browserEvents: [],
  validation: {
    errors: [],
  },
  error: null,
};

let activeChapterRecord = null;
let browser;
try {
  browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--use-gl=swiftshader"],
  });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.on("pageerror", error => {
    run.browserEvents.push({
      kind: "pageerror",
      text: error.message,
      timestamp: new Date().toISOString(),
      classification: classifyBrowserEvent(error.message),
    });
  });
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    run.browserEvents.push({
      kind: "console-error",
      text,
      timestamp: new Date().toISOString(),
      classification: classifyBrowserEvent(text),
    });
  });

  await page.goto(withTimingScale(BASE_URL), { waitUntil: "domcontentloaded" });
  const startButton = page.getByRole("button", { name: /Start Game|開始遊戲/ });
  await startButton.waitFor({ state: "visible", timeout: 45_000 });
  const preStart = await getSnapshot(page);
  run.title.visibleBeforeStart = preStart.ui.title;
  if (!preStart.ui.title || preStart.chapterId || preStart.ui.dialogue) {
    throw new Error(`Invalid title state: ${JSON.stringify(preStart.ui)}`);
  }
  run.title.screenshot = await capture(page, "00_title.png");
  await startButton.click();
  await page.waitForFunction(() => window.__game?.getState().chapter?.id === "ch01", null, {
    timeout: 10_000,
  });

  for (let chapterIndex = 0; chapterIndex < MAX_CHAPTERS; chapterIndex++) {
    const chapterRecord = await runChapter(page, chapterIndex);
    run.chapters.push(chapterRecord);
    activeChapterRecord = null;
    if (chapterRecord.status !== "victory") {
      throw new Error(`${chapterRecord.id} did not reach victory`);
    }
    run.lastCompletedChapter = chapterRecord.id;

    if (chapterIndex === MAX_CHAPTERS - 1) {
      if (MAX_CHAPTERS === 20) {
        const endingState = await getSnapshot(page);
        if (endingState.phase !== "epilogue") {
          throw new Error(`Expected epilogue after ch20, found ${endingState.phase}`);
        }
        run.ending.reachedEpilogue = true;
        run.ending.epilogueScreenshot = await capture(page, "ch20_epilogue.png");
        const returnButton = page.locator(".outro-btn-primary");
        await returnButton.waitFor({ state: "visible", timeout: 5_000 });
        await returnButton.click();
        await page.waitForFunction(() => {
          const state = window.__game?.getState();
          return !!document.querySelector(".start-screen")
            && state?.chapter === null
            && state?.grid === null;
        });
        run.ending.returnedToTitle = true;
        run.ending.titleScreenshot = await capture(page, "99_return_to_title.png");
      }
      break;
    }

    const nextButton = page.getByRole("button", { name: /Next Chapter|下一章/ });
    await nextButton.waitFor({ state: "visible", timeout: 5_000 });
    await nextButton.click();
    const nextId = EXPECTED_CHAPTERS[chapterIndex + 1];
    await page.waitForFunction(expectedId => {
      const state = window.__game?.getState();
      return state?.chapter?.id === expectedId && state.phase === "player";
    }, nextId, { timeout: 8_000 });
    const transitioned = await getSnapshot(page);
    assertLivingLord(transitioned, `${nextId} transition`);
  }

  run.status = MAX_CHAPTERS === 20 ? "passed" : "limited-pass";
} catch (error) {
  run.status = "failed-incomplete";
  run.error = error instanceof Error ? error.stack || error.message : String(error);
} finally {
  if (browser) await browser.close();
  if (
    activeChapterRecord
    && !run.chapters.some(chapter => chapter.id === activeChapterRecord.id)
  ) {
    run.chapters.push(activeChapterRecord);
  }
  run.metadata.finishedAt = new Date().toISOString();
  const browserLog = run.browserEvents.length
    ? run.browserEvents.map(event =>
      `[${event.timestamp}] ${event.kind} classification=${event.classification || "UNCLASSIFIED"}\n${event.text}`,
    ).join("\n\n")
    : "No browser errors captured.\n";
  writeFileSync(path.join(OUTPUT_DIR, "browser-errors.log"), browserLog);
  writeFileSync(path.join(OUTPUT_DIR, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "REPORT.md"), renderReport(run));

  run.validation.errors = validateFullCampaignRun(run, OUTPUT_DIR);
  if (run.validation.errors.length > 0 && run.status !== "failed-incomplete") {
    run.status = "failed-incomplete";
    run.error = `Artifact validation failed:\n${run.validation.errors.join("\n")}`;
  }
  writeFileSync(path.join(OUTPUT_DIR, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "REPORT.md"), renderReport(run));
}

console.log(`Full-campaign E2E status: ${run.status}`);
console.log(`Artifacts: ${OUTPUT_DIR}`);
if (run.validation.errors.length > 0) {
  console.error(run.validation.errors.map(error => `- ${error}`).join("\n"));
}
if (run.status === "failed-incomplete") process.exitCode = 1;
