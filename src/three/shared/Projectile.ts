import * as THREE from "three";

/**
 * Projectile — a small, fast-flying visual effect used for cast
 * (fireballs, magic bolts) and ranged (arrows) attacks. Each
 * attack kind produces a different visual so the player can tell
 * attacks apart at a glance.
 *
 * Three kinds are supported:
 *   - "fireball" — a glowing red-orange sphere with a flame trail
 *   - "arrow"    — a long thin green cylinder (an arrow) with a streak
 *   - "spark"    — a small generic yellow sphere (fallback)
 *
 * The projectile is added to `parent` (usually the scene root), flies
 * along a quadratic Bezier arc from `start` to `end` over `duration`
 * seconds, then calls `onImpact` when it reaches the target and
 * self-destructs. The visual mesh is a separate THREE.Object3D
 * managed inside this module.
 */

export type ProjectileKind = "fireball" | "arrow" | "spark";

export interface ProjectileSpec {
  parent: THREE.Object3D;
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: THREE.Color;
  duration?: number;          // seconds; default 0.45
  kind?: ProjectileKind;      // default "fireball"
  onImpact?: () => void;
  onDone?: () => void;        // called after cleanup
  scene?: THREE.Scene;        // optional scene to register trail lights
}

/**
 * Spawn a projectile. Returns a handle with the underlying mesh and
 * an abort() to cancel the flight. The mesh is automatically removed
 * from the parent when the flight ends.
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

  // Attach a small point light so the projectile reads against the
  // dark background even when it's small.
  const light = new THREE.PointLight(spec.color, 1.8, 4, 1.6);
  mesh.add(light);

  // For arrows we orient the mesh along the travel direction so it
  // looks like a flying arrow rather than a vertical stick.
  const orient = (p: THREE.Vector3) => {
    if (kind === "arrow") {
      mesh.lookAt(p);
    }
  };
  orient(spec.end);

  const mid = spec.start.clone().add(spec.end).multiplyScalar(0.5);
  mid.y += 1.2; // arc up

  let aborted = false;
  let done = false;
  const t0 = performance.now();

  const trail: THREE.Vector3[] = [];
  const TRAIL_MAX = 8;

  const tick = () => {
    if (aborted || done) return;
    const now = performance.now();
    const t = (now - t0) / 1000;
    const k = Math.min(1, t / dur);
    // Quadratic Bezier curve
    const u = 1 - k;
    const p = spec.start.clone().multiplyScalar(u * u)
      .add(mid.clone().multiplyScalar(2 * u * k))
      .add(spec.end.clone().multiplyScalar(k * k));
    mesh.position.copy(p);
    if (kind === "arrow") mesh.lookAt(spec.end);

    // Trail: store last N positions and draw a faint line behind.
    if (trail.length === 0 || trail[trail.length - 1].distanceToSquared(p) > 0.04) {
      trail.push(p.clone());
      if (trail.length > TRAIL_MAX) trail.shift();
    }

    if (k >= 1) {
      // Impact!
      done = true;
      spec.onImpact?.();
      // Slight pause then clean up
      setTimeout(() => {
        mesh.removeFromParent();
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry?.dispose();
            const m = o.material as THREE.Material | THREE.Material[];
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m?.dispose();
          }
        });
        spec.onDone?.();
      }, 50);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    mesh,
    light,
    abort: () => {
      aborted = true;
      mesh.removeFromParent();
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m?.dispose();
        }
      });
    },
  };
}

function makeProjectileMesh(kind: ProjectileKind, color: THREE.Color): THREE.Object3D {
  if (kind === "arrow") {
    // A long thin cylinder (shaft) with a tip cone
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    shaft.rotation.x = Math.PI / 2;
    grp.add(shaft);
    // Fletching — three small fins
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
  // fireball: a glowing red-orange sphere with an outer flame shell
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  grp.add(core);
  // Flame outer shell
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff8030),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  grp.add(flame);
  return grp;
}

/**
 * SlashTrail — a brief glowing arc that appears at a melee impact
 * point. Built from a thin curved arc (a partial torus segment).
 * It brightens, then fades over `duration` seconds.
 */
export function spawnSlashTrail(parent: THREE.Object3D, at: THREE.Vector3, color: THREE.Color = new THREE.Color(0xfff0a0), duration: number = 0.35) {
  // Build an arc — a small partial torus lying flat in the horizontal
  // plane, oriented to face the direction of the strike. We default
  // to facing +X (east) and let the caller adjust if needed.
  const arcGeo = new THREE.TorusGeometry(0.7, 0.04, 6, 24, Math.PI * 0.6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.0,           // start invisible
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const arc = new THREE.Mesh(arcGeo, mat);
  arc.position.copy(at);
  arc.position.y = 0.9;     // chest height
  arc.rotation.x = -Math.PI / 2;
  parent.add(arc);
  const t0 = performance.now();
  let done = false;
  const tick = () => {
    if (done) return;
    const t = (performance.now() - t0) / 1000;
    const k = Math.min(1, t / duration);
    // Quick rise then fade
    if (k < 0.15) {
      mat.opacity = (k / 0.15) * 0.9;
    } else {
      mat.opacity = 0.9 * (1 - (k - 0.15) / 0.85);
    }
    // Slight expand
    arc.scale.setScalar(1 + k * 0.3);
    if (k < 1) requestAnimationFrame(tick);
    else {
      done = true;
      arc.removeFromParent();
      arcGeo.dispose();
      mat.dispose();
    }
  };
  requestAnimationFrame(tick);
  return { mesh: arc, dispose: () => { done = true; arc.removeFromParent(); arcGeo.dispose(); mat.dispose(); } };
}
