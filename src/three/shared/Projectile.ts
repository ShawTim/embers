import * as THREE from "three";

// ---------------------------------------------------------------------------
//  Projectile — a small, fast-flying visual effect used for cast
//  (fireballs, magic bolts) and ranged (arrows) attacks.
//
//  Performance note: this used to use a per-projectile requestAnimationFrame
//  loop, which created 1 rAF handle per attack (up to 8 active at once on
//  the landing page). Each loop also allocated 3× Vector3 per frame for
//  the bezier math. We now drive all active projectiles from a single
//  shared registry, updated by `tickProjectiles(dt)` which the caller
//  should call inside their r3f useFrame hook. This:
//    - removes all rAF overhead (no double-frame cost)
//    - removes all per-frame Vector3.clone() allocations
//    - lets us clamp to 1 frame per r3f frame instead of 1 per RAF tick
// ---------------------------------------------------------------------------

export type ProjectileKind = "fireball" | "arrow" | "spark";

export interface ProjectileSpec {
  parent: THREE.Object3D;
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: THREE.Color;
  duration?: number;          // seconds; default 0.45
  kind?: ProjectileKind;      // default "fireball"
  onImpact?: () => void;
  onDone?: () => void;
}

// Active projectile registry. Updated by tickProjectiles() once per
// r3f frame.
interface ActiveProjectile {
  mesh: THREE.Object3D;
  light?: THREE.PointLight;
  start: THREE.Vector3;
  mid: THREE.Vector3;
  end: THREE.Vector3;
  dur: number;
  t: number;        // seconds since spawn
  kind: ProjectileKind;
  aborted: boolean;
  done: boolean;
  // Trail
  trail: THREE.Vector3[]; // last N positions
  trailMax: number;
  onImpact?: () => void;
  onDone?: () => void;
  // For clean up: deferred until next frame after onImpact
  cleanupAt: number;       // performance.now() ms
}

const ACTIVE: ActiveProjectile[] = [];

// Reusable scratch vectors so the bezier calc doesn't allocate.
const _p = new THREE.Vector3();
const _u = new THREE.Vector3();
const _m = new THREE.Vector3();
const _e = new THREE.Vector3();

/**
 * Spawn a projectile. The caller must call `tickProjectiles(delta)` in
 * a useFrame hook for the flight to progress. Returns the mesh + an
 * abort() handle.
 */
export function spawnProjectile(spec: ProjectileSpec): {
  mesh: THREE.Object3D;
  light?: THREE.PointLight;
  abort: () => void;
} {
  const dur = spec.duration ?? 0.45;
  const kind: ProjectileKind = spec.kind ?? "fireball";
  const mesh = makeProjectileMesh(kind, spec.color);
  mesh.position.copy(spec.start);
  spec.parent.add(mesh);

  const light = new THREE.PointLight(spec.color, 1.8, 4, 1.6);
  mesh.add(light);

  // For arrows we orient the mesh toward the target so it looks like a
  // flying arrow rather than a vertical stick.
  if (kind === "arrow") mesh.lookAt(spec.end);

  const mid = new THREE.Vector3(
    (spec.start.x + spec.end.x) * 0.5,
    (spec.start.y + spec.end.y) * 0.5 + 1.2,
    (spec.start.z + spec.end.z) * 0.5,
  );

  const entry: ActiveProjectile = {
    mesh,
    light,
    start: spec.start.clone(),
    mid,
    end: spec.end.clone(),
    dur,
    t: 0,
    kind,
    aborted: false,
    done: false,
    trail: [],
    trailMax: 8,
    onImpact: spec.onImpact,
    onDone: spec.onDone,
    cleanupAt: 0,
  };
  ACTIVE.push(entry);
  return {
    mesh,
    light,
    abort: () => {
      if (entry.done) return;
      entry.aborted = true;
      mesh.removeFromParent();
      disposeMesh(mesh);
    },
  };
}

