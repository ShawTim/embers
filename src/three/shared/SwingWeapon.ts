import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * SwingWeapon — shared melee-animation helpers used by both the landing
 * page (LandingScene) and the main game (Unit3D).
 *
 * The bone-rigged weapons inside the GLBs can't be rotated directly
 * (their rotation is owned by the AnimationMixer). To get a clear
 * visible weapon swing we always attach a stand-alone weapon mesh to
 * the right hand of the cloned model. This mesh is parented to the
 * model body but NOT to a bone, so we can freely set its rotation
 * during the swing without fighting the skeleton.
 *
 * The body itself is also subject to GLB idle-animation drift (e.g.
 * the Idle_A clip in some rigs has a -π headstand frame). To prevent
 * that we expose two manual override fields (leanX, leanZ) on the
 * Combatant that the consumer's useFrame applies AFTER the mixer
 * runs each frame. During melee, the swing animation sets these; when
 * the swing is over, the consumer resets them to 0.
 */

export const SWING_DUR = 0.5;          // total length of a swing
export const TARGET_HEIGHT = 1.6;      // same constant the GLBs use
const SWING_WEAPON_NAME = "swingWeapon";

export type WeaponKind = "sword" | "lance" | "axe" | "bow" | "staff" | "fire";

export interface SwingState {
  weapon: THREE.Object3D | null;
  leanX: number;             // manual body.rotation.x override
  leanZ: number;             // manual body.rotation.z override
  kind: WeaponKind;          // weapon type (drives animation + mesh)
  orbColor?: number;         // glow orb color for staff/fire casters
}

const STEEL = new THREE.MeshStandardMaterial({ color: 0xdde0e8, metalness: 0.9, roughness: 0.2 });
const WOOD_DARK = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, roughness: 0.9 });
const WOOD_BROWN = new THREE.MeshStandardMaterial({ color: 0x6e3a18, roughness: 0.7 });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xc8a850, metalness: 0.7, roughness: 0.3 });

function makeSword(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.04), STEEL);
  blade.position.y = 0.4;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), STEEL);
  tip.position.y = 0.86;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), WOOD_BROWN);
  guard.position.y = 0.04;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6), WOOD_DARK);
  hilt.position.y = -0.08;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), GOLD);
  pommel.position.y = -0.2;
  g.add(blade, tip, guard, hilt, pommel);
  return g;
}

function makeLance(): THREE.Group {
  const g = new THREE.Group();
  // Long thin shaft + steel spearhead
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6),
    WOOD_BROWN,
  );
  shaft.position.y = 0.6;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.32, 4),
    STEEL,
  );
  head.position.y = 1.55;
  // Small flag/streamer just below the head
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xaa2030, side: THREE.DoubleSide, roughness: 0.7 }),
  );
  flag.position.set(0, 1.3, 0.05);
  g.add(shaft, head, flag);
  return g;
}

function makeAxe(): THREE.Group {
  const g = new THREE.Group();
  // Wooden haft
  const haft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 1.1, 6),
    WOOD_BROWN,
  );
  haft.position.y = 0.5;
  // Steel axe head — a flat curved blade attached to the side
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.22, 0.06),
    STEEL,
  );
  head.position.set(0.1, 1.0, 0);
  head.rotation.z = 0.15;
  // Top spike (back of axe head)
  const back = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.18, 4),
    STEEL,
  );
  back.position.set(-0.08, 1.05, 0);
  back.rotation.z = -0.6;
  g.add(haft, head, back);
  return g;
}

function makeBow(): THREE.Group {
  const g = new THREE.Group();
  // Curved bow stave — a thin curved cylinder approximation
  const stave = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6),
    WOOD_BROWN,
  );
  stave.position.set(0, 0.6, 0);
  stave.rotation.z = 0.05;
  // Bowstring
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 1.15, 4),
    new THREE.MeshStandardMaterial({ color: 0xeeeec8 }),
  );
  string.position.set(0, 0.6, 0.05);
  string.rotation.z = 0.05;
  // Nocked arrow (resting on the bow)
  const arrow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4),
    WOOD_DARK,
  );
  arrow.position.set(0.05, 0.45, 0.08);
  arrow.rotation.z = Math.PI / 2;
  const arrowHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.08, 4),
    STEEL,
  );
  arrowHead.position.set(0.5, 0.45, 0.08);
  arrowHead.rotation.z = -Math.PI / 2;
  g.add(stave, string, arrow, arrowHead);
  return g;
}

