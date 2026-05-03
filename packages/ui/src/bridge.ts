import {
  type BridgeMessage,
  type Manifest,
  type RuntimeSnapshot,
  type SourcePair,
  MANIFEST_ENDPOINT,
  SOURCE_ENDPOINT,
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
  fetchSource(filename: string): Promise<SourcePair | null>;
  onRuntimeMessage(handler: (msg: BridgeMessage) => void): () => void;
  postRuntimeMessage(msg: BridgeMessage): void;
}

export function mountInPage(): Transport {
  // When the panel is hosted in an iframe (Vite overlay), the runtime lives
  // in the parent. Outgoing messages must reach the parent's window so the
  // runtime's listener fires; incoming messages are forwarded into us by the
  // parent's overlay snippet, so listening on our own window is correct.
  const isIframe = typeof window !== "undefined" && window.parent !== window;
  const target = isIframe ? window.parent : window;
  return {
    async fetchManifest() {
      const res = await fetch(MANIFEST_ENDPOINT, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Manifest | null;
    },
    async fetchSource(filename) {
      const url = `${SOURCE_ENDPOINT}?file=${encodeURIComponent(filename)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as SourcePair | null;
    },
    onRuntimeMessage(handler) {
      const listener = (event: MessageEvent) => {
        if (isBridgeMessage(event.data)) handler(event.data);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
    postRuntimeMessage(msg) {
      target.postMessage(msg, "*");
    },
  };
}

export type { BridgeMessage, Manifest, RuntimeSnapshot };
