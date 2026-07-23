import { useState, useEffect, useRef } from "react";
import { useGame } from "../game/store";
import { getDialogue, type DialogueLine } from "../data/dialogues";
import { unitName, t } from "../i18n";
import { Portrait3D } from "./Portrait3D";
import { audio } from "../audio/engine";
import { MODEL_PATHS } from "../three/Unit3D";
import { UNITS } from "../data/gameData";
import { runtimeDelay } from "../game/timing";

// Map unit def.id to modelId for portraits.  By default we use the
// unit's own modelId from gameData (so we don't need separate
// "portrait" models), with a few overrides for visual variety when
// the in-game model is too plain for a close-up.
const PORTRAIT_OVERRIDES: Record<string, string> = {
  // Use the in-game model for the main cast.  Enemies use their
  // in-game model too so we don't need to ship 4MB Skeleton_*.glbs
  // just for dialogue portraits.
};

export function DialogueBox() {
  const dialogueId = useGame(s => s.activeDialogue);
  const lang = useGame(s => s.lang);
  const clearDialogue = useGame(s => s.clearDialogue);
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const script = dialogueId ? getDialogue(dialogueId) : null;

  useEffect(() => {
    if (!script) { setLineIndex(0); setDisplayedText(""); return; }
    setLineIndex(0);
  }, [dialogueId]);

  useEffect(() => {
    if (!script || lineIndex >= script.lines.length) return;
    const line = script.lines[lineIndex];
    const fullText = line.text[lang] || line.text.en;
    setDisplayedText("");
    setIsTyping(true);

    if (typewriterRef.current) clearInterval(typewriterRef.current);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText(fullText.slice(0, i + 1));
        i++;
        // Soft tick every 3 chars to avoid buzzing
        if (i % 3 === 0) audio.play("dialogue_tick");
      } else {
        setIsTyping(false);
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, runtimeDelay(25));

    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [script, lineIndex, lang]);

  if (!script || lineIndex >= script.lines.length) return null;

  const line: DialogueLine = script.lines[lineIndex];
  const isNarrator = line.speaker === "narrator";
  const speakerDisplayName = isNarrator ? null : (line.speakerName ? line.speakerName[lang] : unitName(line.speaker, lang));
  // Look up the unit's own modelId so the portrait matches the unit's
  // appearance on the battlefield.  PORTRAIT_OVERRIDES provides a hook
  // for swapping to a different model when needed.
  const speakerUnit = UNITS[line.speaker];
  const modelId = (speakerUnit && (PORTRAIT_OVERRIDES[line.speaker] || speakerUnit.modelId)) || "Paladin";
  const speakerTitle = speakerUnit
    ? t(("c_" + speakerUnit.classId) as any, lang)
    : undefined;

  const advance = () => {
    if (isTyping) {
      // Skip typewriter
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      setDisplayedText(line.text[lang] || line.text.en);
      setIsTyping(false);
      return;
    }
    if (lineIndex < script.lines.length - 1) {
      setLineIndex(lineIndex + 1);
    } else {
      clearDialogue();
    }
  };

  return (
    <div className="dialogue-overlay" onClick={advance}>
      <div className="dialogue-box" onClick={(e) => e.stopPropagation()}>
        {/* Portrait */}
        {!isNarrator && (
          <div className="dialogue-portrait">
            <Portrait3D
              modelId={modelId}
              unitId={line.speaker}
              mood={line.mood}
              namePlate={speakerDisplayName || undefined}
              title={speakerTitle}
            />
          </div>
        )}

        {/* Text area */}
        <div className="dialogue-content">
          {isNarrator ? (
            <div className="dialogue-narrator-text">{displayedText}</div>
          ) : (
            <>
              <div
                className="dialogue-speaker"
                style={{
                  color: line.mood === "angry" ? "#f66" : line.mood === "sad" ? "#68a" : (speakerUnit?.portraitColor || "#8cf"),
                  textShadow: `0 0 8px ${speakerUnit?.portraitColor || "#8cf"}55`,
                }}
              >
                {speakerDisplayName}
              </div>
              <div className="dialogue-text">{displayedText}</div>
            </>
          )}
          {/* Progress indicator */}
          <div className="dialogue-progress">
            {lineIndex + 1} / {script.lines.length}
            {!isTyping && <span className="dialogue-next-hint">▶</span>}
          </div>
        </div>

        {/* Click area */}
        <div className="dialogue-click-area" onClick={advance} />
      </div>
    </div>
  );
}
