import {
  type BridgeMessage,
  type Manifest,
  type RuntimeSnapshot,
  MANIFEST_ENDPOINT,
  isBridgeMessage,
} from "@rcd/protocol";

/**
 * The panel needs two data feeds:
 *  1. The build manifest, fetched over HTTP from the dev server.
 *  2. Live runtime events (snapshots + per-render records) from the inspected page.
 *
 * In the Vite/Next dev overlay both share the same window. In the Chrome
 * extension panel the "page" is a different process, so the extension
 * supplies its own transport that proxies via chrome.runtime/devtools.
 */
export interface Transport {
  fetchManifest(): Promise<Manifest | null>;
  onRuntimeMessage(handler: (msg: BridgeMessage) => void): () => void;
  postRuntimeMessage(msg: BridgeMessage): void;
}

export function mountInPage(): Transport {
  return {
    async fetchManifest() {
      const res = await fetch(MANIFEST_ENDPOINT, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Manifest | null;
    },
    onRuntimeMessage(handler) {
      const listener = (event: MessageEvent) => {
        if (isBridgeMessage(event.data)) handler(event.data);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
    postRuntimeMessage(msg) {
      window.postMessage(msg, "*");
    },
  };
}

export type { BridgeMessage, Manifest, RuntimeSnapshot };
