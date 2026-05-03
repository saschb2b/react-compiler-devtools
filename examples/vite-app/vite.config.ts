import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reactCompilerDevtools } from "@rcd/vite-plugin";

export default defineConfig({
  plugins: [
    // Order matters: our plugin must run before @vitejs/plugin-react so the
    // compiler sees the source. The plugin sets `enforce: "pre"` for that.
    reactCompilerDevtools({ compilerOptions: { compilationMode: "infer" } }),
    react(),
  ],
});
