import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";

// ---------------------------------------------------------------------------
//  useSlowMo — runs a callback each frame with a time-scaled delta.  The
//  game's `timeScale` is set to 0.25 on a crit for 280ms; everything that
//  uses this hook (mixer.update, idle breathing, projectile steps) will
//  automatically run slower during the brief slow-motion beat.
// ---------------------------------------------------------------------------

export function useSlowMo(cb: (scaledDelta: number) => void) {
  useFrame((state, delta) => {
    const st = useGame.getState();
    const now = performance.now();
    let scale = st.timeScale;
    if (st.slowMoUntil && now >= st.slowMoUntil) {
      // Slow-mo expired — restore normal speed and reset the latch.
      scale = 1;
      if (st.timeScale !== 1) {
        useGame.setState({ timeScale: 1, slowMoUntil: 0 });
      }
    }
    cb(delta * scale);
  });
}
