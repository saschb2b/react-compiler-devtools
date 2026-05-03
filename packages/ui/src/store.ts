import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type BridgeMessage,
  type Manifest,
  type RuntimeSnapshot,
  type SourcePair,
} from "@rcd/protocol";
import type { Transport } from "./bridge";

interface State {
  manifest: Manifest | null;
  manifestError: string | null;
  snapshot: RuntimeSnapshot | null;
  /** True once we've heard a `ready` message from the runtime. */
  runtimeReady: boolean;
}

class Store {
  private state: State = {
    manifest: null,
    manifestError: null,
    snapshot: null,
    runtimeReady: false,
  };
  private listeners = new Set<() => void>();

  constructor(private readonly transport: Transport) {
    this.refreshManifest();
    transport.onRuntimeMessage((msg) => this.handleRuntimeMessage(msg));
    // Ask the runtime for an initial snapshot in case it loaded before us.
    transport.postRuntimeMessage({ source: "rcd", kind: "request-snapshot" });
  }

  // Arrow class fields so React's useSyncExternalStore can call them without
  // binding — `useSyncExternalStore(subscribe, getSnapshot)` invokes them
  // bare, which would lose `this` for regular prototype methods.
  getState = (): State => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async refreshManifest(): Promise<void> {
    try {
      const manifest = await this.transport.fetchManifest();
      this.update({ manifest, manifestError: null });
    } catch (err) {
      this.update({ manifestError: err instanceof Error ? err.message : String(err) });
    }
  }

  resetRuntime(): void {
    this.transport.postRuntimeMessage({ source: "rcd", kind: "reset" });
    this.update({ snapshot: null });
  }

  private handleRuntimeMessage(msg: BridgeMessage): void {
    switch (msg.kind) {
      case "ready":
        this.update({ runtimeReady: true });
        this.transport.postRuntimeMessage({ source: "rcd", kind: "request-snapshot" });
        break;
      case "snapshot":
        this.update({ snapshot: msg.payload, runtimeReady: true });
        break;
      case "render": {
        const snap = this.state.snapshot;
        if (!snap) return;
        const next: RuntimeSnapshot = {
          ...snap,
          takenAt: Date.now(),
          caches: snap.caches.map((c) =>
            c.cacheId === msg.payload.cacheId
              ? {
                  ...c,
                  totalRenders: c.totalRenders + 1,
                  totalHits: c.totalHits + msg.payload.render.hitCount,
                  totalMisses: c.totalMisses + msg.payload.render.missCount,
                  recentRenders: [...c.recentRenders.slice(-63), msg.payload.render],
                }
              : c,
          ),
        };
        this.update({ snapshot: next });
        break;
      }
    }
  }

  private update(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
}

let storeRef: Store | null = null;
let transportRef: Transport | null = null;

export function bindTransport(transport: Transport): void {
  transportRef = transport;
}

function ensureStore(): Store {
  if (!storeRef) {
    if (!transportRef) throw new Error("rcd panel: no transport bound — call bindTransport first.");
    storeRef = new Store(transportRef);
  }
  return storeRef;
}

export function useStore(): State {
  const store = ensureStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useStoreActions(): { refreshManifest: () => void; resetRuntime: () => void } {
  const store = ensureStore();
  return {
    refreshManifest: () => store.refreshManifest(),
    resetRuntime: () => store.resetRuntime(),
  };
}

/** Re-poll the manifest every `intervalMs` so HMR'd compiles show up. */
export function useManifestPolling(intervalMs = 1500): void {
  const { refreshManifest } = useStoreActions();
  useEffect(() => {
    const id = setInterval(refreshManifest, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refreshManifest]);
}

/** Lazily fetch the {original, compiled} source pair for a file. */
export function useSourcePair(filename: string | null): {
  pair: SourcePair | null;
  loading: boolean;
  error: string | null;
} {
  const [pair, setPair] = useState<SourcePair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!filename) {
      setPair(null);
      return;
    }
    if (!transportRef) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    transportRef
      .fetchSource(filename)
      .then((p) => {
        if (cancelled) return;
        setPair(p);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filename]);
  return { pair, loading, error };
}
