import {
  emptyManifest,
  type Manifest,
  type ManifestFile,
  type ManifestFunction,
  type SourceLoc,
} from "@rcd/protocol";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

export interface MetaCollectorOptions {
  rootDir: string;
  /** Write the manifest here whenever it changes. Pass `null` to skip disk writes. */
  outFile?: string | null;
  /** Called every time the manifest is materially updated. Useful for live dev servers. */
  onUpdate?: (manifest: Manifest) => void;
  /** Pretty-print the JSON. Defaults to `true` in dev. */
  pretty?: boolean;
}

/**
 * The React Compiler invokes `logger.logEvent(filename, event)` for every event during compilation.
 * The event shape is intentionally loose because the compiler's TypeScript types aren't published
 * for these events; we only depend on the documented `kind` discriminator.
 */
export interface CompilerLoggerEvent {
  kind:
    | "CompileSuccess"
    | "CompileError"
    | "CompileSkip"
    | "CompileDiagnostic"
    | "PipelineError"
    | "Timing";
  fnLoc?: SourceLoc | null;
  fnName?: string | null;
  /** Number of cache slots for `CompileSuccess`. */
  memoSlots?: number | null;
  /** Reason / details bag for non-success events. */
  detail?: {
    reason?: string;
    description?: string;
    severity?: "error" | "warning" | "info";
    suggestions?: Array<{ description?: string }>;
    loc?: SourceLoc;
  };
  /** ms, present on `Timing` events. */
  ms?: number;
}

export interface CompilerLogger {
  logEvent: (filename: string | null, event: CompilerLoggerEvent) => void;
}

/**
 * Builds an in-memory manifest from React Compiler logger events. Subsequent
 * runs (HMR, watch mode) overwrite per-file entries so the manifest always
 * reflects the most recent compilation.
 */
interface ObservedFunction {
  name: string | null;
  loc: SourceLoc;
  manualMemos: ManifestFunction["manualMemos"];
}

export class MetaCollector {
  private readonly options: Required<Omit<MetaCollectorOptions, "outFile" | "onUpdate">> &
    Pick<MetaCollectorOptions, "outFile" | "onUpdate">;
  private manifest: Manifest;
  private writeScheduled = false;
  /**
   * Per-file map of `:line:col` → name + manual memos discovered by the babel
   * companion BEFORE the React Compiler ran. The compiler's logger events
   * enrich themselves from this cache when it's their turn.
   */
  private observed = new Map<string, Map<string, ObservedFunction>>();

  constructor(options: MetaCollectorOptions) {
    this.options = {
      rootDir: resolve(options.rootDir),
      outFile: options.outFile,
      onUpdate: options.onUpdate,
      pretty: options.pretty ?? true,
    };
    this.manifest = emptyManifest(this.options.rootDir);
  }

  getManifest(): Manifest {
    return this.manifest;
  }

  /** Drop everything we've collected for `filename`. Call this before re-compiling a changed file. */
  resetFile(filename: string): void {
    const file = this.manifest.files[filename];
    if (file) {
      this.subtractFromSummary(file);
      delete this.manifest.files[filename];
    }
    this.observed.delete(filename);
    this.scheduleWrite();
  }

  /** Called by the babel companion (which runs first) for every top-level component-shaped function. */
  observeFunction(filename: string, fn: ObservedFunction): void {
    let map = this.observed.get(filename);
    if (!map) {
      map = new Map();
      this.observed.set(filename, map);
    }
    const id = `:${fn.loc.start.line}:${fn.loc.start.column}`;
    const existing = map.get(id);
    if (existing) {
      existing.manualMemos.push(...fn.manualMemos);
      if (!existing.name) existing.name = fn.name;
    } else {
      map.set(id, { ...fn, manualMemos: [...fn.manualMemos] });
    }
  }

  /** The babel plugin calls this for every Compiler event keyed to `filename`. */
  recordEvent(filename: string | null, event: CompilerLoggerEvent): void {
    if (!filename) return;
    const file = this.ensureFile(filename);
    const observed = this.observed.get(filename);

    switch (event.kind) {
      case "CompileSuccess":
        this.upsertFunction(file, this.enrich(makeCompiledFunction(event), observed));
        break;
      case "CompileError":
        this.upsertFunction(file, this.enrich(makeErroredFunction(event), observed));
        break;
      case "CompileSkip":
        this.upsertFunction(file, this.enrich(makeSkippedFunction(event), observed));
        break;
      case "CompileDiagnostic":
        this.attachDiagnostic(file, event);
        break;
      case "PipelineError":
        // Whole-file failure: surface as a synthetic function record so the UI shows it.
        file.functions.push({
          id: `${filename}:pipeline`,
          name: null,
          loc: event.fnLoc ?? zeroLoc(),
          status: "errored",
          cacheSize: null,
          diagnostics: [
            {
              severity: "error",
              message: event.detail?.description ?? "Pipeline error",
              category: "PipelineError",
            },
          ],
          manualMemos: [],
        });
        break;
      case "Timing":
        if (typeof event.ms === "number") {
          file.totalTimingMs = (file.totalTimingMs ?? 0) + event.ms;
        }
        break;
    }

    this.recomputeSummary();
    this.scheduleWrite();
  }

  /**
   * Stable in-file id matching what `makeCompiledFunction` / `makeSkippedFunction` generate.
   * Filenames aren't part of the id — functions are always looked up under their owning file.
   */
  static functionId(loc: SourceLoc | null | undefined): string {
    if (!loc) return ":?";
    return `:${loc.start.line}:${loc.start.column}`;
  }

  // ---------- internals ----------

