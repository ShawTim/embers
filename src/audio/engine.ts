// Procedural audio engine — synthesizes all SFX + BGM in real time using
// the Web Audio API.  No external asset files, no MP3/OGG downloads.
//
// Public API:
//   audio.init()                  — call once on first user gesture
//   audio.play(name, opts?)       — play a one-shot SFX
//   audio.startMusic(track)       — start a background music track
//   audio.stopMusic()             — stop the music
//   audio.setMusicVolume(v)
//   audio.setSfxVolume(v)
//   audio.unlock()                — call on every user gesture to resume
//
// SFX names: "select", "hit_sword", "hit_axe", "hit_lance", "fire", "ice",
//   "lightning", "dark", "heal", "crit", "step", "dialogue_tick", "menu",
//   "boss_intro", "death", "victory", "defeat", "move", "cannot_act",
//   "level_up"
//
// Music tracks: "title", "battle", "boss", "victory", "defeat"

interface AudioEngine {
  ctx: AudioContext | null;
  master: GainNode | null;
  musicGain: GainNode | null;
  sfxGain: GainNode | null;
  musicTimer: number | null;
  musicVolume: number;
  sfxVolume: number;
  unlocked: boolean;
}

const engine: AudioEngine = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  musicTimer: null,
  musicVolume: 0.35,
  sfxVolume: 0.6,
  unlocked: false,
};

let noiseBuffer: AudioBuffer | null = null;
let impulseResponse: AudioBuffer | null = null;

function ensureContext(): AudioContext | null {
  if (engine.ctx) return engine.ctx;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    engine.ctx = new Ctor() as AudioContext;
    engine.master = engine.ctx.createGain();
    engine.master.gain.value = 1.0;
    engine.master.connect(engine.ctx.destination);
    engine.sfxGain = engine.ctx.createGain();
    engine.sfxGain.gain.value = engine.sfxVolume;
    engine.sfxGain.connect(engine.master);
    engine.musicGain = engine.ctx.createGain();
    engine.musicGain.gain.value = engine.musicVolume;
    engine.musicGain.connect(engine.master);

    // Pre-build a 2s white-noise buffer for whooshes / wind / shatters.
    const sr = engine.ctx.sampleRate;
    const len = sr * 2;
    const buf = engine.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;

    // Pre-build a small reverb impulse response (synth IR).
    const irLen = sr * 0.6;
    const ir = engine.ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
      }
    }
    impulseResponse = ir;
  } catch (e) {
    return null;
  }
  return engine.ctx;
}

function now() { return engine.ctx ? engine.ctx.currentTime : 0; }

// ===== One-shot helpers =====

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.5,
  attack = 0.005,
  release = 0.08,
  dest?: AudioNode | null,
) {
  if (!engine.ctx || !engine.sfxGain) return;
  const t0 = now();
  const osc = engine.ctx.createOscillator();
  const g = engine.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(g);
  g.connect(dest || engine.sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  if (release) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.5), t0 + dur);
  }
}

