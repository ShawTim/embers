import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 3000, open: true },
  assetsInclude: ["**/*.glb", "**/*.gltf"],
  // Pre-compress assets with gzip so the dev server (and the production
  // preview) can serve .gz directly.  Browsers advertise Accept-Encoding:
  // gzip and Vite / static servers honour the precompressed file when
  // present, which roughly halves the bytes over the wire for GLBs.
  build: {
    // Rollup chunk size warning: the main bundle is ~1.4MB and that's
    // mostly three.js + the procedural engine.  Splitting would help on
    // first paint, but the loader is sequential anyway so the impact is
    // small relative to the GLB download.
    chunkSizeWarningLimit: 1500,
  },
});
