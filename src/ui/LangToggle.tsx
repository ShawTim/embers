import { useGame } from "../game/store";
export function LangToggle() {
  const lang = useGame(s => s.lang); const setLang = useGame(s => s.setLang);
  return <button className="lang-toggle" onClick={() => setLang(lang === "en" ? "zh" : "en")} title="Switch language">{lang === "en" ? "中" : "EN"}</button>;
}