  private ensureFile(filename: string): ManifestFile {
    let file = this.manifest.files[filename];
    if (!file) {
      file = {
        filename,
        relativePath: toRelative(this.options.rootDir, filename),
        functions: [],
      };
      this.manifest.files[filename] = file;
    }
    return file;
  }

  private upsertFunction(file: ManifestFile, fn: ManifestFunction): void {
    const idx = file.functions.findIndex((f) => f.id === fn.id);
    if (idx === -1) file.functions.push(fn);
    else file.functions[idx] = { ...file.functions[idx], ...fn };
  }

  /** Fill in name + manual memos from the companion's pre-compile observation cache. */
  private enrich(
    fn: ManifestFunction,
    observed: Map<string, ObservedFunction> | undefined,
  ): ManifestFunction {
    if (!observed) return fn;
    const hit = observed.get(fn.id);
    if (!hit) return fn;
    return {
      ...fn,
      name: fn.name ?? hit.name,
      // Manual memos only matter when the function was actually compiled — but we
      // attach them to skipped/errored entries too so the audit view can show
      // "this function would benefit from compiling, and it has redundant memos".
      manualMemos: [...fn.manualMemos, ...hit.manualMemos],
    };
  }

  private attachDiagnostic(file: ManifestFile, event: CompilerLoggerEvent): void {
    const target = event.fnLoc ? this.findFunctionAtLoc(file, event.fnLoc) : null;
    const diagnostic = {
      severity: event.detail?.severity ?? ("warning" as const),
      message: event.detail?.description ?? "Compiler diagnostic",
      loc: event.detail?.loc ?? event.fnLoc ?? undefined,
      category: event.detail?.reason,
    };
    if (target) target.diagnostics.push(diagnostic);
    // Floating diagnostics (no enclosing function) are dropped — UI surfaces them per-file
    // through the bailouts view by walking each function. This keeps the data model flat.
  }

  private findFunctionAtLoc(file: ManifestFile, loc: SourceLoc): ManifestFunction | undefined {
    return file.functions.find(
      (f) => f.loc.start.line === loc.start.line && f.loc.start.column === loc.start.column,
    );
  }

  private recomputeSummary(): void {
    const summary = {
      totalFunctions: 0,
      compiled: 0,
      skipped: 0,
      errored: 0,
      bailoutsByReason: {} as Record<string, number>,
      manualMemosInCompiled: 0,
    };
    for (const file of Object.values(this.manifest.files)) {
      for (const fn of file.functions) {
        summary.totalFunctions++;
        summary[fn.status]++;
        if ((fn.status === "skipped" || fn.status === "errored") && fn.bailout) {
          summary.bailoutsByReason[fn.bailout.reason] =
            (summary.bailoutsByReason[fn.bailout.reason] ?? 0) + 1;
        }
        if (fn.status === "compiled") summary.manualMemosInCompiled += fn.manualMemos.length;
      }
    }
    this.manifest.summary = summary;
    this.manifest.generatedAt = Date.now();
  }

  private subtractFromSummary(_file: ManifestFile): void {
    // The cheapest correct strategy is to just recompute the whole thing after deletion.
    // Manifests are small enough (one entry per top-level function) that this is fine.
  }

  private scheduleWrite(): void {
    this.options.onUpdate?.(this.manifest);
    if (this.writeScheduled || !this.options.outFile) return;
    this.writeScheduled = true;
    queueMicrotask(() => {
      this.writeScheduled = false;
      this.flushToDisk();
    });
  }

  private flushToDisk(): void {
    if (!this.options.outFile) return;
    const target = this.options.outFile;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      this.options.pretty ? JSON.stringify(this.manifest, null, 2) : JSON.stringify(this.manifest),
    );
  }
}

function makeCompiledFunction(event: CompilerLoggerEvent): ManifestFunction {
  const loc = event.fnLoc ?? zeroLoc();
  return {
    id: makeId(loc),
    name: event.fnName ?? null,
    loc,
    status: "compiled",
    cacheSize: event.memoSlots ?? null,
    diagnostics: [],
    manualMemos: [],
    timingMs: event.ms,
  };
}

function makeErroredFunction(event: CompilerLoggerEvent): ManifestFunction {
  const loc = event.fnLoc ?? zeroLoc();
  return {
    id: makeId(loc),
    name: event.fnName ?? null,
    loc,
    status: "errored",
    cacheSize: null,
    bailout: {
      reason: event.detail?.reason ?? "CompileError",
      description: event.detail?.description ?? "Unknown compile error",
      loc: event.detail?.loc,
      suggestion: event.detail?.suggestions?.[0]?.description,
    },
    diagnostics: [],
    manualMemos: [],
  };
}

function makeSkippedFunction(event: CompilerLoggerEvent): ManifestFunction {
  const loc = event.fnLoc ?? zeroLoc();
  return {
    id: makeId(loc),
    name: event.fnName ?? null,
    loc,
    status: "skipped",
    cacheSize: null,
    bailout: {
      reason: event.detail?.reason ?? "Skipped",
      description: event.detail?.description ?? "Function not eligible for compilation",
      loc: event.detail?.loc,
      suggestion: event.detail?.suggestions?.[0]?.description,
    },
    diagnostics: [],
    manualMemos: [],
  };
}

function zeroLoc(): SourceLoc {
  return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
}

function makeId(loc: SourceLoc): string {
  return `:${loc.start.line}:${loc.start.column}`;
}

function toRelative(rootDir: string, filename: string): string {
  const rel = relative(rootDir, filename).replaceAll("\\", "/");
  return rel === "" ? filename : rel;
}

export type { Manifest, ManifestFile, ManifestFunction } from "@rcd/protocol";