function noiseBurst(
  dur: number,
  vol = 0.5,
  filterFreq = 1500,
  filterType: BiquadFilterType = "lowpass",
  dest?: AudioNode | null,
  decay = 3,
) {
  if (!engine.ctx || !engine.sfxGain || !noiseBuffer) return;
  const t0 = now();
  const src = engine.ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = engine.ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = engine.ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest || engine.sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function sweptNoise(
  dur: number,
  vol: number,
  startFreq: number,
  endFreq: number,
  filterType: BiquadFilterType = "bandpass",
  dest?: AudioNode | null,
) {
  if (!engine.ctx || !engine.sfxGain || !noiseBuffer) return;
  const t0 = now();
  const src = engine.ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = engine.ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(startFreq, t0);
  f.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  f.Q.value = 6;
  const g = engine.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest || engine.sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function withReverb(): ConvolverNode | null {
  if (!engine.ctx || !engine.sfxGain || !impulseResponse) return null;
  const c = engine.ctx.createConvolver();
  c.buffer = impulseResponse;
  c.connect(engine.sfxGain);
  return c;
}

// ===== SFX catalogue =====

const SFX: Record<string, () => void> = {
  select: () => {
    tone(440, 0.06, "sine", 0.25, 0.002, 0.04);
    setTimeout(() => tone(660, 0.05, "sine", 0.2, 0.002, 0.04), 35);
  },

  hit_sword: () => {
    sweptNoise(0.12, 0.5, 2200, 280, "bandpass");
    tone(120, 0.08, "square", 0.3, 0.001, 0.04);
  },

  hit_axe: () => {
    noiseBurst(0.18, 0.6, 600, "lowpass");
    tone(80, 0.18, "sawtooth", 0.35, 0.002, 0.05);
  },

  hit_lance: () => {
    sweptNoise(0.15, 0.4, 1800, 400, "bandpass");
    tone(220, 0.18, "triangle", 0.3, 0.002, 0.04);
    setTimeout(() => tone(150, 0.1, "sine", 0.2, 0.001, 0.04), 60);
  },

  fire: () => {
    sweptNoise(0.4, 0.5, 3200, 200, "bandpass");
    tone(180, 0.25, "sawtooth", 0.3, 0.01, 0.05);
    noiseBurst(0.35, 0.35, 1200, "bandpass");
  },

  ice: () => {
    // Shatter: high-pass noise burst with multiple tiny sine pings
    noiseBurst(0.5, 0.55, 4000, "highpass", undefined, 4);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => tone(2000 + Math.random() * 2000, 0.04, "sine", 0.2, 0.001, 0.02), i * 25);
    }
    tone(880, 0.12, "triangle", 0.25, 0.001, 0.04);
  },

  lightning: () => {
    // Zap: descending white-noise sweep with high-frequency ring
    sweptNoise(0.25, 0.7, 8000, 200, "bandpass");
    sweptNoise(0.3, 0.4, 4000, 100, "highpass");
    tone(2400, 0.08, "sawtooth", 0.4, 0.001, 0.05);
    tone(120, 0.4, "sawtooth", 0.25, 0.01, 0.05);
  },

  dark: () => {
    // Low rumble + dissonant minor third
    noiseBurst(0.7, 0.45, 240, "lowpass", undefined, 2);
    tone(70, 0.6, "sawtooth", 0.35, 0.02, 0.06);
    tone(80, 0.6, "sawtooth", 0.3, 0.02, 0.06);
    tone(45, 0.5, "sine", 0.25, 0.02, 0.06);
  },

  heal: () => {
    // Chime: ascending arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => {
      tone(f, 0.18, "sine", 0.32, 0.005, 0.06);
      tone(f * 2, 0.18, "sine", 0.15, 0.005, 0.06);
    }, i * 70));
  },

  crit: () => {
    const verb = withReverb();
    noiseBurst(0.25, 0.7, 1200, "lowpass", verb);
    tone(220, 0.2, "square", 0.5, 0.001, 0.05, verb);
    tone(110, 0.4, "sawtooth", 0.4, 0.001, 0.05, verb);
    setTimeout(() => tone(80, 0.3, "sine", 0.3, 0.005, 0.05, verb), 60);
  },

  step: () => {
    noiseBurst(0.05, 0.18, 600, "lowpass", undefined, 6);
    tone(60, 0.05, "sine", 0.1, 0.001, 0.02);
  },

  move: () => {
    sweptNoise(0.18, 0.25, 800, 300, "bandpass");
  },

  dialogue_tick: () => {
    tone(1200, 0.025, "sine", 0.15, 0.001, 0.015);
  },

  menu: () => {
    // Ascending "chord stab"
    [261, 329, 392].forEach((f, i) => setTimeout(() => {
      tone(f, 0.35, "triangle", 0.25, 0.005, 0.06);
    }, i * 30));
  },

  boss_intro: () => {
    const verb = withReverb();
    // Brass stab: low brass chord that swells then cuts
    [82, 110, 130, 165].forEach((f) => {
      tone(f, 1.2, "sawtooth", 0.3, 0.04, 0.08, verb);
      tone(f * 2, 1.2, "square", 0.15, 0.04, 0.08, verb);
    });
    noiseBurst(1.2, 0.25, 200, "lowpass", verb, 2);
    // Sub-bass drop
    setTimeout(() => {
      tone(40, 0.6, "sine", 0.6, 0.01, 0.05, verb);
      tone(55, 0.6, "sine", 0.4, 0.01, 0.05, verb);
    }, 200);
  },

  death: () => {
    // Descending tone, like a deflating horn
    if (!engine.ctx || !engine.sfxGain) return;
    const t0 = now();
    const osc = engine.ctx.createOscillator();
    const g = engine.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.9);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(g);
    g.connect(engine.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 1.2);
    noiseBurst(0.5, 0.2, 400, "lowpass", undefined, 3);
  },

  victory: () => {
    // Fanfare: C-E-G-C arpeggio + sustained chord
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => {
      tone(f, 0.3, "triangle", 0.3, 0.005, 0.06);
      tone(f * 0.5, 0.3, "sine", 0.2, 0.005, 0.06);
    }, i * 140));
    setTimeout(() => {
      [523, 659, 784, 1047].forEach((f) => {
        tone(f, 1.5, "triangle", 0.25, 0.02, 0.08);
        tone(f * 2, 1.5, "sine", 0.1, 0.02, 0.08);
      });
    }, 600);
  },

  defeat: () => {
    // Sad brass: descending minor progression
    const notes = [392, 349, 311, 261];
    notes.forEach((f, i) => setTimeout(() => {
      tone(f, 0.45, "sawtooth", 0.25, 0.02, 0.07);
      tone(f * 1.5, 0.45, "sine", 0.15, 0.02, 0.07);
    }, i * 250));
  },

  cannot_act: () => {
    tone(220, 0.08, "square", 0.18, 0.001, 0.03);
  },

  level_up: () => {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => setTimeout(() => {
      tone(f, 0.15, "sine", 0.3, 0.005, 0.05);
    }, i * 50));
  },
};

