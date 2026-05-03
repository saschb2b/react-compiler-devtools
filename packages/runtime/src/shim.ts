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
          runtime.store.recordSlot(target, idx, value === SENTINEL ? "miss" : "hit");
          // After the last read of the render, fire endRender. We don't know which read is the
          // last, so we close out on the next render via beginRender's listeners and on every
          // write. A simpler heuristic: queue a microtask to close out the render on the same tick.
          scheduleEnd(target);
          return value;
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      // Writes happen on a miss path: compiled code stashes the recomputed value back into the slot.
      // We don't double-count — `recordSlot` is keyed first-write-wins in the store.
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
