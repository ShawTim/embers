export type Lang = "en" | "zh";

const STRINGS = {
  gameTitle: { en: "Embers of Aetheria", zh: "艾特利亞之火" },
  subtitle: { en: "A Tactical SRPG", zh: "戰術角色扮演" },
  controls: { en: "Controls", zh: "操作方式" },
  leftClick: { en: "Click / Tap — Select unit or tile", zh: "點擊 — 選擇單位或地塊" },
  rightClick: { en: "Drag — Rotate camera", zh: "拖曳 — 旋轉視角" },
  mouseWheel: { en: "Wheel / Pinch — Zoom", zh: "滾輪 / 捏合 — 縮放" },
  objective: { en: "Objective", zh: "目標" },
  objectiveDesc: { en: "Defeat the bandit leader Garrick", zh: "擊敗強盜首領蓋瑞克" },
  blueHint: { en: "Blue = Your units · Red = Enemies · Gold ★ = Boss", zh: "藍色 = 我方 · 紅色 = 敵方 · 金色 ★ = 首領" },
  startGame: { en: "Start Game", zh: "開始遊戲" },
  turn: { en: "Turn", zh: "回合" },
  yourTurn: { en: "Your Turn", zh: "我方回合" },
  enemyTurn: { en: "Enemy Turn", zh: "敵方回合" },
  combat: { en: "Combat", zh: "戰鬥中" },
  victory: { en: "Victory!", zh: "勝利！" },
  defeat: { en: "Defeat...", zh: "敗北..." },
  ready: { en: "ready", zh: "可行動" },
  enemies: { en: "enemies", zh: "敵人" },
  endTurn: { en: "End Turn", zh: "結束回合" },
  f_player: { en: "ALLY", zh: "我方" },
  f_enemy: { en: "ENEMY", zh: "敵方" },
  f_ally: { en: "FRIEND", zh: "友軍" },
  f_neutral: { en: "NEUTRAL", zh: "中立" },
  plain: { en: "Plain", zh: "平原" },
  forest: { en: "Forest", zh: "森林" },
  mountain: { en: "Mountain", zh: "山地" },
  fort: { en: "Fort", zh: "堡壘" },
  road: { en: "Road", zh: "道路" },
  water: { en: "Water", zh: "淺水" },
  deep_water: { en: "Deep Water", zh: "深水" },
  cliff: { en: "Cliff", zh: "懸崖" },
  sand: { en: "Sand", zh: "沙地" },
  thicket: { en: "Thicket", zh: "密林" },
  floor: { en: "Floor", zh: "地板" },
  wall: { en: "Wall", zh: "城牆" },
  throne: { en: "Throne", zh: "王座" },
  deployment: { en: "Deployment", zh: "部署點" },
  bridge: { en: "Bridge", zh: "橋樑" },
  hp: { en: "HP", zh: "生命" },
  str: { en: "STR", zh: "力量" },
  mag: { en: "MAG", zh: "魔力" },
  skl: { en: "SKL", zh: "技巧" },
  spd: { en: "SPD", zh: "速度" },
  lck: { en: "LCK", zh: "幸運" },
  def: { en: "DEF", zh: "防禦" },
  res: { en: "RES", zh: "魔防" },
  mov: { en: "MOV", zh: "移動" },
  noBonus: { en: "No bonus", zh: "無加成" },
  hoverTile: { en: "Hover a tile", zh: "移動游標到地塊" },
  hoverUnit: { en: "Click or hover a unit", zh: "點擊或移動到單位" },
  c_lord: { en: "Lord", zh: "領主" },
  c_knight: { en: "Knight", zh: "騎士" },
  c_archer: { en: "Archer", zh: "弓箭手" },
  c_mage: { en: "Mage", zh: "法師" },
  c_cleric: { en: "Cleric", zh: "神官" },
  c_mercenary: { en: "Mercenary", zh: "傭兵" },
  c_fighter: { en: "Fighter", zh: "戰士" },
  c_cavalier: { en: "Cavalier", zh: "騎兵" },
  u_kael: { en: "Kael", zh: "凱爾" },
  u_lyra: { en: "Lyra", zh: "萊拉" },
  u_borin: { en: "Borin", zh: "波林" },
  u_serra: { en: "Serra", zh: "瑟拉" },
  u_bandit_sword: { en: "Bandit", zh: "強盜" },
  u_bandit_axe: { en: "Brigand", zh: "暴徒" },
  u_boss_garrick: { en: "Garrick the Cruel", zh: "殘酷的蓋瑞克" },
  u_umbral_mage: { en: "Umbral Acolyte", zh: "暗影信徒" },
  attack: { en: "Attack", zh: "攻擊" },
  heal: { en: "Heal", zh: "治療" },
  wait: { en: "Wait", zh: "待命" },
  cancel: { en: "Cancel", zh: "取消" },
  noWeapon: { en: "No weapon", zh: "無武器" },
  alreadyActed: { en: "Already acted", zh: "已行動" },
  boss: { en: "Boss", zh: "首領" },
  dmg: { en: "DMG", zh: "傷害" },
  hit: { en: "HIT", zh: "命中" },
  crt: { en: "CRT", zh: "必殺" },
  noCounter: { en: "No counter", zh: "無法反擊" },
  advantage: { en: "▲ Weapon Advantage", zh: "▲ 武器優勢" },
  disadvantage: { en: "▼ Weapon Disadvantage", zh: "▼ 武器劣勢" },
  vs: { en: "VS", zh: "對" },
  logDmg: { en: "{atk} → {def}: {n} dmg{crit}{ko}", zh: "{atk} → {def}：{n} 傷害{crit}{ko}" },
  logMiss: { en: "{atk} → {def}: Miss!", zh: "{atk} → {def}：未命中！" },
  logHeal: { en: "{healer} heals {target}: +{n} HP", zh: "{healer} 治療 {target}：+{n} 點生命" },
  logDefeated: { en: "{name} was defeated!", zh: "{name} 被擊敗！" },
  logReinforce: { en: "Reinforcements arrived!", zh: "增援出現！" },
  crit: { en: " CRIT!", zh: " 必殺！" },
  ko: { en: " [KO]", zh: " [擊殺]" },
  ch01_name: { en: "Prologue: Embers in the Night", zh: "序章：暗夜餘燼" },
  ch01_desc: { en: "Lord Kael's estate is attacked by bandits. Defeat the bandit leader.", zh: "凱爾領主的莊園遭到強盜襲擊。擊敗強盜首領。" },
  ch01_obj: { en: "Defeat Garrick", zh: "擊敗蓋瑞克" },
  ch02_name: { en: "Chapter 1: The Forest of Whispers", zh: "第一章：低語之森" },
  ch02_desc: { en: "Pursue the bandits into the corrupted forest.", zh: "追擊強盜進入腐化的森林。" },
  ch02_obj: { en: "Defeat all enemies", zh: "擊敗所有敵人" },
  hintIdle: { en: "Click a blue unit to select — {n} ready", zh: "點擊藍色單位進行選擇 — {n} 個可行動" },
  hintMoving: { en: "Blue = move range · Red = attack range · Click a blue tile", zh: "藍色 = 移動範圍 · 紅色 = 攻擊範圍 · 點擊藍色地塊移動" },
  hintActionMenu: { en: "Choose an action", zh: "選擇行動" },
  hintTargeting: { en: "Hover enemy to preview · Click to attack", zh: "移到敵人上方預覽 · 點擊確認攻擊" },
  hintAllActed: { en: "All units acted — click End Turn", zh: "所有單位已行動 — 點擊結束回合" },
  nextChapter: { en: "Next Chapter", zh: "下一章" },
  playAgain: { en: "Play Again", zh: "再玩一次" },
};

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Lang, params?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  let text = entry[lang] || entry.en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function unitName(defId: string, lang: Lang): string {
  const key = `u_${defId}` as StringKey;
  const result = t(key, lang);
  return result === key ? defId : result;
}

export function className(classId: string, lang: Lang): string {
  const key = `c_${classId}` as StringKey;
  const result = t(key, lang);
  return result === key ? classId : result;
}

export function factionName(faction: string, lang: Lang): string {
  const key = `f_${faction}` as StringKey;
  const result = t(key, lang);
  return result === key ? faction : result;
}

export function chapterInfo(chapterId: string, field: "name" | "desc" | "obj", lang: Lang): string {
  const key = `${chapterId}_${field}` as StringKey;
  const result = t(key, lang);
  return result === key ? "" : result;
}