// ===== Music =====
// Simple ambient pads + step sequencer.  Each "track" is a list of chord
// voicings played at a given tempo, with a bass line.  Procedural — fits
// the existing art philosophy (everything synthesized at runtime).

interface MusicTrack {
  bpm: number;
  chords: { time: number; notes: number[] }[];
  bass: { time: number; note: number; dur: number }[];
  padFreq: number;
  padType: OscillatorType;
}

const TRACKS: Record<string, MusicTrack> = {
  battle: {
    bpm: 120,
    chords: [
      { time: 0, notes: [262, 330, 392] },   // C minor
      { time: 4, notes: [294, 370, 440] },   // D minor
      { time: 8, notes: [330, 415, 494] },   // E♭ major
      { time: 12, notes: [349, 440, 523] },  // F major
      { time: 16, notes: [392, 494, 587] },  // G major
      { time: 20, notes: [440, 554, 659] },  // A minor
    ],
    bass: [
      { time: 0, note: 131, dur: 0.45 },
      { time: 0.5, note: 196, dur: 0.2 },
      { time: 1, note: 165, dur: 0.45 },
      { time: 1.5, note: 196, dur: 0.2 },
      { time: 2, note: 131, dur: 0.45 },
      { time: 2.5, note: 196, dur: 0.2 },
      { time: 3, note: 165, dur: 0.45 },
    ],
    padFreq: 110,
    padType: "sawtooth",
  },
  boss: {
    bpm: 80,
    chords: [
      { time: 0, notes: [110, 138, 165] },   // low A minor
      { time: 8, notes: [98, 123, 147] },    // G minor
      { time: 16, notes: [82, 110, 130] },   // low E
      { time: 24, notes: [73, 98, 117] },    // low D
    ],
    bass: [
      { time: 0, note: 55, dur: 1.8 },
      { time: 2, note: 55, dur: 1.8 },
      { time: 4, note: 82, dur: 1.8 },
      { time: 6, note: 82, dur: 1.8 },
    ],
    padFreq: 55,
    padType: "sawtooth",
  },
  victory: {
    bpm: 100,
    chords: [
      { time: 0, notes: [523, 659, 784] },
      { time: 2, notes: [587, 740, 880] },
      { time: 4, notes: [659, 831, 988] },
      { time: 6, notes: [784, 988, 1175] },
    ],
    bass: [
      { time: 0, note: 262, dur: 0.9 },
      { time: 1, note: 294, dur: 0.9 },
      { time: 2, note: 330, dur: 0.9 },
      { time: 3, note: 392, dur: 0.9 },
    ],
    padFreq: 262,
    padType: "triangle",
  },
  defeat: {
    bpm: 60,
    chords: [
      { time: 0, notes: [330, 392, 466] },
      { time: 6, notes: [294, 349, 415] },
      { time: 12, notes: [262, 311, 370] },
    ],
    bass: [
      { time: 0, note: 165, dur: 2.5 },
      { time: 3, note: 147, dur: 2.5 },
      { time: 6, note: 131, dur: 2.5 },
    ],
    padFreq: 110,
    padType: "sine",
  },
  title: {
    bpm: 90,
    chords: [
      { time: 0, notes: [294, 370, 440] },
      { time: 4, notes: [330, 415, 494] },
      { time: 8, notes: [349, 440, 523] },
    ],
    bass: [
      { time: 0, note: 147, dur: 1.8 },
      { time: 2, note: 165, dur: 1.8 },
      { time: 4, note: 175, dur: 1.8 },
    ],
    padFreq: 147,
    padType: "sine",
  },
};

