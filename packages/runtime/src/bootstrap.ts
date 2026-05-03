import { getOrCreateGlobal } from "./global.js";

/**
 * Side-effect import that ensures `window.__REACT_COMPILER_DEVTOOLS__` exists
 * before any compiled component runs. The framework plugins inject this as
 * the first import in the user's entry.
 */
declare const __RCD_FRAMEWORK__: "vite" | "next" | "unknown" | undefined;
const framework =
  typeof __RCD_FRAMEWORK__ === "string" ? __RCD_FRAMEWORK__ : "unknown";

getOrCreateGlobal(framework);