export function tickProjectiles(delta: number) {
  const now = performance.now();
  for (let i = ACTIVE.length - 1; i >= 0; i--) {
    const p = ACTIVE[i];
    if (p.aborted) { ACTIVE.splice(i, 1); continue; }
    if (p.done) {
      // Impact already fired, waiting for the 50ms cleanup delay
      if (now >= p.cleanupAt) {
        p.mesh.removeFromParent();
        disposeMesh(p.mesh);
        p.onDone?.();
        ACTIVE.splice(i, 1);
      }
      continue;
    }
    p.t += delta;
    const k = Math.min(1, p.t / p.dur);
    // Quadratic bezier in scratch vectors
    const u = 1 - k;
    _p.copy(p.start).multiplyScalar(u * u);
    _m.copy(p.mid).multiplyScalar(2 * u * k);
    _e.copy(p.end).multiplyScalar(k * k);
    _p.add(_m).add(_e);
    p.mesh.position.copy(_p);
    if (p.kind === "arrow") p.mesh.lookAt(p.end);

    if (
      p.trail.length === 0 ||
      p.trail[p.trail.length - 1].distanceToSquared(_p) > 0.04
    ) {
      p.trail.push(_p.clone());
      if (p.trail.length > p.trailMax) p.trail.shift();
    }

    if (k >= 1) {
      p.done = true;
      p.onImpact?.();
      p.cleanupAt = now + 50;
    }
  }
}

function disposeMesh(mesh: THREE.Object3D) {
  mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m?.dispose();
    }
  });
}

function makeProjectileMesh(kind: ProjectileKind, color: THREE.Color): THREE.Object3D {
  if (kind === "arrow") {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    shaft.rotation.x = Math.PI / 2;
    grp.add(shaft);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.08),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
      );
      fin.position.set(0, 0, -0.25);
      fin.rotation.z = (i / 3) * Math.PI * 2;
      grp.add(fin);
    }
    return grp;
  }
  if (kind === "spark") {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
  }
  // fireball: glowing red-orange sphere with an outer flame shell
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  grp.add(core);
  const flameColor = new THREE.Color(0xff8030);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshBasicMaterial({
      color: flameColor,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  grp.add(flame);
  return grp;
}

// ---------------------------------------------------------------------------
//  SlashTrail — a brief glowing arc at a melee impact point.
//  Same refactor: driven by `tickSlashTrails(delta)` instead of rAF.
// ---------------------------------------------------------------------------

interface ActiveTrail {
  arc: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  geo: THREE.TorusGeometry;
  t0: number;
  duration: number;
  done: boolean;
}

const TRAILS: ActiveTrail[] = [];

export function spawnSlashTrail(
  parent: THREE.Object3D,
  at: THREE.Vector3,
  color: THREE.Color = new THREE.Color(0xfff0a0),
  duration: number = 0.35,
) {
  const geo = new THREE.TorusGeometry(0.7, 0.04, 6, 24, Math.PI * 0.6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const arc = new THREE.Mesh(geo, mat);
  arc.position.copy(at);
  arc.position.y = 0.9;
  arc.rotation.x = -Math.PI / 2;
  parent.add(arc);
  TRAILS.push({ arc, mat, geo, t0: performance.now() / 1000, duration, done: false });
  return {
    mesh: arc,
    dispose: () => {
      arc.removeFromParent();
      geo.dispose();
      mat.dispose();
      const idx = TRAILS.findIndex((t) => t.arc === arc);
      if (idx >= 0) TRAILS.splice(idx, 1);
    },
  };
}

export function tickSlashTrails(_delta: number) {
  const now = performance.now() / 1000;
  for (let i = TRAILS.length - 1; i >= 0; i--) {
    const tr = TRAILS[i];
    if (tr.done) continue;
    const t = now - tr.t0;
    const k = Math.min(1, t / tr.duration);
    if (k < 0.15) tr.mat.opacity = (k / 0.15) * 0.9;
    else tr.mat.opacity = 0.9 * (1 - (k - 0.15) / 0.85);
    tr.arc.scale.setScalar(1 + k * 0.3);
    if (k >= 1) {
      tr.done = true;
      tr.arc.removeFromParent();
      tr.geo.dispose();
      tr.mat.dispose();
      TRAILS.splice(i, 1);
    }
  }
}
