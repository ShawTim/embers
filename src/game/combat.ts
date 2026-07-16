import type { RuntimeUnit, WeaponDef, TerrainType } from "../types";
import { TERRAIN } from "../data/gameData";

const WT_ADV: Record<string, string> = { sword:"axe", lance:"sword", axe:"lance", light:"dark", dark:"anima", anima:"light" };

export function getWeaponTriangle(a: WeaponDef, d: WeaponDef): number {
  if (a.triangle === "none" || d.triangle === "none") return 0;
  if (WT_ADV[a.triangle] === d.triangle) return 1;
  if (WT_ADV[d.triangle] === a.triangle) return -1;
  return 0;
}

export function getEffectiveness(w: WeaponDef, d: RuntimeUnit): number {
  if (!w.effective) return 1;
  return w.effective.vs.includes(d.classDef.moveType) ? w.effective.multiplier : 1;
}

export function getAttackSpeed(u: RuntimeUnit): number {
  const wt = u.equippedWeapon?.weight || 0;
  return u.stats.spd - Math.max(0, wt - Math.floor(u.stats.str / 5));
}

export function getAttackPower(u: RuntimeUnit): number {
  const w = u.equippedWeapon;
  if (!w) return 0;
  if (w.type === "staff") return 0;
  const isMag = ["fire","thunder","wind","light","dark"].includes(w.type);
  return Math.max(0, (isMag ? u.stats.mag : u.stats.str) + w.might);
}

export function getHitRate(u: RuntimeUnit): number {
  const w = u.equippedWeapon;
  return w ? Math.min(255, w.hit + u.stats.skl * 2 + Math.floor(u.stats.lck / 2)) : 0;
}

export function getAvoid(u: RuntimeUnit): number { return getAttackSpeed(u) * 2 + u.stats.lck; }
export function getCritRate(u: RuntimeUnit): number {
  const w = u.equippedWeapon;
  return w ? Math.max(0, w.crit + Math.floor(u.stats.skl / 2)) : 0;
}
export function getCritAvoid(u: RuntimeUnit): number { return u.stats.lck; }
export function getDefense(u: RuntimeUnit, isMag: boolean): number { return isMag ? u.stats.res : u.stats.def; }

export interface CombatPreview {
  attackerDmg: number; defenderDmg: number; attackerHit: number; defenderHit: number;
  attackerCrit: number; defenderCrit: number; attackerDoubles: boolean; defenderDoubles: boolean;
  willCounter: boolean; weaponTriangle: number; attackerHpAfter: number; defenderHpAfter: number; isLethal: boolean;
}

