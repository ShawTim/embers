import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { themeForChapter } from "../game/actTheme";
import { t, chapterInfo, type StringKey } from "../i18n";
import { audio } from "../audio/engine";

interface Props {
  /** When the chapter changes, the intro card animates in. */
  chapterId: string;
}

/**
 * Big chapter intro card.  Shows the act + chapter name + objective for
 * 2.5 seconds when the player first enters a chapter, then fades out.
 * Color-graded to the current act so the player gets a visual signal
 * that they've moved into a new act.
 */
export function ChapterIntroCard({ chapterId }: Props) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0);
  const lang = useGame(s => s.lang);
  const tt = (k: StringKey, p?: Record<string, string | number>) => t(k, lang, p);

  // Reset every time the chapter changes
  useEffect(() => {
    setVisible(true);
    setOpacity(0);
    const fadeIn = setTimeout(() => setOpacity(1), 30);
    const fadeOutStart = setTimeout(() => setOpacity(0), 2400);
    const hide = setTimeout(() => setVisible(false), 3000);
    // Soft chord stab on chapter start
    audio.play("menu");
    return () => { clearTimeout(fadeIn); clearTimeout(fadeOutStart); clearTimeout(hide); };
  }, [chapterId]);

  if (!visible) return null;
  const theme = themeForChapter(chapterId);
  const obj = chapterInfo(chapterId, "obj", lang);
  const name = chapterInfo(chapterId, "name", lang);
  const num = theme.numeral;
  const romanLabel = num === "0" ? tt("prologue") : (lang === "zh" ? `第${num === "IV" ? "四" : num === "III" ? "三" : num === "II" ? "二" : "一"}章` : `${theme.label}`);
  return (
    <div
      className="chapter-intro-card"
      style={{
        opacity,
        background: `radial-gradient(ellipse at center, ${theme.bgTint} 0%, rgba(0,0,0,0.85) 100%)`,
      }}
    >
      <div
        className="chapter-intro-numeral"
        style={{
          color: theme.accent,
          textShadow: `0 0 30px ${theme.glow}, 0 0 60px ${theme.glow}`,
        }}
      >
        {num}
      </div>
      <div
        className="chapter-intro-act"
        style={{ color: theme.secondary, borderColor: theme.accent }}
      >
        {romanLabel}
      </div>
      <div
        className="chapter-intro-name"
        style={{ color: "#e8eef8" }}
      >
        {name}
      </div>
      <div
        className="chapter-intro-objective"
        style={{ color: theme.accent }}
      >
        {obj}
      </div>
    </div>
  );
}
