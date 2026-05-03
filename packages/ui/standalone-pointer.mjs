// Tiny pointer module so the Vite plugin can locate the built standalone
// bundle without hard-coding paths. Resolves to the absolute directory
// containing standalone.html plus its hashed assets.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const standaloneDir = join(dirname(fileURLToPath(import.meta.url)), "dist-standalone");