function makeStaff(orbColor: number): THREE.Group {
  const g = new THREE.Group();
  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.7 }),
  );
  staff.position.y = 0.7;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshStandardMaterial({
      color: orbColor,
      emissive: orbColor,
      emissiveIntensity: 2.0,
    }),
  );
  orb.position.y = 1.45;
  g.add(staff, orb);
  return g;
}

/**
 * Attach a stand-alone weapon to the right hand of the model. Returns
 * a SwingState the caller stores on the combatant.
 *
 * The weapon kind drives BOTH the visible mesh AND the swing/animation
 * behavior used by the dispatch logic. We pass `kind` explicitly so
 * every consumer (LandingScene, Unit3D) agrees on the same vocabulary.
 *
 * For staff / fire casters we add a glowing orb at the tip.
 *
 * Call this once in the GLB clone useEffect, after the model has
 * been centered and scaled to TARGET_HEIGHT.
 */
export function attachSwingWeapon(
  body: THREE.Group,
  kind: WeaponKind,
  opts: { orbColor?: number; leftHand?: boolean } = {},
): SwingState {
  const weaponGroup = new THREE.Group();
  weaponGroup.name = SWING_WEAPON_NAME;
  let mesh: THREE.Group;
  let orb: number | undefined;
  switch (kind) {
    case "lance": mesh = makeLance(); break;
    case "axe":   mesh = makeAxe(); break;
    case "bow":   mesh = makeBow(); break;
    case "staff": mesh = makeStaff(opts.orbColor ?? 0xfff0a0); orb = opts.orbColor ?? 0xfff0a0; break;
    case "fire":  mesh = makeStaff(opts.orbColor ?? 0xff5530); orb = opts.orbColor ?? 0xff5530; break;
    case "sword":
    default:      mesh = makeSword();
  }
  weaponGroup.add(mesh);
  // Bows are held in the left hand; everything else right hand.
  if (kind === "bow") {
    weaponGroup.position.set(-0.4, 0.6, 0.25);
    weaponGroup.rotation.y = Math.PI; // face the arrow forward
  } else {
    weaponGroup.position.set(0.4, 0.6, 0.25);
  }
  body.add(weaponGroup);
  return { weapon: weaponGroup, leanX: 0, leanZ: 0, kind, orbColor: orb };
}

/**
 * Run a single melee attack on a combatant. The combatant must have
 * a `body`, a `lunge` group (used to translate the model during the
 * step), a `slot` [x, z], a `swing` SwingState (from
 * attachSwingWeapon), and a `targetRotY` / `curRotY` pair.
 *
 * The animation has four phases for a more natural feel:
 *   1. wind-up  (0.00..0.20) — pull back, raise weapon, lean back
 *   2. thrust   (0.20..0.36) — step forward, slash down (impact at 0.28)
 *   3. follow   (0.36..0.65) — over-swing the weapon and lean forward
 *   4. recover  (0.65..0.80) — return to slot
 *
 * The body's leanX / leanZ are written to `state.leanX/Z` so the
 * caller's useFrame can apply them AFTER the mixer runs, ensuring
 * the GLB idle animation can't push the body into a weird pose.
 *
 * `onImpact` is called at the moment the weapon lands (k≈0.28).
 */
