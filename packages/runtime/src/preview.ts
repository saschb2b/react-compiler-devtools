/**
 * Cheap, bounded stringifier for cache slot values. We need the panel to be
 * able to render "what changed" without leaking arbitrarily large objects or
 * traversing cycles. Trade fidelity for safety: depth-limited + length-capped.
 */

const MAX_LENGTH = 200;
const MAX_DEPTH = 3;
const SENTINEL = Symbol.for("react.memo_cache_sentinel");

export function previewValue(value: unknown): string {
  if (value === SENTINEL) return "<uninitialized>";
  try {
    const seen = new WeakSet<object>();
    const out = stringify(value, 0, seen);
    return out.length > MAX_LENGTH ? out.slice(0, MAX_LENGTH) + "…" : out;
  } catch {
    return "<unprintable>";
  }
}

function stringify(value: unknown, depth: number, seen: WeakSet<object>): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean" || t === "bigint") return String(value);
  if (t === "function") return `<fn ${(value as Function).name || "anonymous"}>`;
  if (t === "symbol") return (value as symbol).toString();
  if (t !== "object") return String(value);

  const obj = value as object;
  if (seen.has(obj)) return "<circular>";
  seen.add(obj);

  if (depth >= MAX_DEPTH) return Array.isArray(obj) ? "[…]" : "{…}";

  // React element heuristic — show its type rather than its sprawling internals.
  if ((obj as { $$typeof?: symbol }).$$typeof) {
    const t = (obj as { type?: { name?: string; displayName?: string } | string }).type;
    const name = typeof t === "string" ? t : t?.displayName ?? t?.name ?? "Component";
    return `<${name}/>`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.slice(0, 5).map((v) => stringify(v, depth + 1, seen));
    const tail = obj.length > 5 ? `, …(+${obj.length - 5})` : "";
    return `[${items.join(", ")}${tail}]`;
  }

  const entries = Object.entries(obj).slice(0, 6);
  if (entries.length === 0) return "{}";
  const body = entries.map(([k, v]) => `${k}: ${stringify(v, depth + 1, seen)}`).join(", ");
  const tail = Object.keys(obj).length > entries.length ? ", …" : "";
  return `{ ${body}${tail} }`;
}
