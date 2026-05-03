import { Fragment, useState } from "react";
import type { CacheInstance, Manifest, RuntimeSnapshot } from "@rcd/protocol";

export function RuntimeInspector({
  manifest,
  snapshot,
}: {
  manifest: Manifest | null;
  snapshot: RuntimeSnapshot | null;
}) {
  if (!snapshot || snapshot.caches.length === 0) {
    return (
      <section className="rcd-section">
        <h2>Runtime cache inspector</h2>
        <p className="rcd-muted">
          No cache instances observed yet. Interact with the app — every render of a compiled
          component populates this view.
        </p>
      </section>
    );
  }

  return (
    <section className="rcd-section">
      <h2>Runtime cache inspector</h2>
      <p className="rcd-muted">
        Live view of every <code>_c(N)</code> cache the compiler instantiated. Each row is one
        component instance.
      </p>
      <CacheTable caches={snapshot.caches} manifest={manifest} />
    </section>
  );
}

function CacheTable({
  caches,
  manifest,
}: {
  caches: CacheInstance[];
  manifest: Manifest | null;
}) {
  const [openId, setOpenId] = useState<number | null>(caches[0]?.cacheId ?? null);

  return (
    <div>
      <table className="rcd-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Slots</th>
            <th>Renders</th>
            <th>Hit / miss</th>
            <th>Hit rate</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {caches.map((c) => {
            const total = c.totalHits + c.totalMisses;
            const rate = total === 0 ? 0 : Math.round((c.totalHits / total) * 100);
            return (
              <Fragment key={c.cacheId}>
                <tr>
                  <td>
                    {c.componentName ?? <span className="rcd-muted">cache #{c.cacheId}</span>}
                  </td>
                  <td>{c.cacheSize}</td>
                  <td>{c.totalRenders}</td>
                  <td>
                    <span className="rcd-runtime-ok">{c.totalHits}</span> /{" "}
                    <span className="rcd-runtime-off">{c.totalMisses}</span>
                  </td>
                  <td>{rate}%</td>
                  <td>
                    <button
                      type="button"
                      className="rcd-btn rcd-btn-small"
                      onClick={() => setOpenId(openId === c.cacheId ? null : c.cacheId)}
                    >
                      {openId === c.cacheId ? "Hide" : "Inspect"}
                    </button>
                  </td>
                </tr>
                {openId === c.cacheId && (
                  <tr>
                    <td colSpan={6}>
                      <CacheDetail cache={c} manifest={manifest} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CacheDetail({ cache, manifest: _manifest }: { cache: CacheInstance; manifest: Manifest | null }) {
  return (
    <div className="rcd-cache-detail">
      <h4>Recent renders (newest last)</h4>
      <div className="rcd-render-grid">
        {cache.recentRenders.map((r) => (
          <div key={r.renderId} className="rcd-render-col">
            <div className="rcd-render-id">#{r.renderId}</div>
            {Array.from({ length: cache.cacheSize }).map((_, slot) => {
              const status = r.slots[slot];
              const cls =
                status === "hit"
                  ? "rcd-slot rcd-slot-hit"
                  : status === "miss"
                  ? "rcd-slot rcd-slot-miss"
                  : "rcd-slot rcd-slot-cold";
              return <div key={slot} className={cls} title={`slot ${slot}: ${status ?? "untouched"}`} />;
            })}
          </div>
        ))}
      </div>
      <p className="rcd-muted rcd-footnote">
        Green = hit (memoized value reused). Red = miss (slot recomputed). Grey = slot not read on
        that render.
      </p>
    </div>
  );
}
