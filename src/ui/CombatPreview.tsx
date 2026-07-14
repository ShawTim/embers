import { useGame } from "../game/store";
import { t, unitName } from "../i18n";

export function CombatPreview() {
  const preview = useGame(s => s.combatPreview);
  const lang = useGame(s => s.lang);
  if (!preview) return null;
  const { attacker, defender, preview: p } = preview;
  return (
    <div className="combat-preview">
      <div className="combat-side">
        <div className="cp-name" style={{ color: "#7ab8ff" }}>{unitName(attacker.def.id, lang)}</div>
        <div className="cp-hp">{attacker.hp} → {p.attackerHpAfter} {t("hp", lang)}</div>
        <div className="cp-stat cp-dmg"><span className="label">{t("dmg", lang)}</span><span className="val">{p.attackerDmg}{p.attackerDoubles ? " ×2" : ""}</span></div>
        <div className="cp-stat cp-hit"><span className="label">{t("hit", lang)}</span><span className="val">{p.attackerHit}%</span></div>
        <div className="cp-stat cp-crit"><span className="label">{t("crt", lang)}</span><span className="val">{p.attackerCrit}%</span></div>
      </div>
      <div className="combat-vs">{t("vs", lang)}</div>
      <div className="combat-side">
        <div className="cp-name" style={{ color: "#ff7a7a" }}>{unitName(defender.def.id, lang)}</div>
        <div className="cp-hp">{defender.hp} → {p.defenderHpAfter} {t("hp", lang)}</div>
        {p.willCounter ? (<><div className="cp-stat cp-dmg"><span className="label">{t("dmg", lang)}</span><span className="val">{p.defenderDmg}{p.defenderDoubles ? " ×2" : ""}</span></div><div className="cp-stat cp-hit"><span className="label">{t("hit", lang)}</span><span className="val">{p.defenderHit}%</span></div><div className="cp-stat cp-crit"><span className="label">{t("crt", lang)}</span><span className="val">{p.defenderCrit}%</span></div></>) : <div className="cp-stat" style={{ color: "#445" }}>{t("noCounter", lang)}</div>}
      </div>
      {p.weaponTriangle !== 0 && <div style={{ position: "absolute", bottom: -28, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 600 }}>{p.weaponTriangle > 0 ? <span style={{ color: "#5fa84a" }}>{t("advantage", lang)}</span> : <span style={{ color: "#e8484a" }}>{t("disadvantage", lang)}</span>}</div>}
    </div>
  );
}
