import { useState } from "react";
import type { Transport } from "./bridge";
import { bindTransport, useManifestPolling, useStore, useStoreActions } from "./store";
import { Overview } from "./views/Overview";
import { FileExplorer } from "./views/FileExplorer";
import { Bailouts } from "./views/Bailouts";
import { ManualMemoAudit } from "./views/ManualMemoAudit";
import { RuntimeInspector } from "./views/RuntimeInspector";

type Tab = "overview" | "files" | "bailouts" | "audit" | "runtime";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "files", label: "Files" },
  { id: "bailouts", label: "Bailouts" },
  { id: "audit", label: "Manual memo audit" },
  { id: "runtime", label: "Runtime cache" },
];

export function App({ transport }: { transport: Transport }) {
  bindTransport(transport);
  const state = useStore();
  const { refreshManifest, resetRuntime } = useStoreActions();
  const [tab, setTab] = useState<Tab>("overview");
  useManifestPolling();

  return (
    <div className="rcd-root">
      <header className="rcd-header">
        <div className="rcd-title">
          <span className="rcd-logo">⚛</span>
          React Compiler DevTools
        </div>
        <nav className="rcd-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? "rcd-tab rcd-tab-active" : "rcd-tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="rcd-actions">
          <RuntimeStatus connected={state.runtimeReady} />
          <button type="button" className="rcd-btn" onClick={refreshManifest}>
            Refresh
          </button>
          <button type="button" className="rcd-btn" onClick={resetRuntime}>
            Reset runtime
          </button>
        </div>
      </header>

      <main className="rcd-main">
        {state.manifestError && (
          <div className="rcd-error">
            Could not load manifest: {state.manifestError}. Make sure the dev server is running.
          </div>
        )}
        {!state.manifest && !state.manifestError && (
          <div className="rcd-empty">Waiting for the first compilation…</div>
        )}
        {state.manifest && tab === "overview" && <Overview manifest={state.manifest} />}
        {state.manifest && tab === "files" && <FileExplorer manifest={state.manifest} />}
        {state.manifest && tab === "bailouts" && <Bailouts manifest={state.manifest} />}
        {state.manifest && tab === "audit" && <ManualMemoAudit manifest={state.manifest} />}
        {tab === "runtime" && (
          <RuntimeInspector manifest={state.manifest} snapshot={state.snapshot} />
        )}
      </main>
    </div>
  );
}

function RuntimeStatus({ connected }: { connected: boolean }) {
  return (
    <span className={connected ? "rcd-runtime-ok" : "rcd-runtime-off"}>
      ● Runtime {connected ? "live" : "not detected"}
    </span>
  );
}
