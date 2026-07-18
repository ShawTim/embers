import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { audio } from "./engine";

// We need to provide a minimal Web Audio mock for the engine to operate
// against.  In headless environments the AudioContext may exist but the
// context.state may be "suspended"; we just want to make sure all the
// exported SFX names and music tracks can be called without throwing.

class MockGainNode {
  gain = { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  connect(_n: any) { return _n; }
  disconnect() {}
}
class MockOscillator {
  type: OscillatorType = "sine";
  frequency = { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  connect(_n: any) { return _n; }
  start() {} stop() {}
}
class MockBufferSource {
  buffer: AudioBuffer | null = null;
  connect(_n: any) { return _n; }
  start() {} stop() {}
}
class MockBiquadFilter {
  type: BiquadFilterType = "lowpass";
  frequency = { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  Q = { value: 0 };
  connect(_n: any) { return _n; }
}
class MockConvolver {
  buffer: AudioBuffer | null = null;
  connect(_n: any) { return _n; }
}
class MockBuffer implements AudioBuffer {
  length = 0;
  duration = 0;
  sampleRate = 44100;
  numberOfChannels = 1;
  getChannelData(_ch: number) { return new Float32Array(0); }
  copyFromChannel() {} copyToChannel() {}
}

class MockAudioContext {
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  createGain() { return new MockGainNode() as any; }
  createOscillator() { return new MockOscillator() as any; }
  createBufferSource() { return new MockBufferSource() as any; }
  createBiquadFilter() { return new MockBiquadFilter() as any; }
  createConvolver() { return new MockConvolver() as any; }
  createBuffer(_ch: number, len: number, sr: number) { return new MockBuffer(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

beforeEach(() => {
  (globalThis as any).AudioContext = MockAudioContext;
  // Provide a window-like object for the engine's setTimeout calls
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.AudioContext = MockAudioContext;
  (globalThis as any).window.webkitAudioContext = MockAudioContext;
  (globalThis as any).window.setTimeout = setTimeout;
  (globalThis as any).window.clearTimeout = clearTimeout;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("audio engine", () => {
  it("init() returns true when AudioContext is available", () => {
    expect(audio.init()).toBe(true);
  });

  it("unlock() is idempotent", () => {
    audio.init();
    audio.unlock();
    audio.unlock();
    expect(audio.isReady).toBe(true);
  });

  it("play() does not throw for every SFX name", () => {
    audio.init();
    audio.unlock();
    const names = [
      "select", "hit_sword", "hit_axe", "hit_lance", "fire", "ice",
      "lightning", "dark", "heal", "crit", "step", "dialogue_tick",
      "menu", "boss_intro", "death", "victory", "defeat", "move",
      "cannot_act", "level_up",
    ];
    for (const n of names) {
      expect(() => audio.play(n)).not.toThrow();
    }
  });

  it("play() is a no-op for unknown names", () => {
    audio.init();
    expect(() => audio.play("totally-unknown-sfx")).not.toThrow();
  });

  it("startMusic + stopMusic do not throw", () => {
    audio.init();
    for (const t of ["title", "battle", "boss", "victory", "defeat"]) {
      expect(() => audio.startMusic(t)).not.toThrow();
    }
    expect(() => audio.stopMusic()).not.toThrow();
  });

  it("startMusic for unknown track is a no-op", () => {
    audio.init();
    expect(() => audio.startMusic("nope")).not.toThrow();
  });

  it("setSfxVolume / setMusicVolume clamp to [0,1]", () => {
    audio.init();
    expect(() => audio.setSfxVolume(-0.5)).not.toThrow();
    expect(() => audio.setSfxVolume(1.5)).not.toThrow();
    expect(() => audio.setSfxVolume(0.4)).not.toThrow();
    expect(() => audio.setMusicVolume(0.2)).not.toThrow();
  });
});
