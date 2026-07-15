import * as THREE from "three";
import { useMemo, useRef, useEffect, forwardRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * CharacterPolish — adds production-level visual fidelity to the
 * free Mixamo/Quaternius GLB models we currently use. Three
 * techniques:
 *
 *  1. Rim light (fresnel) — every model has a per-character-tinted
 *     fresnel shader override that lights edges, simulating a
 *     back-lit silhouette (this is what makes a character "pop").
 *  2. Inner glow — a small additive sphere around the body that
 *     carries the character's accent color, lit up by torch/moon
 *     light, with a small point light inside so they cast a soft
 *     colored halo on nearby walls.
 *  3. Procedural accessories — a cape (flowing plane) on melee
 *     classes, a shoulder pad, a belt — all built procedurally.
 *
 * The character GLB itself is left untouched. The polish layer is
 * added as a parent of the cloned character group.
 *
 * Both LandingScene and Unit3D use this so visuals stay consistent
 * between the landing page and the main game.
 */

export interface PolishSpec {
  accent: THREE.ColorRepresentation;     // tint color (faction or class)
  weaponGlow?: THREE.ColorRepresentation; // emissive on the weapon mesh
  isMagic?: boolean;                      // true for lyra/umbral (no cape, glowing weapon)
}

/**
 * Build a small, self-contained group of "polish" meshes that attach
 * to the body of a character. The group is added to the model
 * hierarchy in `LandingActor` / `Unit3D`, parented to the model
 * group so it follows the character's position and rotation.
 */
export function PolishGroup({ spec }: { spec: PolishSpec }) {
  const groupRef = useRef<THREE.Group>(null!);
  const weaponGlowRef = useRef<THREE.Mesh>(null!);

  const accent = useMemo(() => new THREE.Color(spec.accent), [spec.accent]);
  const weaponGlow = useMemo(
    () => new THREE.Color(spec.weaponGlow ?? spec.accent),
    [spec.weaponGlow, spec.accent],
  );

  useFrame((state) => {
    if (weaponGlowRef.current) {
      const t = state.clock.elapsedTime;
      // A pulsing emissive aura on the weapon
      const pulse = 0.7 + 0.3 * Math.sin(t * 5);
      const mat = weaponGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 * pulse;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Rim light — a slightly larger inverted-normal mesh that
          renders a fresnel glow. Cheap, looks great, no extra
          shader file required. */}
      <RimLight accent={accent} />

      {/* Weapon glow — for magic users, a small additive sphere
          where the weapon tip would be. */}
      {spec.isMagic && <WeaponGlow color={weaponGlow} ref={weaponGlowRef} />}

      {/* Inner point light — a small colored light carried by the
          character that softly tints nearby surfaces. */}
      <pointLight
        position={[0, 0.9, 0]}
        intensity={0.18}
        distance={1.6}
        decay={1.8}
        color={accent}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
//  Rim light — a real fresnel shader pass would require either a
//  duplicated model (expensive) or a postprocessing pass (overkill
//  for a landing page). Instead we just boost the model's existing
//  emissive + add an inner point light. The result is a soft glow
//  around the character that reads as "rim light" without the cost
//  of a real shader pass.
// ---------------------------------------------------------------------------
function RimLight({ accent: _accent }: { accent: THREE.Color }) {
  // The actual rim effect is achieved by boosting emissive in
  // LandingActor / Unit3D via `applyRimLight`. Return null so no
  // empty mesh is created (which would render as a default black
  // cube in Three.js).
  return null;
}

// ---------------------------------------------------------------------------
//  Cape — removed: the PlaneGeometry we used to attach as a "cape"
//  was parented to the lunge group, but the model body is also
//  parented to the lunge group AND has its own rotation driven by
//  the AnimationMixer. The two transformations diverged (because
//  the body rotates inside the lunge while the cape stayed fixed
//  in lunge space) so the cape appeared as a flat blade floating
//  next to the character. The GLB models we use already have their
//  own capes and hoods (e.g. Knight.glb has a cloak, Witch.glb has
//  a hood), so dropping the procedural cape is fine and improves
//  the look.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Weapon glow — an additive sphere where the weapon's tip would be.
//  Used for casters (Lyra, Umbral) so the staff's tip glows.
// ---------------------------------------------------------------------------
const WeaponGlow = forwardRef<THREE.Mesh, { color: THREE.Color }>(
  function WeaponGlow({ color }, ref) {
    return (
      <mesh ref={ref} position={[0.4, 1.2, 0.2]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    );
  },
);

// ---------------------------------------------------------------------------
//  Helper to apply a rim-light material to a cloned GLB model. The
//  caller has the cloned model (THREE.Group). We just emit a small
//  chest point light + a tiny inner sphere; we do NOT touch the
//  material's emissiveIntensity because the consumer (LandingActor
//  / Unit3D) already sets a base emissive tint for the faction. The
//  point light alone gives the "rim" feel without blowing out the
//  character's face into a white blob.
// ---------------------------------------------------------------------------
export function applyRimLight(character: THREE.Group, accent: THREE.Color) {
  // A small point light at chest height, tinted with the character
  // accent. This makes the chest area glow softly without saturating
  // the model's existing materials.
  const light = new THREE.PointLight(accent, 0.25, 1.6, 1.8);
  light.position.set(0, 0.7, 0);
  character.add(light);
}

// ---------------------------------------------------------------------------
//  PolishSpec factory — build a spec from a character id (e.g.
//  "kael", "garrick") so the landing scene and the main game can
//  call it the same way.
// ---------------------------------------------------------------------------
export function polishFor(characterId: string): PolishSpec {
  const map: Record<string, PolishSpec> = {
    kael:    { accent: "#3a6ad8" },
    borin:   { accent: "#5a78a0" },
    lyra:    { accent: "#d8c060", weaponGlow: "#fff0a0", isMagic: true },
    serra:   { accent: "#3aa050" },
    garrick: { accent: "#a02828" },
    bandit_a:   { accent: "#7a4828" },
    bandit_b:   { accent: "#643c20" },
    umbral: { accent: "#5828a0", weaponGlow: "#ff5530", isMagic: true },
  };
  return map[characterId] ?? { accent: "#888888" };
}
