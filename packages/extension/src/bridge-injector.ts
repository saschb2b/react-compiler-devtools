/**
 * Page-world helper. The framework plugins already install
 * `window.__REACT_COMPILER_DEVTOOLS__` and a postMessage bridge, so this is
 * just a sanity ping the panel can use to detect "page loaded but no runtime
 * — did you forget the Vite/Next plugin?".
 */
import { GLOBAL_KEY, type BridgeMessage } from "@rcd/protocol";

const ping: BridgeMessage = {
  source: "rcd",
  kind: "ready",
  payload: { protocolVersion: "page-injector" },
};

if (typeof window !== "undefined") {
  if (!(window as unknown as Record<string, unknown>)[GLOBAL_KEY]) {
    // The runtime isn't installed — emit a one-shot warning the panel can render.
    window.postMessage(ping, "*");
  }
}
