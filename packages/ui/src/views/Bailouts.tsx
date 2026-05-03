import { useMemo, useState } from "react";
import type { Manifest, ManifestFunction } from "@rcd/protocol";
import { OpenButton } from "./OpenButton";

interface Row {
  fn: ManifestFunction;
  filename: string;
  relativePath: string;
}

export function Bailouts({ manifest }: { manifest: Manifest }) {
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const file of Object.values(manifest.files)) {
      for (const fn of file.functions) {
        if (fn.status === "skipped" || fn.status === "errored") {
          out.push({ fn, filename: file.filename, relativePath: file.relativePath });
        }
      }
    }
    return out;
  }, [manifest]);

  const reasons = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.fn.bailout) set.add(r.fn.bailout.reason);
    return ["", ...[...set].sort()];
  }, [rows]);

  const [filter, setFilter] = useState("");
  const filtered = filter ? rows.filter((r) => r.fn.bailout?.reason === filter) : rows;

  return (
    <section className="rcd-section">
      <h2>Bailouts</h2>
      <div className="rcd-toolbar">
        <label>
          Reason:{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r === "" ? "All" : r}
              </option>
            ))}
          </select>
        </label>
        <span className="rcd-muted">{filtered.length} match(es)</span>
      </div>
      {filtered.length === 0 ? (
        <p className="rcd-muted">No bailouts. Every component is being optimized.</p>
      ) : (
        <table className="rcd-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>File</th>
              <th>Reason</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>
                  <strong>{r.fn.name ?? "(anonymous)"}</strong>
                  <div className="rcd-muted">
                    line {r.fn.loc.start.line}{" "}
                    <OpenButton
                      filename={r.filename}
                      line={r.fn.bailout?.loc?.start.line ?? r.fn.loc.start.line}
                      column={(r.fn.bailout?.loc?.start.column ?? r.fn.loc.start.column) + 1}
                    />
                  </div>
                </td>
                <td>
                  <code>{r.relativePath}</code>
                </td>
                <td>{r.fn.bailout?.reason ?? "—"}</td>
                <td>
                  {r.fn.bailout?.description ?? "—"}
                  {r.fn.bailout?.suggestion && (
                    <div className="rcd-suggestion">→ {r.fn.bailout.suggestion}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
