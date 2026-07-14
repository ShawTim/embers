import { useState, useEffect, useRef } from "react";
import { useGame } from "../game/store";
import { getDialogue, type DialogueLine } from "../data/dialogues";
import { unitName, t } from "../i18n";
import { Portrait3D } from "./Portrait3D";
import { MODEL_PATHS } from "../three/Unit3D";

// Map unit def.id to modelId for portraits
const UNIT_MODELS: Record<string, string> = {
  kael: "Paladin", lyra: "Witch", borin: "BlackKnight", serra: "MagicalGirl",
  bandit_sword: "Skeleton_Warrior", bandit_axe: "Skeleton_Warrior",
  boss_garrick: "Skeleton_Warrior", umbral_mage: "Skeleton_Mage",
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
      } else {
        setIsTyping(false);
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 25);

    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [script, lineIndex, lang]);

  if (!script || lineIndex >= script.lines.length) return null;

  const line: DialogueLine = script.lines[lineIndex];
  const isNarrator = line.speaker === "narrator";
  const speakerDisplayName = isNarrator ? null : (line.speakerName ? line.speakerName[lang] : unitName(line.speaker, lang));
  const modelId = UNIT_MODELS[line.speaker] || "Knight";

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
            <Portrait3D modelId={modelId} mood={line.mood} />
          </div>
        )}

        {/* Text area */}
        <div className="dialogue-content">
          {isNarrator ? (
            <div className="dialogue-narrator-text">{displayedText}</div>
          ) : (
            <>
              <div className="dialogue-speaker" style={{ color: line.mood === "angry" ? "#f66" : line.mood === "sad" ? "#68a" : "#8cf" }}>
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
