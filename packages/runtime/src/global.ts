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

interface WindowWithRuntime {
  [GLOBAL_KEY]?: RuntimeGlobal;
  postMessage(message: BridgeMessage, targetOrigin: string): void;
  addEventListener(
    event: "message",
    handler: (event: MessageEvent<BridgeMessage>) => void,
  ): void;
}

const target: WindowWithRuntime | undefined =
  typeof window !== "undefined" ? (window as unknown as WindowWithRuntime) : undefined;

export function getOrCreateGlobal(framework: RuntimeGlobal["framework"] = "unknown"): RuntimeGlobal {
  if (!target) {
    // SSR / Node: return a detached store. The runtime is a no-op server-side because the
    // patched `_c` only records on each call — there's no panel listening anyway.
    return makeGlobal(framework);
  }
  if (!target[GLOBAL_KEY]) {
    target[GLOBAL_KEY] = makeGlobal(framework);
    installBridge(target, target[GLOBAL_KEY]);
  } else if (target[GLOBAL_KEY].framework === "unknown" && framework !== "unknown") {
    target[GLOBAL_KEY].framework = framework;
  }
  return target[GLOBAL_KEY];
}

function makeGlobal(framework: RuntimeGlobal["framework"]): RuntimeGlobal {
  return {
    protocolVersion: PROTOCOL_VERSION,
    store: new RuntimeStore(),
    installed: true,
    framework,
  };
}

function installBridge(win: WindowWithRuntime, runtime: RuntimeGlobal): void {
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
