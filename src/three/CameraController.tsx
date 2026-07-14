import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../game/store";

type DragMode = "none" | "rotate" | "pan";

export function CameraController({ w, h }: { w: number; h: number }) {
  const { camera, gl } = useThree();
  const shakeAmount = useRef(0), prevShake = useRef(0), combatZoom = useRef(0);
  const azimuth = useRef(0), elevation = useRef(0.85), distance = useRef(h * 1.1);
  const panX = useRef(0), panZ = useRef(0);
  const dragMode = useRef<DragMode>("none"), lastPointer = useRef({ x: 0, y: 0 });
  const potentialDrag = useRef<{ x: number; y: number; button: number; shift: boolean } | null>(null);
  const DRAG_THRESHOLD = 12;
  const cx = (w - 1) / 2, cz = (h - 1) / 2;

  useFrame(() => {
    const st = useGame.getState();
    if (st.screenShake > 0 && st.screenShake !== prevShake.current) { shakeAmount.current = Math.max(shakeAmount.current, st.screenShake); prevShake.current = st.screenShake; }
    if (shakeAmount.current > 0.01) shakeAmount.current *= 0.88; else shakeAmount.current = 0;
    const tz = st.activeCombat ? 1 : 0; combatZoom.current = THREE.MathUtils.lerp(combatZoom.current, tz, 0.06);
    const z = combatZoom.current;
    const dist = distance.current * (1 - z * 0.6), el = elevation.current - z * 0.3;
    let fx = cx + panX.current, fz = cz + panZ.current;
    if (st.activeCombat && z > 0.15) { const a = st.activeCombat.attacker.pos, d = st.activeCombat.defender.pos; fx = (a.x + d.x) / 2; fz = (a.y + d.y) / 2; }
    const camX = fx + Math.sin(azimuth.current) * Math.cos(el) * dist, camY = Math.sin(el) * dist, camZ = fz + Math.cos(azimuth.current) * Math.cos(el) * dist;
    camera.position.set(camX + (Math.random()-0.5)*shakeAmount.current, camY + (Math.random()-0.5)*shakeAmount.current, camZ);
    camera.lookAt(fx, 0.5, fz);
  });

  const setup = gl.domElement;
  if (!(setup as any).__camInit) {
    (setup as any).__camInit = true;
    const dom = gl.domElement;
    const onPD = (e: PointerEvent) => { potentialDrag.current = { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey }; };
    const onPM = (e: PointerEvent) => {
      if (dragMode.current === "none" && potentialDrag.current) {
        const pd = potentialDrag.current; const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          if (pd.button === 2 || pd.button === 1 || (pd.button === 0 && pd.shift)) dragMode.current = "rotate";
          else if (pd.button === 0) dragMode.current = "pan";
          lastPointer.current = { x: e.clientX, y: e.clientY };
        }
      }
      if (dragMode.current === "none") return;
      const dx = e.clientX - lastPointer.current.x, dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (dragMode.current === "rotate") { azimuth.current -= dx * 0.006; elevation.current = THREE.MathUtils.clamp(elevation.current + dy * 0.004, 0.15, 1.35); }
      else if (dragMode.current === "pan") { const cosA = Math.cos(azimuth.current), sinA = Math.sin(azimuth.current); const ps = distance.current * 0.0015; panX.current -= (dx*cosA+dy*sinA)*ps; panZ.current -= (-dx*sinA+dy*cosA)*ps; panX.current = THREE.MathUtils.clamp(panX.current, -w*0.4, w*0.4); panZ.current = THREE.MathUtils.clamp(panZ.current, -h*0.4, h*0.4); }
    };
    const onPU = () => { dragMode.current = "none"; potentialDrag.current = null; };
    const onW = (e: WheelEvent) => { distance.current = THREE.MathUtils.clamp(distance.current + e.deltaY * 0.01, h * 0.5, h * 2.5); e.preventDefault(); };
    const onCtx = (e: Event) => e.preventDefault();
    let tMode: "none"|"pan"|"gesture" = "none"; let lTD = 0; let lTC = { x: 0, y: 0 }; let lST = { x: 0, y: 0 }; let stMoved = false;
    const onTS = (e: TouchEvent) => { if (e.touches.length === 1) { tMode = "pan"; lST = { x: e.touches[0].clientX, y: e.touches[0].clientY }; stMoved = false; } else if (e.touches.length === 2) { tMode = "gesture"; const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; lTD = Math.hypot(dx, dy); lTC = { x: (e.touches[0].clientX + e.touches[1].clientX)/2, y: (e.touches[0].clientY + e.touches[1].clientY)/2 }; e.preventDefault(); } };
    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 1 && tMode === "pan") { const dx = e.touches[0].clientX - lST.x, dy = e.touches[0].clientY - lST.y; if (Math.hypot(dx,dy) > DRAG_THRESHOLD) stMoved = true; if (stMoved) { const cosA = Math.cos(azimuth.current), sinA = Math.sin(azimuth.current); const ps = distance.current*0.0015; panX.current -= (dx*cosA+dy*sinA)*ps; panZ.current -= (-dx*sinA+dy*cosA)*ps; panX.current = THREE.MathUtils.clamp(panX.current,-w*0.4,w*0.4); panZ.current = THREE.MathUtils.clamp(panZ.current,-h*0.4,h*0.4); lST = { x: e.touches[0].clientX, y: e.touches[0].clientY }; e.preventDefault(); } }
      else if (e.touches.length === 2 && tMode === "gesture") { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.hypot(dx, dy); const cx2 = (e.touches[0].clientX+e.touches[1].clientX)/2, cy2 = (e.touches[0].clientY+e.touches[1].clientY)/2; const ddx = cx2 - lTC.x, ddy = cy2 - lTC.y; azimuth.current -= ddx*0.006; elevation.current = THREE.MathUtils.clamp(elevation.current+ddy*0.004,0.15,1.35); distance.current = THREE.MathUtils.clamp(distance.current*(lTD/dist),h*0.5,h*2.5); lTD = dist; lTC = { x: cx2, y: cy2 }; e.preventDefault(); }
    };
    const onTE = (e: TouchEvent) => { if (e.touches.length < 2) tMode = "none"; };
    dom.addEventListener("pointerdown", onPD); dom.addEventListener("pointermove", onPM); window.addEventListener("pointerup", onPU); window.addEventListener("pointercancel", onPU); dom.addEventListener("wheel", onW, { passive: false }); dom.addEventListener("contextmenu", onCtx); dom.addEventListener("touchstart", onTS, { passive: false }); dom.addEventListener("touchmove", onTM, { passive: false }); dom.addEventListener("touchend", onTE);
  }

  return null;
}
