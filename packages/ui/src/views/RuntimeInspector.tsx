import { Fragment, useState } from "react";
import type { CacheInstance, Manifest, RenderRecord, RuntimeSnapshot, SlotInfo } from "@rcd/protocol";

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
        Live view of every <code>_c(N)</code> cache the compiler instantiated. Click a slot to
        see what changed.
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
  const [selected, setSelected] = useState<{ renderId: number; slot: number } | null>(null);
  const selectedRender = selected ? cache.recentRenders.find((r) => r.renderId === selected.renderId) : null;
  const selectedInfo = selectedRender && selected ? selectedRender.slots[selected.slot] : null;

  return (
    <div className="rcd-cache-detail">
      <h4>Recent renders (newest last)</h4>
      <div className="rcd-render-grid">
        {cache.recentRenders.map((r) => (
          <RenderColumn
            key={r.renderId}
            render={r}
            cacheSize={cache.cacheSize}
            selected={selected}
            onSelect={(slot) => setSelected({ renderId: r.renderId, slot })}
          />
        ))}
      </div>
      {selectedInfo ? (
        <SlotDetail
          renderId={selected!.renderId}
          slot={selected!.slot}
          info={selectedInfo}
          onClose={() => setSelected(null)}
        />
      ) : (
        <p className="rcd-muted rcd-footnote">
          Green = hit · red = miss · grey = untouched. Click a slot to see its old/new value.
        </p>
      )}
    </div>
  );
}

function RenderColumn({
  render,
  cacheSize,
  selected,
  onSelect,
}: {
  render: RenderRecord;
  cacheSize: number;
  selected: { renderId: number; slot: number } | null;
  onSelect: (slot: number) => void;
}) {
  return (
    <div className="rcd-render-col">
      <div className="rcd-render-id">#{render.renderId}</div>
      {Array.from({ length: cacheSize }).map((_, slot) => {
        const info = render.slots[slot];
        const status = info?.status;
        const isSelected = selected?.renderId === render.renderId && selected?.slot === slot;
        const cls = [
          "rcd-slot",
          status === "hit" ? "rcd-slot-hit" : status === "miss" ? "rcd-slot-miss" : "rcd-slot-cold",
          isSelected ? "rcd-slot-selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={slot}
            type="button"
            className={cls}
            onClick={() => onSelect(slot)}
            title={`slot ${slot}: ${status ?? "untouched"}${info?.valuePreview ? " · click for details" : ""}`}
          />
        );
      })}
    </div>
  );
}

function SlotDetail({
  renderId,
  slot,
  info,
  onClose,
}: {
  renderId: number;
  slot: number;
  info: SlotInfo;
  onClose: () => void;
}) {
  return (
    <div className="rcd-slot-detail">
      <header>
        <strong>
          Slot {slot} · render #{renderId}
        </strong>
        <span className={`rcd-pill rcd-pill-${info.status === "hit" ? "compiled" : "errored"}`}>
          {info.status}
        </span>
        <button type="button" className="rcd-btn rcd-btn-small" onClick={onClose}>
          Close
        </button>
      </header>
      {info.status === "miss" ? (
        info.prevPreview != null && info.valuePreview != null ? (
          <table className="rcd-slot-diff">
            <tbody>
              <tr>
                <th>Previous</th>
                <td>
                  <code>{info.prevPreview}</code>
                </td>
              </tr>
              <tr>
                <th>New</th>
                <td>
                  <code>{info.valuePreview}</code>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="rcd-muted">
            Slot was read as cold (sentinel) but never written this render — likely a slot that
            stores a dependency the compiler tracks for downstream slots.
          </p>
        )
      ) : (
        info.valuePreview != null ? (
          <p>
            Cached value: <code>{info.valuePreview}</code>
          </p>
        ) : (
          <p className="rcd-muted">Slot held a memoized value (no recompute on this render).</p>
        )
      )}
    </div>
  );
}
