import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone single-page build of the panel served as a Vite plugin overlay
// or hosted inside the Chrome extension. Outputs an `index.html` plus assets
// into `dist-standalone/`.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-standalone",
    rollupOptions: {
      input: "./standalone.html",
    },
  },
});
