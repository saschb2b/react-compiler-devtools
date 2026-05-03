import { mountPanel, type Transport } from "@rcd/ui";
import {
  type BridgeMessage,
  type Manifest,
  MANIFEST_ENDPOINT,
  isBridgeMessage,
} from "@rcd/protocol";
import "@rcd/ui/src/style.css";

/**
 * Transport bridging the DevTools panel (this script) with the inspected page.
 * Uses chrome.devtools.inspectedWindow.eval to ferry messages — the runtime in
 * the page posts to `window`, the content-script forwards to `chrome.runtime`,
 * and we listen here.
 */
const transport: Transport = {
  async fetchManifest() {
    return new Promise<Manifest | null>((resolve) => {
      chrome.devtools.inspectedWindow.eval<string>(
        `fetch(${JSON.stringify(MANIFEST_ENDPOINT)}, { cache: "no-store" }).then(r => r.ok ? r.text() : "null")`,
        { useContentScriptContext: false },
        (result, isException) => {
          if (isException || typeof result !== "string") return resolve(null);
          try {
            resolve(JSON.parse(result) as Manifest | null);
          } catch {
            resolve(null);
          }
        },
      );
    });
  },
  onRuntimeMessage(handler) {
    const port = chrome.runtime.connect({ name: `rcd:${chrome.devtools.inspectedWindow.tabId}` });
    const listener = (msg: unknown) => {
      if (isBridgeMessage(msg)) handler(msg);
    };
    port.onMessage.addListener(listener);
    return () => port.disconnect();
  },
  postRuntimeMessage(msg: BridgeMessage) {
    chrome.devtools.inspectedWindow.eval(
      `window.postMessage(${JSON.stringify(msg)}, "*")`,
      () => {},
    );
  },
};

const container = document.getElementById("root");
if (container) mountPanel(container, transport);
