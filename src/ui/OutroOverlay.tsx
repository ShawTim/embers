import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { CHAPTERS } from "../data/gameData";
import { audio } from "../audio/engine";
import { t, type StringKey } from "../i18n";

/**
 * Final cinematic screen that appears after the ch20 epilogue credits
 * finish.  Shows the chapter name, a "The End" tagline, playtime stats,
 * and a button to return to the title or play again.
 *
 * Only renders when phase === "epilogue".  Sets up a one-time music
 * sting + fade in.
 */
export function OutroOverlay() {
  const phase = useGame(s => s.phase);
  const chapter = useGame(s => s.chapter);
  const lang = useGame(s => s.lang);
  const returnToTitle = useGame(s => s.returnToTitle);
  const initChapter = useGame(s => s.initChapter);
  const [opacity, setOpacity] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const tt = (k: StringKey) => t(k, lang);

  // Playtime tracking: read from save meta
  const [playtime, setPlaytime] = useState<string>(() => {
    try {
      const m = (window as any).localStorage?.getItem("embers:meta");
      if (m) {
        const parsed = JSON.parse(m);
        return parsed.playtime || "—";
      }
    } catch { /* ignore */ }
    return "—";
  });

  useEffect(() => {
    if (phase !== "epilogue") {
      setOpacity(0);
      setShowEnd(false);
      return;
    }
    // Cinematic fade-in
    setOpacity(0);
    setShowEnd(false);
    const t1 = setTimeout(() => setOpacity(1), 60);
    // After the chapter title fades in, show "The End"
    const t2 = setTimeout(() => setShowEnd(true), 1500);
    // Play the victory fanfare if not already
    audio.startMusic("victory");
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  if (phase !== "epilogue") return null;

  const chName = chapter ? (lang === "zh" ? chapterInfoZh(chapter.id) : chapter.name) : "";
  const idx = chapter ? CHAPTERS.findIndex(c => c.id === chapter.id) : -1;

  return (
    <div
      className="outro-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at center, rgba(20,30,50,0.6) 0%, rgba(0,0,0,0.97) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        opacity,
        transition: "opacity 1.2s ease-in-out",
        pointerEvents: opacity > 0.5 ? "auto" : "none",
      }}
    >
      <div className="outro-content">
        {/* Chapter title fades in first */}
        <div
          className="outro-chapter"
          style={{
            fontSize: 20,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#a0b8d8",
            marginBottom: 8,
            opacity: opacity,
            transition: "opacity 1.2s ease-in-out",
          }}
        >
          {tt("finalChapter")}
        </div>
        <div
          className="outro-chapter-name"
          style={{
            fontSize: 32,
            color: "#e0e8f0",
            marginBottom: 24,
            opacity: opacity,
            transition: "opacity 1.2s ease-in-out 0.3s",
            fontFamily: '"Cinzel", "Trajan Pro", "Times New Roman", serif',
          }}
        >
          {chName}
        </div>
        {/* "The End" tagline */}
        <div
          className="outro-the-end"
          style={{
            fontSize: 96,
            fontWeight: 300,
            color: "#fff5b0",
            letterSpacing: 12,
            textShadow: "0 0 30px rgba(255,245,176,0.5), 0 0 60px rgba(255,245,176,0.3)",
            marginBottom: 16,
            fontFamily: '"Cinzel", "Trajan Pro", "Times New Roman", serif',
            opacity: showEnd ? 1 : 0,
            transform: showEnd ? "scale(1)" : "scale(0.7)",
            transition: "opacity 1.2s ease-in-out, transform 1.2s ease-in-out",
          }}
        >
          {tt("theEnd")}
        </div>
        <div
          className="outro-thanks"
          style={{
            fontSize: 18,
            color: "#a0b8c8",
            fontStyle: "italic",
            marginBottom: 48,
            opacity: showEnd ? 0.9 : 0,
            transition: "opacity 1.5s ease-in-out 0.5s",
          }}
        >
          {tt("thanksForPlaying")}
        </div>
        {/* Stats line */}
        <div
          className="outro-stats"
          style={{
            fontSize: 13,
            color: "#7898b0",
            letterSpacing: 1.5,
            marginBottom: 32,
            opacity: showEnd ? 1 : 0,
            transition: "opacity 1.2s ease-in-out 1s",
          }}
        >
          {tt("completedChapters")} {idx + 1} / {CHAPTERS.length}
        </div>
        {/* Buttons */}
        <div
          className="outro-buttons"
          style={{
            display: "flex",
            gap: 16,
            opacity: showEnd ? 1 : 0,
            transform: showEnd ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 1.2s ease-in-out 1.3s, transform 1.2s ease-in-out 1.3s",
          }}
        >
          <button
            className="outro-btn outro-btn-primary"
            onClick={() => { audio.play("select"); returnToTitle(); }}
          >
            {tt("returnToTitle")}
          </button>
          <button
            className="outro-btn"
            onClick={() => { audio.play("select"); initChapter(0); }}
          >
            {tt("playAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}

function chapterInfoZh(chapterId: string): string {
  // Use i18n for the Chinese name
  return t((chapterId + "_name") as any, "zh") || chapterId;
}
