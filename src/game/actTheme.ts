// Per-act visual theme.  Drives:
//   - HUD accent colors (turn badge border, objective color, big-message tint)
//   - Victory / defeat banner color
//   - Loading screen background tint
//   - Chapter intro card color
//   - Optional envmap tint hint (chapter-specific config still wins)
//
// The chapter id drives which act applies; chapters in the same act share
// a base look, but the envmap (in shared/EnvMap.ts) is still per-chapter
// for weather / time-of-day variation.

export type ActId = "prologue" | "act1" | "act2" | "act3" | "act4";

export interface ActTheme {
  id: ActId;
  /** Chapter ids that belong to this act. */
  chapters: string[];
  /** Display label (English) */
  label: string;
  /** Display label (Chinese) */
  labelZh: string;
  /** Roman numeral for the chapter intro card (I, II, III, IV) */
  numeral: string;
  /** Primary accent color for HUD elements, banners, big-messages. */
  accent: string;
  /** Secondary color (gradient stops, dividers). */
  secondary: string;
  /** Subtle background tint applied to the loading screen. */
  bgTint: string;
  /** Glow / shadow color used on title text. */
  glow: string;
  /** Top-bar gradient stop. */
  topBar: string;
  /** "tone" tag passed to volume / music selector: airy / tense / grim. */
  tone: "tense" | "grim" | "heroic" | "mystic" | "hopeful";
}

const ACT_THEMES: Record<ActId, ActTheme> = {
  prologue: {
    id: "prologue",
    chapters: ["ch01", "ch02"],
    label: "Prologue",
    labelZh: "序章",
    numeral: "0",
    accent: "#d8a55f",       // amber — torchlight
    secondary: "#f0c890",
    bgTint: "rgba(40, 30, 20, 0.6)",
    glow: "rgba(255, 180, 100, 0.5)",
    topBar: "linear-gradient(180deg, rgba(40,28,18,0.9) 0%, rgba(20,14,8,0.6) 100%)",
    tone: "hopeful",
  },
  act1: {
    id: "act1",
    chapters: ["ch03", "ch04", "ch05"],
    label: "Act I",
    labelZh: "第一章",
    numeral: "I",
    accent: "#7ac850",       // forest green
    secondary: "#c8e090",
    bgTint: "rgba(20, 40, 25, 0.6)",
    glow: "rgba(140, 220, 120, 0.5)",
    topBar: "linear-gradient(180deg, rgba(20,40,30,0.9) 0%, rgba(10,20,15,0.6) 100%)",
    tone: "heroic",
  },
  act2: {
    id: "act2",
    chapters: ["ch06", "ch07", "ch08", "ch09", "ch10"],
    label: "Act II",
    labelZh: "第二章",
    numeral: "II",
    accent: "#5fa8d8",       // city blue
    secondary: "#a0c0e8",
    bgTint: "rgba(15, 25, 50, 0.6)",
    glow: "rgba(120, 180, 255, 0.5)",
    topBar: "linear-gradient(180deg, rgba(15,30,55,0.9) 0%, rgba(8,15,28,0.6) 100%)",
    tone: "tense",
  },
  act3: {
    id: "act3",
    chapters: ["ch11", "ch12", "ch13", "ch14", "ch15"],
    label: "Act III",
    labelZh: "第三章",
    numeral: "III",
    accent: "#c0c0d0",       // mountain grey/silver
    secondary: "#e8e8f0",
    bgTint: "rgba(35, 35, 50, 0.6)",
    glow: "rgba(220, 220, 240, 0.5)",
    topBar: "linear-gradient(180deg, rgba(35,38,50,0.9) 0%, rgba(18,20,28,0.6) 100%)",
    tone: "mystic",
  },
  act4: {
    id: "act4",
    chapters: ["ch16", "ch17", "ch18", "ch19", "ch20"],
    label: "Act IV",
    labelZh: "第四章",
    numeral: "IV",
    accent: "#d83a3a",       // void red
    secondary: "#f08050",
    bgTint: "rgba(50, 15, 20, 0.6)",
    glow: "rgba(255, 80, 60, 0.5)",
    topBar: "linear-gradient(180deg, rgba(55,15,20,0.9) 0%, rgba(25,5,10,0.6) 100%)",
    tone: "grim",
  },
};

export function actForChapter(chapterId: string): ActId {
  for (const t of Object.values(ACT_THEMES)) {
    if (t.chapters.includes(chapterId)) return t.id;
  }
  return "prologue";
}

export function themeForAct(act: ActId): ActTheme {
  return ACT_THEMES[act];
}

export function themeForChapter(chapterId: string): ActTheme {
  return ACT_THEMES[actForChapter(chapterId)];
}

export function allActs(): ActTheme[] {
  return Object.values(ACT_THEMES);
}
