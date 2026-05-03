import { GLOBAL_KEY, PROTOCOL_VERSION, type BridgeMessage } from "@rcd/protocol";
import { RuntimeStore } from "./store.js";

export interface RuntimeGlobal {
  protocolVersion: string;
  store: RuntimeStore;
  /** Pulled lazily by the panel before subscribing — keeps the global tree-shakeable. */
  installed: boolean;
  /** Hint left by the framework plugin so the panel can show "you forgot to enable HMR" hints. */
  framework?: "vite" | "next" | "unknown";
}

interface GlobalWithRuntime {
  [GLOBAL_KEY]?: RuntimeGlobal;
  postMessage?: (message: BridgeMessage, targetOrigin: string) => void;
  addEventListener?: (
    event: "message",
    handler: (event: MessageEvent<BridgeMessage>) => void,
  ) => void;
}

// `globalThis` is universal — `window` in the browser, `global` in Node, `self` in workers.
// Keeping the runtime instance on `globalThis` lets server-rendering, smoke tests, and the
// browser all see one consistent store across imports.
const target = globalThis as unknown as GlobalWithRuntime;
const hasWindowAPI = typeof window !== "undefined";

export function getOrCreateGlobal(framework: RuntimeGlobal["framework"] = "unknown"): RuntimeGlobal {
  let existing = target[GLOBAL_KEY];
  if (!existing) {
    existing = makeGlobal(framework);
    target[GLOBAL_KEY] = existing;
    if (hasWindowAPI) installBridge(window as unknown as WindowAPI, existing);
  } else if (existing.framework === "unknown" && framework !== "unknown") {
    existing.framework = framework;
  }
  return existing;
}

interface WindowAPI {
  postMessage: (message: BridgeMessage, targetOrigin: string) => void;
  addEventListener: (
    event: "message",
    handler: (event: MessageEvent<BridgeMessage>) => void,
  ) => void;
}

function makeGlobal(framework: RuntimeGlobal["framework"]): RuntimeGlobal {
  return {
    protocolVersion: PROTOCOL_VERSION,
    store: new RuntimeStore(),
    installed: true,
    framework,
  };
}

function installBridge(win: WindowAPI, runtime: RuntimeGlobal): void {
  win.postMessage({ source: "rcd", kind: "ready", payload: { protocolVersion: PROTOCOL_VERSION } }, "*");

  win.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || (msg as BridgeMessage).source !== "rcd") return;
    switch ((msg as BridgeMessage).kind) {
      case "request-snapshot":
        win.postMessage({ source: "rcd", kind: "snapshot", payload: runtime.store.snapshot() }, "*");
        break;
      case "reset":
        runtime.store.reset();
        break;
    }
  });

  // Forward render events as they happen.
  runtime.store.subscribe((render, instance) => {
    win.postMessage(
      { source: "rcd", kind: "render", payload: { cacheId: instance.cacheId, render } },
      "*",
    );
  });
}
