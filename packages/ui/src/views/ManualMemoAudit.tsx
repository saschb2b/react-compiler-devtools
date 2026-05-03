import { useMemo } from "react";
import type { Manifest } from "@rcd/protocol";
import { OpenButton } from "./OpenButton";

export function ManualMemoAudit({ manifest }: { manifest: Manifest }) {
  const rows = useMemo(() => {
    const out: Array<{
      filename: string;
      relativePath: string;
      fnName: string | null;
      fnLine: number;
      kind: "useMemo" | "useCallback" | "memo";
      line: number;
      column: number;
    }> = [];
    for (const file of Object.values(manifest.files)) {
      for (const fn of file.functions) {
        if (fn.status !== "compiled") continue;
        for (const m of fn.manualMemos) {
          out.push({
            filename: file.filename,
            relativePath: file.relativePath,
            fnName: fn.name,
            fnLine: fn.loc.start.line,
            kind: m.kind,
            line: m.loc.start.line,
            column: m.loc.start.column + 1,
          });
        }
      }
    }
    return out;
  }, [manifest]);

  return (
    <section className="rcd-section">
      <h2>Manual memo audit</h2>
      <p className="rcd-muted">
        These <code>useMemo</code> / <code>useCallback</code> / <code>React.memo</code> calls live
        inside successfully compiled components. The compiler is already memoizing them — manual
        wrappers are likely redundant and add noise.
      </p>
      {rows.length === 0 ? (
        <p className="rcd-ok">Nothing to clean up. ✨</p>
      ) : (
        <table className="rcd-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Inside</th>
              <th>File</th>
              <th>Line</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <code>{r.kind}</code>
                </td>
                <td>
                  {r.fnName ?? "(anonymous)"}
                  <span className="rcd-muted"> @ {r.fnLine}</span>
                </td>
                <td>
                  <code>{r.relativePath}</code>
                </td>
                <td>
                  {r.line} <OpenButton filename={r.filename} line={r.line} column={r.column} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
