import { useMemo, useState } from "react";
import type { Manifest, ManifestFile, ManifestFunction } from "@rcd/protocol";
import { useSourcePair } from "../store";
import { SourceDiff } from "./SourceDiff";

export function FileExplorer({ manifest }: { manifest: Manifest }) {
  const files = useMemo(
    () => Object.values(manifest.files).sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    [manifest],
  );
  const [selected, setSelected] = useState<string | null>(files[0]?.filename ?? null);
  const file = selected ? manifest.files[selected] : null;

  return (
    <section className="rcd-section rcd-split">
      <aside className="rcd-sidebar">
        <h3>Files</h3>
        <ul className="rcd-file-list">
          {files.map((f) => (
            <li key={f.filename}>
              <button
                type="button"
                className={f.filename === selected ? "rcd-file rcd-file-selected" : "rcd-file"}
                onClick={() => setSelected(f.filename)}
              >
                <span className="rcd-file-path">{f.relativePath}</span>
                <FileBadge file={f} />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="rcd-detail">
        {file ? <FileDetail file={file} /> : <p className="rcd-muted">No files yet.</p>}
      </div>
    </section>
  );
}

function FileBadge({ file }: { file: ManifestFile }) {
  const counts = countByStatus(file.functions);
  return (
    <span className="rcd-badges">
      <span className="rcd-badge rcd-badge-ok" title="Compiled">
        {counts.compiled}
      </span>
      <span className="rcd-badge rcd-badge-warn" title="Skipped">
        {counts.skipped}
      </span>
      <span className="rcd-badge rcd-badge-bad" title="Errored">
        {counts.errored}
      </span>
    </span>
  );
}

function FileDetail({ file }: { file: ManifestFile }) {
  const [view, setView] = useState<"functions" | "diff">("functions");
  return (
    <div>
      <header className="rcd-detail-header">
        <h2>
          <code>{file.relativePath}</code>
        </h2>
        <div className="rcd-tabs rcd-tabs-mini">
          <button
            type="button"
            className={view === "functions" ? "rcd-tab rcd-tab-active" : "rcd-tab"}
            onClick={() => setView("functions")}
          >
            Functions
          </button>
          <button
            type="button"
            className={view === "diff" ? "rcd-tab rcd-tab-active" : "rcd-tab"}
            onClick={() => setView("diff")}
          >
            Source ↔ Compiled
          </button>
        </div>
      </header>
      {file.totalTimingMs != null && (
        <p className="rcd-muted">Compiled in {file.totalTimingMs.toFixed(1)} ms</p>
      )}
      {view === "functions" ? (
        file.functions.length === 0 ? (
          <p className="rcd-muted">No top-level functions detected.</p>
        ) : (
          <ul className="rcd-fn-list">
            {file.functions
              .slice()
              .sort((a, b) => a.loc.start.line - b.loc.start.line)
              .map((fn) => (
                <FunctionCard key={fn.id} fn={fn} />
              ))}
          </ul>
        )
      ) : (
        <FileDiffView filename={file.filename} />
      )}
    </div>
  );
}

function FileDiffView({ filename }: { filename: string }) {
  const { pair, loading, error } = useSourcePair(filename);
  if (loading) return <p className="rcd-muted">Loading source…</p>;
  if (error) return <p className="rcd-error">Failed to load source: {error}</p>;
  if (!pair) return <p className="rcd-muted">No source captured for this file yet.</p>;
  return <SourceDiff pair={pair} />;
}

function FunctionCard({ fn }: { fn: ManifestFunction }) {
  return (
    <li className={`rcd-fn rcd-fn-${fn.status}`}>
      <header>
        <strong>{fn.name ?? "(anonymous)"}</strong>
        <span className="rcd-muted">
          {" "}
          @ line {fn.loc.start.line}
        </span>
        <span className={`rcd-pill rcd-pill-${fn.status}`}>{fn.status}</span>
        {fn.cacheSize != null && (
          <span className="rcd-pill" title="cache slots allocated">
            {fn.cacheSize} slots
          </span>
        )}
      </header>
      {fn.bailout && (
        <div className="rcd-bailout">
          <div>
            <strong>{fn.bailout.reason}</strong>: {fn.bailout.description}
          </div>
          {fn.bailout.suggestion && (
            <div className="rcd-suggestion">Suggestion: {fn.bailout.suggestion}</div>
          )}
        </div>
      )}
      {fn.manualMemos.length > 0 && (
        <div className="rcd-audit">
          ⚠ {fn.manualMemos.length} manual memo call(s) inside a compiled function:
          <ul>
            {fn.manualMemos.map((m, i) => (
              <li key={i}>
                <code>{m.kind}</code> at line {m.loc.start.line} — likely redundant.
              </li>
            ))}
          </ul>
        </div>
      )}
      {fn.diagnostics.length > 0 && (
        <ul className="rcd-diagnostics">
          {fn.diagnostics.map((d, i) => (
            <li key={i} className={`rcd-diag rcd-diag-${d.severity}`}>
              {d.severity}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function countByStatus(functions: ManifestFunction[]) {
  const out = { compiled: 0, skipped: 0, errored: 0 };
  for (const fn of functions) out[fn.status]++;
  return out;
}
