import * as THREE from "three";

// ---------------------------------------------------------------------------
//  HoverShader — animated rim / scanline overlay for the currently
//  hovered or selected tile.
//
//  Returns a transparent ShaderMaterial that you can slap on a plane
//  that lives just above the tile.  The plane itself is supplied by
//  the caller; the shader just makes it look good.
//
//  The shader has three modes:
//    0  = hover   — white pulse + moving scanline
//    1  = move    — blue steady + corner brackets
//    2  = attack  — red pulse + radial ripple
//    3  = select  — gold steady + rotating ring
//
//  Time is provided per-frame via material.uniforms.uTime.value.
// ---------------------------------------------------------------------------

export type HoverMode = "hover" | "move" | "attack" | "select";

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform int uMode;
uniform float uAlpha;

vec3 MODE_HOVER  = vec3(0.55, 0.85, 1.00);
vec3 MODE_MOVE   = vec3(0.30, 0.65, 1.00);
vec3 MODE_ATTACK = vec3(1.00, 0.30, 0.20);
vec3 MODE_SELECT = vec3(1.00, 0.85, 0.30);

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float d = length(c);
  // Square bracket mask
  float bx = step(0.45, abs(uv.x - 0.5)) * step(abs(uv.y - 0.5), 0.10);
  float by = step(0.45, abs(uv.y - 0.5)) * step(abs(uv.x - 0.5), 0.10);
  float bracket = max(bx, by);
  // Inset box rim
  float rimDist = 0.46;
  float rim = smoothstep(0.02, 0.0, abs(d - rimDist));
  // Scanline
  float scan = smoothstep(0.0, 0.5, sin((uv.y - uTime * 0.7) * 25.0) * 0.5 + 0.5);
  scan = pow(scan, 6.0) * 0.3;
  // Pulse
  float pulse = 0.7 + 0.3 * sin(uTime * 4.0);
  // Radial ripple
  float ripple = sin(d * 30.0 - uTime * 5.0);
  ripple = smoothstep(0.85, 1.0, ripple) * (1.0 - smoothstep(0.5, 0.5, d));
  // Rotating ring (select)
  float ang = atan(c.y, c.x);
  float rotRing = smoothstep(0.0, 0.5, sin(ang * 6.0 + uTime * 2.0)) * smoothstep(0.0, 0.05, abs(d - 0.40));

  vec3 col;
  float alpha = 0.0;
  if (uMode == 0) {
    // hover
    col = MODE_HOVER;
    alpha = (rim * 0.6 + scan * 0.5) * pulse;
  } else if (uMode == 1) {
    // move range
    col = MODE_MOVE;
    alpha = rim * 0.5 + bracket * 0.8;
  } else if (uMode == 2) {
    // attack range
    col = MODE_ATTACK;
    alpha = rim * 0.7 * pulse + ripple * 0.7;
  } else if (uMode == 3) {
    // selected
    col = MODE_SELECT;
    alpha = rim * 0.8 + rotRing * 1.2;
  }
  // Edge fade
  alpha *= smoothstep(0.5, 0.4, d);
  alpha *= uAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export function makeHoverMaterial(mode: HoverMode = "hover"): THREE.ShaderMaterial {
  const modeIdx: number = { hover: 0, move: 1, attack: 2, select: 3 }[mode];
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: modeIdx },
      uAlpha: { value: 1.0 },
    },
  });
  return mat;
}
