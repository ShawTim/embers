import { useGame } from "../game/store";
import { t, unitName, className } from "../i18n";
import type { RuntimeUnit } from "../types";
import type { Lang } from "../i18n";
import { CLASSES, PROMOTIONS, WEAPONS } from "../data/gameData";
import { useState } from "react";

export function PromotionScreen() {
  const selectionMode = useGame(s => s.selectionMode);

  const lang = useGame(s => s.lang);
  const units = useGame(s => s.units);
  const convoy = useGame(s => s.convoy);
  const useItemAction = useGame(s => s.useItemAction);
  const [selectedUnitUid, setSelectedUnitUid] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectionMode !== "actionMenu" && selectionMode !== "idle") return null;

  // Check if Master Seal exists in convoy
  const hasSeal = convoy.some(c => c.id === "master_seal" && c.uses > 0);
  if (!hasSeal) return null;

  // Eligible units: Lv10+, tier 1
  const eligible = units.filter(u => u.faction === "player" && !u.isDead && u.level >= 10 && u.classDef.tier === 1);
  if (eligible.length === 0) return null;

  const closePromotion = () => {
    setSelectedUnitUid(null);
    setShowConfirm(false);
  };

  if (showConfirm && !selectedUnitUid) {
    return (
      <>
        <div className="overlay" onClick={closePromotion} />
        <div className="promo-panel">
          <div className="promo-header">
            <span className="promo-title">✨ {t("promote", lang)}</span>
            <button className="btn-close" onClick={closePromotion}>✕</button>
          </div>
          <div className="promo-body">
            <div className="promo-unit">{t("selectUnitToPromote", lang)}</div>
            {eligible.map(unit => (
              <button
                className="promo-confirm-btn"
                key={unit.uid}
                onClick={() => setSelectedUnitUid(unit.uid)}
              >
                {unitName(unit.def.id, lang)} · {t("level", lang)}{unit.level} {className(unit.classDef.id, lang)}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // If a unit is selected for promotion confirmation
  if (showConfirm && selectedUnitUid) {
    const unit = units.find(u => u.uid === selectedUnitUid);
    if (unit) {
      return (
        <ConfirmPromotion
          unit={unit}
          lang={lang}
          onConfirm={() => {
            useItemAction("master_seal", unit.uid);
            closePromotion();
          }}
          onCancel={closePromotion}
        />
      );
    }
  }

  return (
    <div className="promo-trigger">
      <button
        onClick={() => {
          if (eligible.length === 1) setSelectedUnitUid(eligible[0].uid);
          setShowConfirm(true);
        }}
      >
        ✨ {t("promote", lang)}
      </button>
    </div>
  );
}

function ConfirmPromotion({ unit, lang, onConfirm, onCancel }: { unit: RuntimeUnit; lang: Lang; onCancel: () => void; onConfirm: () => void }) {
  const tt = (k: any) => t(k, lang);
  const oldClass = unit.classDef;
  const promotedClassId = PROMOTIONS[oldClass.id];
  const newClass = CLASSES[promotedClassId];
  if (!newClass) return null;

  // Calculate projected stats
  const statNames = ["hp", "str", "mag", "skl", "spd", "lck", "def", "res"];
  const projected: Record<string, number> = {};
  const gained: Record<string, number> = {};
  for (const s of statNames) {
    const boost = (newClass.base[s] - oldClass.base[s]) + 3;
    const newStat = Math.min((unit.stats[s] || 0) + Math.max(0, boost), newClass.caps[s] || 99);
    projected[s] = newStat;
    gained[s] = newStat - (unit.stats[s] || 0);
  }

  // New weapons gained
  const newWeapons = newClass.weapons.filter(wt => !oldClass.weapons.includes(wt));

  // Move change
  const moveChange = newClass.baseMove - oldClass.baseMove;

  return (
    <>
      <div className="overlay" onClick={onCancel} />
      <div className="promo-panel">
        <div className="promo-header">
          <span className="promo-title">✨ {tt("promote")}</span>
          <button className="btn-close" onClick={onCancel}>✕</button>
        </div>
        <div className="promo-body">
          {/* Unit name + class transition */}
          <div className="promo-unit">
            <span className="promo-unit-name">{unitName(unit.def.id, lang)}</span>
            <span className="promo-class-arrow">
              {tt("level")}{unit.level} {className(oldClass.id, lang)}
              <span className="promo-arrow">→</span>
              {className(newClass.id, lang)} ★
            </span>
          </div>

          {/* Stat comparison */}
          <div className="promo-stats-grid">
            <div className="promo-stats-header">
              <span></span>
              <span>{tt("classLabel")} 1</span>
              <span></span>
              <span>{tt("classLabel")} 2</span>
            </div>
            {statNames.map(s => {
              const gain = gained[s];
              return (
                <div key={s} className="promo-stat-row">
                  <span className="stat-label">{tt(s)}</span>
                  <span className="stat-old">{unit.stats[s] || 0}</span>
                  <span className={`stat-gain ${gain > 0 ? "pos" : ""}`}>
                    {gain > 0 ? `+${gain}` : "—"}
                  </span>
                  <span className="stat-new">{projected[s]}</span>
                </div>
              );
            })}
            {/* Move */}
            <div className="promo-stat-row promo-move-row">
              <span className="stat-label">{tt("mov")}</span>
              <span className="stat-old">{oldClass.baseMove}</span>
              <span className={`stat-gain ${moveChange > 0 ? "pos" : ""}`}>
                {moveChange > 0 ? `+${moveChange}` : moveChange < 0 ? `${moveChange}` : "—"}
              </span>
              <span className="stat-new">{newClass.baseMove}</span>
            </div>
          </div>

          {/* New abilities */}
          <div className="promo-abilities">
            {newWeapons.length > 0 && (
              <div className="promo-ability">
                <span className="ability-icon">🗡</span>
                <span className="ability-text">
                  {tt("newWeapons")}: {newWeapons.map(wt => {
                    const w = Object.values(WEAPONS).find((w: any) => w.type === wt && w.rank === 1);
                    return w ? w.name : wt;
                  }).join(", ")}
                </span>
              </div>
            )}
            {moveChange > 0 && (
              <div className="promo-ability">
                <span className="ability-icon">👟</span>
                <span className="ability-text">{tt("moveUp")}: {oldClass.baseMove} → {newClass.baseMove}</span>
              </div>
            )}
            <div className="promo-ability">
              <span className="ability-icon">❤</span>
              <span className="ability-text">{tt("fullHeal")}</span>
            </div>
          </div>

          {/* Confirm button */}
          <button className="promo-confirm-btn" onClick={onConfirm}>
            ✨ {tt("confirmPromote")}
          </button>
        </div>
      </div>
    </>
  );
}
