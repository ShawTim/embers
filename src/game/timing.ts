const MIN_E2E_SCALE = 0.01;
const MAX_E2E_SCALE = 1;

export function parseE2ETimingScale(search: string): number {
  const raw = new URLSearchParams(search).get("e2eSpeed");
  if (!raw) return 1;
  const scale = Number(raw);
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_E2E_SCALE, Math.max(MIN_E2E_SCALE, scale));
}

export function runtimeDelay(ms: number): number {
  if (!import.meta.env.DEV || typeof window === "undefined") return ms;
  return Math.max(1, Math.round(ms * parseE2ETimingScale(window.location.search)));
}
