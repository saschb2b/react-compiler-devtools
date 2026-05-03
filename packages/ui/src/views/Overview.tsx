import type { Manifest } from "@rcd/protocol";

export function Overview({ manifest }: { manifest: Manifest }) {
  const { summary } = manifest;
  const compiledPct =
    summary.totalFunctions === 0
      ? 0
      : Math.round((summary.compiled / summary.totalFunctions) * 100);

  return (
    <section className="rcd-section">
      <h2>Overview</h2>
      <div className="rcd-cards">
        <Card label="Functions seen" value={summary.totalFunctions} />
        <Card label="Compiled" value={summary.compiled} accent="ok" suffix={`(${compiledPct}%)`} />
        <Card label="Skipped" value={summary.skipped} accent="warn" />
        <Card label="Errored" value={summary.errored} accent="bad" />
        <Card
          label="Manual memos in compiled code"
          value={summary.manualMemosInCompiled}
          accent={summary.manualMemosInCompiled > 0 ? "warn" : undefined}
        />
      </div>

      <h3>Top bailout reasons</h3>
      {Object.keys(summary.bailoutsByReason).length === 0 ? (
        <p className="rcd-muted">No bailouts so far. Nice.</p>
      ) : (
        <table className="rcd-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th className="rcd-num">Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.bailoutsByReason)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => (
                <tr key={reason}>
                  <td>{reason}</td>
                  <td className="rcd-num">{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <p className="rcd-muted rcd-footnote">
        Manifest generated {new Date(manifest.generatedAt).toLocaleTimeString()} · root{" "}
        <code>{manifest.rootDir}</code>
      </p>
    </section>
  );
}

function Card({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: "ok" | "warn" | "bad";
}) {
  const className = ["rcd-card", accent ? `rcd-card-${accent}` : ""].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <div className="rcd-card-value">
        {value}
        {suffix ? <span className="rcd-card-suffix"> {suffix}</span> : null}
      </div>
      <div className="rcd-card-label">{label}</div>
    </div>
  );
}