function startMusicLoop(trackKey: string) {
  if (!engine.ctx || !engine.musicGain) return;
  const track = TRACKS[trackKey];
  if (!track) return;
  const beatDur = 60 / track.bpm;
  const cycleDur = 32 * beatDur; // 32 beats per loop

  if (engine.musicTimer) {
    clearTimeout(engine.musicTimer);
    engine.musicTimer = null;
  }

  const schedule = (cycleStart: number) => {
    if (!engine.ctx || !engine.musicGain) return;
    if (currentTrackKey !== trackKey) return;
    // Chord pads
    for (const c of track.chords) {
      const t0 = cycleStart + c.time * beatDur;
      c.notes.forEach((f) => {
        const osc = engine.ctx!.createOscillator();
        const g = engine.ctx!.createGain();
        osc.type = track.padType;
        osc.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 0.4);
        g.gain.linearRampToValueAtTime(0.045, t0 + (cycleDur - c.time * beatDur) - 0.5);
        g.gain.linearRampToValueAtTime(0, t0 + (cycleDur - c.time * beatDur));
        osc.connect(g);
        g.connect(engine.musicGain!);
        osc.start(t0);
        osc.stop(t0 + (cycleDur - c.time * beatDur) + 0.1);
      });
    }
    // Bass plucks
    for (const b of track.bass) {
      const t0 = cycleStart + b.time * beatDur;
      const osc = engine.ctx!.createOscillator();
      const g = engine.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.value = b.note;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + b.dur);
      osc.connect(g);
      g.connect(engine.musicGain!);
      osc.start(t0);
      osc.stop(t0 + b.dur + 0.05);
    }
  };

  let cycleStart = engine.ctx.currentTime + 0.1;
  const loop = () => {
    if (!currentTrackKey || !engine.ctx) return;
    if (currentTrackKey !== trackKey) return;
    schedule(cycleStart);
    cycleStart += cycleDur;
    engine.musicTimer = window.setTimeout(loop, (cycleDur - 0.1) * 1000);
  };
  loop();
}

// ===== Public API =====

let currentTrackKey = "";

export const audio = {
  init(): boolean {
    const ctx = ensureContext();
    return !!ctx;
  },

  unlock(): void {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    engine.unlocked = true;
  },

  play(name: string): void {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const fn = SFX[name];
    if (fn) {
      try { fn(); } catch { /* ignore */ }
    }
  },

  startMusic(track: string): void {
    const ctx = ensureContext();
    if (!ctx || !TRACKS[track]) return;
    if (ctx.state === "suspended") ctx.resume();
    this.stopMusic();
    currentTrackKey = track;
    startMusicLoop(track);
  },

  stopMusic(): void {
    currentTrackKey = "";
    if (engine.musicTimer) {
      clearTimeout(engine.musicTimer);
      engine.musicTimer = null;
    }
  },

  setMusicVolume(v: number): void {
    engine.musicVolume = Math.max(0, Math.min(1, v));
    if (engine.musicGain) engine.musicGain.gain.value = engine.musicVolume;
  },

  setSfxVolume(v: number): void {
    engine.sfxVolume = Math.max(0, Math.min(1, v));
    if (engine.sfxGain) engine.sfxGain.gain.value = engine.sfxVolume;
  },

  get isReady(): boolean {
    return !!engine.ctx && engine.unlocked;
  },
};
