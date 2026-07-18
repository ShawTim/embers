import { useState, useEffect } from "react";
import { audio } from "../audio/engine";

const KEY = "embers:audio:volumes";

interface Volumes { sfx: number; music: number; muted: boolean; }
const DEFAULTS: Volumes = { sfx: 0.6, music: 0.35, muted: false };

function loadVols(): Volumes {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function saveVols(v: Volumes) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

export function SoundToggle() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Volumes>(() => {
    const vv = loadVols();
    audio.setSfxVolume(vv.sfx);
    audio.setMusicVolume(vv.music);
    return vv;
  });

  useEffect(() => {
    saveVols(v);
    audio.setSfxVolume(v.muted ? 0 : v.sfx);
    audio.setMusicVolume(v.muted ? 0 : v.music);
  }, [v]);

  // Apply initial volumes on mount (so audio engine gets them too)
  useEffect(() => {
    audio.setSfxVolume(v.muted ? 0 : v.sfx);
    audio.setMusicVolume(v.muted ? 0 : v.music);
  }, []); // eslint-disable-line

  return (
    <div className="sound-toggle-wrap">
      <button
        className="btn-sound"
        onClick={() => { setOpen(o => !o); audio.unlock(); }}
        title={v.muted ? "Unmute" : "Sound settings"}
      >
        {v.muted ? "🔇" : "🔊"}
      </button>
      {open && (
        <div className="sound-panel" onMouseLeave={() => setOpen(false)}>
          <label className="sound-row">
            <span>SFX</span>
            <input type="range" min={0} max={1} step={0.05}
              value={v.sfx} onChange={e => setV({ ...v, sfx: Number(e.target.value) })} />
          </label>
          <label className="sound-row">
            <span>Music</span>
            <input type="range" min={0} max={1} step={0.05}
              value={v.music} onChange={e => setV({ ...v, music: Number(e.target.value) })} />
          </label>
          <label className="sound-row sound-mute">
            <input type="checkbox" checked={v.muted} onChange={e => setV({ ...v, muted: e.target.checked })} />
            <span>Mute</span>
          </label>
        </div>
      )}
    </div>
  );
}
