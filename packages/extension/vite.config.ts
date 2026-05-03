import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "rcd-extension-static",
      writeBundle() {
        copyFileSync(resolve("manifest.json"), resolve("dist-extension/manifest.json"));
        copyFileSync(resolve("src/devtools.html"), resolve("dist-extension/devtools.html"));
        copyFileSync(resolve("src/panel.html"), resolve("dist-extension/panel.html"));
      },
    },
  ],
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve("src/devtools.ts"),
        panel: resolve("src/panel.tsx"),
        content: resolve("src/content.ts"),
        bridge: resolve("src/bridge-injector.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
