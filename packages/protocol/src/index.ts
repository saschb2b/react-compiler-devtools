/**
 * Wire protocol shared between every package: build-time emitter, runtime
 * shim, UI panel, and Chrome extension. Bumping {@link PROTOCOL_VERSION}
 * forces older readers to refuse the payload.
 */

export const PROTOCOL_VERSION = "1";

export const GLOBAL_KEY = "__REACT_COMPILER_DEVTOOLS__";

export const MANIFEST_ENDPOINT = "/__rcd/manifest.json";

export interface SourceLoc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export type FunctionStatus = "compiled" | "skipped" | "errored";

export interface ManifestFunction {
  /** Stable id `<filename>:<startLine>:<startCol>` — also used by the runtime. */
  id: string;
  name: string | null;
  loc: SourceLoc;
  status: FunctionStatus;
  /** Number of slots allocated by `_c(N)`. `null` when not compiled. */
  cacheSize: number | null;
  bailout?: BailoutInfo;
  diagnostics: Diagnostic[];
  /** `useMemo`/`useCallback`/`React.memo` calls inside a compiled function — likely redundant. */
  manualMemos: ManualMemo[];
  /** Compiler timing in ms, when reported. */
  timingMs?: number;
}

export interface BailoutInfo {
  /** Short machine-readable reason, e.g. `Invariant`, `Todo`, `InvalidReact`. */
  reason: string;
  description: string;
  loc?: SourceLoc;
  /** Suggested fix, when the compiler offers one. */
  suggestion?: string;
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  loc?: SourceLoc;
  category?: string;
}

export interface ManualMemo {
  kind: "useMemo" | "useCallback" | "memo";
  loc: SourceLoc;
}

export interface ManifestFile {
  filename: string;
  /** Repo-relative path used as the React DevTools fiber location key. */
  relativePath: string;
  functions: ManifestFunction[];
  totalTimingMs?: number;
}

export interface ManifestSummary {
  totalFunctions: number;
  compiled: number;
  skipped: number;
  errored: number;
  bailoutsByReason: Record<string, number>;
  manualMemosInCompiled: number;
}

export interface Manifest {
  version: typeof PROTOCOL_VERSION;
  generatedAt: number;
  compilerVersion?: string;
  rootDir: string;
  files: Record<string, ManifestFile>;
  summary: ManifestSummary;
}

export function emptyManifest(rootDir: string): Manifest {
  return {
    version: PROTOCOL_VERSION,
    generatedAt: Date.now(),
    rootDir,
    files: {},
    summary: {
      totalFunctions: 0,
      compiled: 0,
      skipped: 0,
      errored: 0,
      bailoutsByReason: {},
      manualMemosInCompiled: 0,
    },
  };
}

// ---------- Runtime side ----------

export type SlotStatus = "hit" | "miss";

export interface SlotAccess {
  slot: number;
  status: SlotStatus;
}

export interface RenderRecord {
  /** Monotonic counter, scoped per cache instance. */
  renderId: number;
  timestamp: number;
  /** `slots[i]` is the access status observed for slot `i` on this render, or undefined if never read. */
  slots: Array<SlotStatus | undefined>;
  hitCount: number;
  missCount: number;
}

export interface CacheInstance {
  /** Process-unique id assigned when `_c(size)` is first called. */
  cacheId: number;
  cacheSize: number;
  /** Best-effort link back to the manifest (filled by displayName heuristics, see runtime). */
  manifestId: string | null;
  componentName: string | null;
  createdAt: number;
  totalRenders: number;
  totalHits: number;
  totalMisses: number;
  /** Bounded ring buffer of recent renders. */
  recentRenders: RenderRecord[];
}

export interface RuntimeSnapshot {
  version: typeof PROTOCOL_VERSION;
  takenAt: number;
  caches: CacheInstance[];
}

// ---------- Bridge messages (runtime <-> panel) ----------

export type BridgeMessage =
  | { source: "rcd"; kind: "ready"; payload: { protocolVersion: string } }
  | { source: "rcd"; kind: "snapshot"; payload: RuntimeSnapshot }
  | { source: "rcd"; kind: "render"; payload: { cacheId: number; render: RenderRecord } }
  | { source: "rcd"; kind: "request-snapshot" }
  | { source: "rcd"; kind: "reset" };

export function isBridgeMessage(value: unknown): value is BridgeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "rcd"
  );
}
