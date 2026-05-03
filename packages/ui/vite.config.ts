import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Library build for the Chrome extension panel — outputs an IIFE the extension can include.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    lib: {
      entry: "src/embed.tsx",
      formats: ["es"],
      fileName: "panel",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
