import { useGame } from "../game/store";
import { t } from "../i18n";

export function ExpPopup() {
  const expPopup = useGame(s => s.expPopup);
  const lang = useGame(s => s.lang);

  if (!expPopup) return null;

  const { unitName: name, amount, leveledUp, newLevel, statGains } = expPopup;
  const tt = (k: any) => t(k, lang);
  const statKeys = Object.keys(statGains);

  if (leveledUp) {
    return (
      <div className="exp-popup-overlay">
        <div className="exp-popup-card levelup">
          <div className="exp-popup-title">★ {tt("levelUp")}</div>
          <div className="exp-popup-name">{name}</div>
          <div className="exp-popup-newlevel">Lv {newLevel}</div>
          <div className="exp-popup-stats">
            {statKeys.map(s => (
              <div key={s} className="exp-popup-stat-gain">
                <span className="stat-label">{tt(s)}</span>
                <span className="stat-arrow">↑</span>
                <span className="stat-plus">+{statGains[s]}</span>
              </div>
            ))}
            {statKeys.length === 0 && <div className="exp-popup-nogain">—</div>}
          </div>
          <div className="exp-popup-exp">{tt("exp")} +{amount}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="exp-popup-overlay">
      <div className="exp-popup-card">
        <div className="exp-popup-name">{name}</div>
        <div className="exp-popup-exp">{tt("exp")} +{amount}</div>
      </div>
    </div>
  );
}
