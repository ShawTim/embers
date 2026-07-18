import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";

// ---------------------------------------------------------------------------
//  BossEntrance — full-screen black flash + cinematic name banner.  The
//  store fires `triggerBossEntrance(name, dur)` once per chapter at the
//  start of the first enemy turn where the boss is still alive.
//  Implementation: capture the entrance payload in local state on first
//  mount, render for `dur` seconds, then clear the store.  The Banner
//  uses CSS @keyframes for the slide/flash animation so we don't need a
//  per-frame rAF loop (which would thrash React and fight the transitions).
// ---------------------------------------------------------------------------

export function BossEntrance() {
  const ent = useGame((s) => s.bossEntrance);
  const [payload, setPayload] = useState<{ name: string; born: number; dur: number; key: number } | null>(null);
  const lastBornRef = useRef<number>(0);

  useEffect(() => {
    if (ent && ent.born !== lastBornRef.current) {
      lastBornRef.current = ent.born;
      setPayload({ name: ent.name, born: ent.born, dur: ent.dur, key: ent.born });
      const t = setTimeout(() => {
        useGame.setState({ bossEntrance: null });
        setPayload(null);
      }, ent.dur * 1000);
      return () => clearTimeout(t);
    }
  }, [ent]);

  if (!payload) return null;
  return <Banner key={payload.key} name={payload.name} dur={payload.dur} />;
}

function Banner({ name, dur }: { name: string; dur: number }) {
  return (
    <>
      <div className="boss-flash" key={`f-${name}`} style={{ animationDuration: `${dur * 0.3}s` }} />
      <div className="boss-banner" key={`b-${name}`} style={{ animationDuration: `${dur}s` }}>
        <div className="boss-tag">⚠ BOSS ⚠</div>
        <div className="boss-name">{name}</div>
      </div>
    </>
  );
}