export function animateMelee(opts: {
  body: THREE.Group;
  lunge: THREE.Group;
  slot: [number, number];
  hitX: number;
  hitZ: number;
  state: SwingState;
  onImpact?: () => void;
  onDone?: () => void;
}) {
  const { body, lunge, slot, hitX, hitZ, state, onImpact, onDone } = opts;
  const sx = slot[0], sz = slot[1];
  const t0 = performance.now();
  let impactFired = false;
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    // 0.80s total — longer than the original 0.5s for a more readable,
    // less frantic swing.
    const k = Math.min(1, t / 0.80);
    let x: number, z: number;
    if (k < 0.20) {
      // Wind-up — step BACK before stepping forward. Body leans back.
      const u = k / 0.20;
      const e = 1 - Math.pow(1 - u, 3); // ease-out cubic
      x = sx + (-0.28) * e;
      z = sz;
    } else if (k < 0.36) {
      // Thrust — step forward to the target. Body leans forward.
      const u = (k - 0.20) / 0.16;
      const e = 1 - Math.pow(1 - u, 3);
      x = sx + (hitX - sx) * e - 0.28 * (1 - e);
      z = sz + (hitZ - sz) * e;
    } else if (k < 0.65) {
      // Follow-through — push slightly past the target, body still leaning
      const u = (k - 0.36) / 0.29;
      const e = 1 - Math.pow(1 - u, 2);
      x = hitX + (sx - hitX) * 0.85 * e;
      z = hitZ + (sz - hitZ) * 0.85 * e;
    } else {
      // Recover — return to slot
      const u = (k - 0.65) / 0.35;
      const e = 1 - Math.pow(1 - u, 2);
      x = hitX + (sx - hitX) * e;
      z = hitZ + (sz - hitZ) * e;
    }
    lunge.position.x = x - sx;
    lunge.position.z = z - sz;
    // Weapon + body lean (the wind-up → thrust → follow-through arc)
    // Easing is sharpened so the strike feels snappy but the
    // follow-through is smooth.
    let rx = 0, rz = 0, bodyLeanX = 0, bodyLeanZ = 0;
    if (k < 0.20) {
      const u = k / 0.20;
      const e = 1 - Math.pow(1 - u, 3);
      rx = -1.5 * e;             // weapon: arm back & up
      rz = -0.7 * e;             // weapon: twist back
      bodyLeanX = -0.18 * e;     // body: lean back
    } else if (k < 0.36) {
      const u = (k - 0.20) / 0.16;
      const e = 1 - Math.pow(1 - u, 2);
      rx = -1.5 + 3.2 * e;       // weapon: slash forward (big arc)
      rz = -0.7 + 2.0 * e;       // weapon: twist through
      bodyLeanX = -0.18 + 0.32 * e; // body: lean into strike
      if (!impactFired && k > 0.27) {
        impactFired = true;
        onImpact?.();
      }
    } else if (k < 0.65) {
      const u = (k - 0.36) / 0.29;
      const e = 1 - Math.pow(1 - u, 2);
      rx = 1.7 - 0.6 * e;        // weapon: overshoot then settle
      rz = 1.3 - 0.4 * e;
      bodyLeanX = 0.14 - 0.05 * e; // body: hold forward, then ease up
    } else {
      const u = (k - 0.65) / 0.35;
      const e = 1 - u;
      rx = 1.1 * e;              // weapon: return to rest
      rz = 0.9 * e;
      bodyLeanX = 0.09 * e;
    }
    state.leanX = bodyLeanX;
    state.leanZ = bodyLeanZ;
    if (state.weapon) {
      state.weapon.rotation.x = rx;
      state.weapon.rotation.z = rz;
    }
    if (k < 1) {
      requestAnimationFrame(tick);
    } else {
      // Return to rest
      lunge.position.x = 0;
      lunge.position.z = 0;
      state.leanX = 0;
      state.leanZ = 0;
      if (state.weapon) {
        state.weapon.rotation.x = 0;
        state.weapon.rotation.z = 0;
      }
      onDone?.();
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Apply the manual lean override to a body. Call this from the
 * consumer's useFrame AFTER the AnimationMixer runs so the GLB idle
 * animation can't push the body into a weird pose. Lean values are
 * in radians on the X and Z axes of the body.
 */
export function applyManualLean(body: THREE.Group, leanX: number, leanZ: number) {
  body.rotation.x = leanX;
  body.rotation.z = leanZ;
}
