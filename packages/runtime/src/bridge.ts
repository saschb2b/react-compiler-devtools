import {
  type BridgeMessage,
  type CacheInstance,
  type RenderRecord,
  type RuntimeSnapshot,
  isBridgeMessage,
} from "@rcd/protocol";

/**
 * Client used by the panel to talk to the runtime that lives in the page.
 * Backed by `postMessage` so it works both inside the same window (in-page
 * panel) and across the Chrome extension's content-script boundary (the
 * extension just relays messages).
 */
export class PanelBridge {
  private listeners = new Set<(snapshot: RuntimeSnapshot) => void>();
  private renderListeners = new Set<(payload: { cacheId: number; render: RenderRecord }) => void>();
  private latest: RuntimeSnapshot | null = null;

  constructor(private readonly target: { postMessage: (m: BridgeMessage, origin: string) => void; addEventListener: (event: "message", h: (e: MessageEvent) => void) => void }) {
    this.target.addEventListener("message", (event) => {
      const msg = event.data;
      if (!isBridgeMessage(msg)) return;
      if (msg.kind === "snapshot") {
        this.latest = msg.payload;
        for (const fn of this.listeners) fn(msg.payload);
      } else if (msg.kind === "render") {
        for (const fn of this.renderListeners) fn(msg.payload);
      } else if (msg.kind === "ready") {
        this.requestSnapshot();
      }
    });
  }

  requestSnapshot(): void {
    this.target.postMessage({ source: "rcd", kind: "request-snapshot" }, "*");
  }

  reset(): void {
    this.target.postMessage({ source: "rcd", kind: "reset" }, "*");
  }

  onSnapshot(fn: (snapshot: RuntimeSnapshot) => void): () => void {
    this.listeners.add(fn);
    if (this.latest) fn(this.latest);
    return () => this.listeners.delete(fn);
  }

  onRender(fn: (payload: { cacheId: number; render: RenderRecord }) => void): () => void {
    this.renderListeners.add(fn);
    return () => this.renderListeners.delete(fn);
  }
}

export type { CacheInstance, RenderRecord, RuntimeSnapshot };
