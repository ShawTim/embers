import { useState, useEffect } from "react";
import { useGame } from "../game/store";
import { save as saveSystem } from "../game/save";
import { CHAPTERS } from "../data/gameData";
import { t, type StringKey } from "../i18n";
import { audio } from "../audio/engine";

interface Props {
  onClose: () => void;
}

const SLOT_KEYS: { id: string; labelKey: StringKey }[] = [
  { id: "slot0", labelKey: "saveSlot1" },
  { id: "slot1", labelKey: "saveSlot2" },
  { id: "slot2", labelKey: "saveSlot3" },
  { id: "slot3", labelKey: "saveSlot4" },
  { id: "slot4", labelKey: "saveSlot5" },
];

export function SaveLoadModal({ onClose }: Props) {
  const [tab, setTab] = useState<"save" | "load">("save");
  const [meta, setMeta] = useState(() => saveSystem.getMeta());
  const lang = useGame(s => s.lang);
  const tt = (k: StringKey, p?: Record<string, string | number>) => t(k, lang, p);
  const saveToSlot = useGame(s => s.saveToSlot);
  const loadFromSlot = useGame(s => s.loadFromSlot);
  const loadAutosave = useGame(s => s.loadAutosave);
  const phase = useGame(s => s.phase);
  const chapter = useGame(s => s.chapter);
  const turn = useGame(s => s.turn);
  const hasAutosave = useGame(s => s.hasAutosave);
  const hasAuto = hasAutosave();

  // Refresh meta whenever a save/load happens
  const refresh = () => setMeta(saveSystem.getMeta());

  const onSave = (slotId: string) => {
    if (phase !== "player" || !chapter) return;
    if (saveToSlot(slotId)) {
      audio.play("menu");
      refresh();
    }
  };

  const onLoad = (slotId: string) => {
    if (loadFromSlot(slotId)) {
      audio.play("select");
      onClose();
    }
  };

  const onLoadAuto = () => {
    if (loadAutosave()) {
      audio.play("select");
      onClose();
    }
  };

  const onDelete = (slotId: string) => {
    saveSystem.remove(slotId);
    refresh();
  };

  const slotInfo = (slotId: string) => {
    const m = meta.slots.find(s => s.id === slotId);
    return m ? { label: m.label, savedAt: m.savedAt, chapterId: m.chapterId, turn: m.turn } : null;
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="save-load-modal" onClick={onClose}>
      <div className="save-load-card" onClick={e => e.stopPropagation()}>
        <button className="btn-close save-load-close" onClick={onClose}>×</button>
        <h2>{tt(tab === "save" ? "saveGame" : "loadGame")}</h2>
        <div className="save-load-tabs">
          <button className={tab === "save" ? "active" : ""} onClick={() => setTab("save")}>{tt("save")}</button>
          <button className={tab === "load" ? "active" : ""} onClick={() => setTab("load")}>{tt("load")}</button>
        </div>
        <div className="save-load-body">
          {tab === "load" && hasAuto && (
            <div className="save-load-autosave">
              <button onClick={onLoadAuto}>{tt("autosave")}</button>
            </div>
          )}
          {SLOT_KEYS.map(s => {
            const info = slotInfo(s.id);
            const occupied = !!info;
            return (
              <div className="save-load-slot" key={s.id}>
                <div className="slot-label">
                  <strong>{tt(s.labelKey)}</strong>
                  {occupied && <span className="slot-info"> — {info!.label}</span>}
                </div>
                <div className="slot-actions">
                  {tab === "save" && (
                    <button
                      className="btn-save-slot"
                      disabled={phase !== "player" || !chapter}
                      onClick={() => onSave(s.id)}
                    >
                      {occupied ? tt("overwrite") : tt("save")}
                    </button>
                  )}
                  {tab === "load" && (
                    <>
                      <button
                        className="btn-load-slot"
                        disabled={!occupied}
                        onClick={() => onLoad(s.id)}
                      >
                        {tt("load")}
                      </button>
                      <button
                        className="btn-delete-slot"
                        disabled={!occupied}
                        onClick={() => onDelete(s.id)}
                      >
                        {tt("delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {tab === "save" && (phase !== "player" || !chapter) && (
          <div className="save-load-hint">{tt("saveOnlyPlayerTurn")}</div>
        )}
      </div>
    </div>
  );
}
