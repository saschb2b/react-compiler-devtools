// IMPORTANT: this import resolves to the *real* `react/compiler-runtime` because
// the framework plugins use a `resolveId` hook that allows imports originating
// from inside `@rcd/runtime` to bypass the alias. Don't change this specifier.
import { c as realC } from "react/compiler-runtime";
import { getOrCreateGlobal } from "./global.js";

const SENTINEL = Symbol.for("react.memo_cache_sentinel");

/**
 * Replacement for `react/compiler-runtime`'s `c` export. The framework plugin
 * aliases imports of `react/compiler-runtime` to this module so every compiled
 * component routes through us.
 *
 * Strategy: call the real `_c(size)` to get the underlying array, then return
 * a Proxy that records reads (hit vs. cold) and writes (miss → recomputed)
 * into the runtime store. The Proxy preserves array identity semantics
 * (length, in-bounds index) so React Compiler's emitted code works unchanged.
 *
 * Performance: the Proxy adds a per-access function call. This is dev-only —
 * production builds drop the alias and use `react/compiler-runtime` directly.
 */
export function c(size: number): unknown[] {
  const runtime = getOrCreateGlobal();
  const real = realC(size);
  runtime.store.registerCache(real, size);
  runtime.store.beginRender(real);

  return new Proxy(real, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const idx = toIndex(prop);
        if (idx !== null) {
          const value = (target as unknown[])[idx];
          runtime.store.recordSlotRead(target, idx, value === SENTINEL ? "miss" : "hit");
          scheduleEnd(target);
          return value;
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      // Writes are the recompute path: compiled code stashes the new value back. Capture
      // both old (the cached value from the previous render) and new so the panel can
      // explain "what changed".
      if (typeof prop === "string") {
        const idx = toIndex(prop);
        if (idx !== null) {
          const oldValue = (target as unknown[])[idx];
          runtime.store.recordSlotWrite(target, idx, oldValue, value);
        }
      }
      const ok = Reflect.set(target, prop, value, receiver);
      scheduleEnd(target);
      return ok;
    },
  });
}

const pendingEnds = new WeakSet<object>();
function scheduleEnd(target: object): void {
  if (pendingEnds.has(target)) return;
  pendingEnds.add(target);
  queueMicrotask(() => {
    pendingEnds.delete(target);
    getOrCreateGlobal().store.endRender(target);
  });
}

function toIndex(prop: string): number | null {
  if (prop.length === 0) return null;
  let n = 0;
  for (let i = 0; i < prop.length; i++) {
    const code = prop.charCodeAt(i);
    if (code < 48 || code > 57) return null;
    n = n * 10 + (code - 48);
  }
  return n;
}
