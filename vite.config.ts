import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: { port: 3000, open: true },
  assetsInclude: ["**/*.glb", "**/*.gltf"],
});
