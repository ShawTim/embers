import { useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// ---------------------------------------------------------------------------
//  PostFX — selective bloom (only emissive / bright objects glow) +
//  cinematic grading (vignette + warm/cool tint + slight contrast).
//
//  Technique: two-pass selective bloom
//   1. Render only objects on layer 1 (selective bloom layer) to a
//      small composer with strong bloom.
//   2. Render the full scene normally to the main composer.
//   3. Add the selective bloom output as an additive blend on top.
//   4. Apply a grade pass (vignette + warm/cool + contrast + sat) for
//      a film-like feel before tone mapping.
//
//  Objects that want to bloom call `enableBloom(obj)` from this
//  module.  Everything else is unaffected.
// ---------------------------------------------------------------------------

const BLOOM_LAYER = 1;
const bloomLayerMask = new THREE.Layers();
bloomLayerMask.set(BLOOM_LAYER);

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materialCache = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

function darkenNonBloomed(obj: THREE.Object3D) {
  if ((obj as THREE.Mesh).isMesh) {
    const mesh = obj as THREE.Mesh;
    materialCache.set(mesh, mesh.material);
    mesh.material = darkMaterial;
  }
}
function restoreMaterial(obj: THREE.Object3D) {
  if ((obj as THREE.Mesh).isMesh) {
    const mesh = obj as THREE.Mesh;
    const saved = materialCache.get(mesh);
    if (saved) {
      mesh.material = saved;
      materialCache.delete(mesh);
    }
  }
}

export interface PostFXProps {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
}

export function PostFX({
  bloomStrength = 0.9,
  bloomRadius = 0.5,
  bloomThreshold = 0.0,
}: PostFXProps) {
  const { gl, scene, camera, size } = useThree();

  const { bloomComposer, finalComposer } = useMemo(() => {
    const renderPass = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold,
    );
    const bloomComp = new EffectComposer(gl);
    bloomComp.renderToScreen = false;
    bloomComp.addPass(renderPass);
    bloomComp.addPass(bloom);

    // Final pass: renders the main scene + adds the bloom result on top
    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComp.renderTarget2.texture },
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
          }
        `,
        defines: {},
      }),
      "baseTexture",
    );
    mixPass.needsSwap = true;

    // Grade pass — vignette, contrast, saturation, warm/cool tint.
    // Runs after the bloom mix so it darkens the corners of the
    // final composite for a cinematic frame.
    const gradePass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          uVignette: { value: 0.45 },     // 0 = off, 1 = strong
          uVignetteSoft: { value: 0.55 },  // inner falloff radius
          uContrast: { value: 1.10 },       // 1.0 = neutral
          uSaturation: { value: 1.12 },     // 1.0 = neutral
          uWarm: { value: new THREE.Color(0xfff0d8) },   // multiplied in
          uCool: { value: new THREE.Color(0xc8d8ff) },   // shadow tint
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse;
          uniform float uVignette;
          uniform float uVignetteSoft;
          uniform float uContrast;
          uniform float uSaturation;
          uniform vec3 uWarm;
          uniform vec3 uCool;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            // Luma for saturation + shadow detection
            float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            // Saturation
            c.rgb = mix(vec3(l), c.rgb, uSaturation);
            // Warm highlights, cool shadows (split-tone)
            float hi = smoothstep(0.45, 0.95, l);
            float lo = 1.0 - smoothstep(0.0, 0.35, l);
            c.rgb *= mix(vec3(1.0), uWarm, hi * 0.35);
            c.rgb *= mix(vec3(1.0), uCool, lo * 0.25);
            // Contrast around 0.5
            c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
            // Vignette — radial darken from center
            vec2 d = vUv - 0.5;
            float r = length(d) * 1.4;
            float vig = 1.0 - smoothstep(uVignetteSoft, 1.0, r) * uVignette;
            c.rgb *= vig;
            gl_FragColor = c;
          }
        `,
      }),
      "tDiffuse",
    );

    const finalComp = new EffectComposer(gl);
    finalComp.addPass(renderPass);
    finalComp.addPass(mixPass);
    finalComp.addPass(gradePass);
    finalComp.addPass(new OutputPass());
    return { bloomComposer: bloomComp, finalComposer: finalComp };
  }, [gl, scene, camera, size.width, size.height]);

  // Resize
  useEffect(() => {
    bloomComposer.setSize(size.width, size.height);
    finalComposer.setSize(size.width, size.height);
  }, [bloomComposer, finalComposer, size]);

  useFrame(() => {
    // Enable bloom layer on any mesh whose material has __bloom flag
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as any)?.__bloom) {
        m.layers.enable(BLOOM_LAYER);
      }
    });

    // Pass 1: darken non-bloom objects, render only bloom layer
    scene.traverse(darkenNonBloomed);
    const oldBg = scene.background;
    scene.background = new THREE.Color(0x000000);
    const oldMask = camera.layers.mask;
    camera.layers.set(BLOOM_LAYER);
    bloomComposer.render();
    camera.layers.mask = oldMask;
    scene.background = oldBg;
    scene.traverse(restoreMaterial);

    // Pass 2: render full scene + add bloom on top
    finalComposer.render();
  }, 1);

  return null;
}

// Public helper — mark an object (and its children) as bloom-eligible
export function enableBloom(obj: THREE.Object3D) {
  obj.layers.enable(BLOOM_LAYER);
  obj.traverse((c) => c.layers.enable(BLOOM_LAYER));
}
