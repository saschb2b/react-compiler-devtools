import {
  type CacheInstance,
  type RenderRecord,
  type RuntimeSnapshot,
  PROTOCOL_VERSION,
} from "@rcd/protocol";

const MAX_RENDERS_PER_CACHE = 64;

/**
 * Holds every cache instance the runtime has seen. The store is exposed on
 * `window[GLOBAL_KEY].store` so the panel can either pull a snapshot or
 * subscribe to render events. Memory is bounded by the per-cache ring buffer.
 */
export class RuntimeStore {
  private nextCacheId = 1;
  private nextRenderId = new WeakMap<object, number>();
  private caches = new Map<object, CacheInstance>();
  private listeners = new Set<(message: RenderRecord, instance: CacheInstance) => void>();

  registerCache(rawArray: object, size: number): CacheInstance {
    const existing = this.caches.get(rawArray);
    if (existing) return existing;
    const instance: CacheInstance = {
      cacheId: this.nextCacheId++,
      cacheSize: size,
      manifestId: null,
      componentName: null,
      createdAt: Date.now(),
      totalRenders: 0,
      totalHits: 0,
      totalMisses: 0,
      recentRenders: [],
    };
    this.caches.set(rawArray, instance);
    this.nextRenderId.set(rawArray, 0);
    return instance;
  }

  beginRender(rawArray: object): RenderRecord {
    const instance = this.caches.get(rawArray);
    if (!instance) throw new Error("rcd: beginRender called for unregistered cache");
    const renderId = (this.nextRenderId.get(rawArray) ?? 0) + 1;
    this.nextRenderId.set(rawArray, renderId);
    const record: RenderRecord = {
      renderId,
      timestamp: Date.now(),
      slots: new Array(instance.cacheSize),
      hitCount: 0,
      missCount: 0,
    };
    instance.totalRenders++;
    if (instance.recentRenders.length >= MAX_RENDERS_PER_CACHE) {
      instance.recentRenders.shift();
    }
    instance.recentRenders.push(record);
    return record;
  }

  recordSlot(rawArray: object, slot: number, status: "hit" | "miss"): void {
    const instance = this.caches.get(rawArray);
    if (!instance) return;
    const render = instance.recentRenders[instance.recentRenders.length - 1];
    if (!render) return;
    if (render.slots[slot] !== undefined) return; // first read wins per slot per render
    render.slots[slot] = status;
    if (status === "hit") {
      render.hitCount++;
      instance.totalHits++;
    } else {
      render.missCount++;
      instance.totalMisses++;
    }
  }

  endRender(rawArray: object): void {
    const instance = this.caches.get(rawArray);
    if (!instance) return;
    const render = instance.recentRenders[instance.recentRenders.length - 1];
    if (!render) return;
    for (const fn of this.listeners) fn(render, instance);
  }

  attachComponentName(rawArray: object, name: string | null, manifestId: string | null = null): void {
    const instance = this.caches.get(rawArray);
    if (!instance) return;
    if (name && !instance.componentName) instance.componentName = name;
    if (manifestId && !instance.manifestId) instance.manifestId = manifestId;
  }

  snapshot(): RuntimeSnapshot {
    return {
      version: PROTOCOL_VERSION,
      takenAt: Date.now(),
      caches: [...this.caches.values()].map((c): CacheInstance => ({
        ...c,
        recentRenders: c.recentRenders.map((r) => ({ ...r, slots: r.slots.slice() })),
      })),
    };
  }

  subscribe(fn: (record: RenderRecord, instance: CacheInstance) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    this.caches.clear();
    this.nextCacheId = 1;
  }
}
