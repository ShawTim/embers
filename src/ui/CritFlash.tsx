import { useGame } from "../game/store";

// Brief full-screen white flash triggered by crit hits.  Reads
// `critEvent` from the store and uses it as a React key so each
// new crit remounts the div + replays the CSS animation.
export function CritFlash() {
  const n = useGame(s => s.critEvent);
  if (n === 0) return null;
  return <div key={n} className="crit-flash" />;
}