export function previewCombat(atk: RuntimeUnit, def: RuntimeUnit, atkT: TerrainType, defT: TerrainType): CombatPreview {
  const atkWpn = atk.equippedWeapon!, defWpn = def.equippedWeapon;
  const wt = getWeaponTriangle(atkWpn, defWpn!);
  const effMult = getEffectiveness(atkWpn, def);
  const atkPower = getAttackPower(atk) + wt;
  const isMag = ["fire","thunder","wind","light","dark"].includes(atkWpn.type);
  const defDef = getDefense(def, isMag) + TERRAIN[defT].defBonus;
  const attackerDmg = Math.max(0, Math.floor(atkPower * effMult) - defDef);
  const range = Math.abs(atk.pos.x - def.pos.x) + Math.abs(atk.pos.y - def.pos.y);
  const willCounter = !!defWpn && defWpn.minRange <= range && defWpn.maxRange >= range && !def.isDead;
  let defenderDmg = 0;
  if (willCounter && defWpn) {
    const dWt = getWeaponTriangle(defWpn, atkWpn);
    const dEff = getEffectiveness(defWpn, atk);
    const dPower = getAttackPower(def) + dWt;
    const dIsMag = ["fire","thunder","wind","light","dark"].includes(defWpn.type);
    const atkDef = getDefense(atk, dIsMag) + TERRAIN[atkT].defBonus;
    defenderDmg = Math.max(0, Math.floor(dPower * dEff) - atkDef);
  }
  const attackerHit = Math.max(1, Math.min(100, getHitRate(atk) + wt * 15 - getAvoid(def) - TERRAIN[defT].avoidBonus));
  let defenderHit = 0;
  if (willCounter && defWpn) { const dWt = getWeaponTriangle(defWpn, atkWpn); defenderHit = Math.max(1, Math.min(100, getHitRate(def) + dWt * 15 - getAvoid(atk) - TERRAIN[atkT].avoidBonus)); }
  const attackerCrit = Math.max(0, getCritRate(atk) - getCritAvoid(def));
  const defenderCrit = willCounter ? Math.max(0, getCritRate(def) - getCritAvoid(atk)) : 0;
  const atkAS = getAttackSpeed(atk), defAS = getAttackSpeed(def);
  const attackerDoubles = atkAS >= defAS + 4;
  const defenderDoubles = willCounter && defAS >= atkAS + 4;
  const totalAtkDmg = attackerDmg * (attackerDoubles ? 2 : 1);
  const totalDefDmg = willCounter ? defenderDmg * (defenderDoubles ? 2 : 1) : 0;
  const defenderHpAfter = Math.max(0, def.hp - totalAtkDmg);
  const attackerHpAfter = Math.max(0, atk.hp - totalDefDmg);
  return { attackerDmg, defenderDmg, attackerHit, defenderHit, attackerCrit, defenderCrit, attackerDoubles, defenderDoubles, willCounter, weaponTriangle: wt, attackerHpAfter, defenderHpAfter, isLethal: defenderHpAfter === 0 };
}

export interface CombatRound { attacker: RuntimeUnit; defender: RuntimeUnit; damage: number; hit: boolean; crit: boolean; lethal: boolean; }

export function resolveCombat(atk: RuntimeUnit, def: RuntimeUnit, atkT: TerrainType, defT: TerrainType): CombatRound[] {
  const p = previewCombat(atk, def, atkT, defT);
  const rounds: CombatRound[] = [];
  type Step = { atk: RuntimeUnit; def: RuntimeUnit; hit: number; crit: number; dmg: number };
  const steps: Step[] = [{ atk: atk, def: def, hit: p.attackerHit, crit: p.attackerCrit, dmg: p.attackerDmg }];
  if (p.attackerDoubles) steps.push({ atk: atk, def: def, hit: p.attackerHit, crit: p.attackerCrit, dmg: p.attackerDmg });
  if (p.willCounter && def.hp > 0) {
    steps.push({ atk: def, def: atk, hit: p.defenderHit, crit: p.defenderCrit, dmg: p.defenderDmg });
    if (p.defenderDoubles) steps.push({ atk: def, def: atk, hit: p.defenderHit, crit: p.defenderCrit, dmg: p.defenderDmg });
  }
  for (const s of steps) {
    if (s.def.hp <= 0) break;
    const isHit = Math.random() * 100 <= s.hit;
    const isCrit = isHit && Math.random() * 100 <= s.crit;
    const dmg = isHit ? (isCrit ? s.dmg * 3 : s.dmg) : 0;
    const lethal = dmg >= s.def.hp;
    s.def.hp = Math.max(0, s.def.hp - dmg);
    if (lethal) s.def.isDead = true;
    rounds.push({ attacker: s.atk, defender: s.def, damage: dmg, hit: isHit, crit: isCrit, lethal });
    if (lethal) break;
  }
  return rounds;
}

export function calculateExp(atk: RuntimeUnit, def: RuntimeUnit, killed: boolean): number {
  const ld = def.level - atk.level;
  let exp = killed ? 25 + ld * 3 : 5 + ld;
  if (def.isBoss && killed) exp = Math.max(exp, 100);
  return Math.max(1, Math.min(100, exp));
}
