import { useState } from "react";
import { ITEMS, WEAPONS } from "../data/gameData";
import { getShopItems, useGame } from "../game/store";
import { shopItemInfo, t, type StringKey } from "../i18n";
import { audio } from "../audio/engine";

interface ShopModalProps {
  onClose: () => void;
}

export function ShopModal({ onClose }: ShopModalProps) {
  const gold = useGame(state => state.gold);
  const convoy = useGame(state => state.convoy);
  const buyItem = useGame(state => state.buyItem);
  const lang = useGame(state => state.lang);
  const [feedback, setFeedback] = useState<{ text: string; success: boolean } | null>(null);
  const tt = (key: StringKey, params?: Record<string, string | number>) => t(key, lang, params);

  const purchase = (itemId: string) => {
    const info = shopItemInfo(itemId, lang);
    if (buyItem(itemId)) {
      audio.play("menu");
      setFeedback({
        text: tt("purchaseSuccess", { item: info.name }),
        success: true,
      });
    } else {
      audio.play("cannot_act");
      setFeedback({ text: tt("notEnoughGold"), success: false });
    }
  };

  return (
    <div className="shop-modal" onClick={onClose}>
      <div className="shop-card" onClick={event => event.stopPropagation()}>
        <button className="btn-close shop-close" onClick={onClose}>✕</button>
        <div className="shop-heading">
          <div>
            <h2>{tt("shopTitle")}</h2>
            <p>{tt("shopHint")}</p>
          </div>
          <div className="shop-gold">◆ {tt("goldLabel")}: {gold}G</div>
        </div>
        <div className="shop-items">
          {getShopItems().map(shopItem => {
            const definition = WEAPONS[shopItem.id] || ITEMS[shopItem.id];
            if (!definition) return null;
            const info = shopItemInfo(shopItem.id, lang);
            const owned = convoy.filter(item => item.id === shopItem.id).length;
            return (
              <div className="shop-item" data-shop-item={shopItem.id} key={shopItem.id}>
                <div className="shop-item-main">
                  <div className="shop-item-name">{info.name}</div>
                  <div className="shop-item-desc">{info.desc}</div>
                  <div className="shop-item-meta">
                    {tt("owned")}: {owned}
                    {" · "}
                    {definition.uses} {tt("uses")}
                  </div>
                </div>
                <div className="shop-item-buy">
                  <div className="shop-item-price">{shopItem.price}G</div>
                  <button
                    className={`shop-buy-btn ${gold < shopItem.price ? "unaffordable" : ""}`}
                    data-affordable={gold >= shopItem.price}
                    onClick={() => purchase(shopItem.id)}
                  >
                    {tt("buy")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {feedback && (
          <div className={`shop-feedback ${feedback.success ? "success" : "failure"}`}>
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  );
}
