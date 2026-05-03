// Must be the very first import so the runtime global exists before any compiled
// component runs. The Vite plugin also rewrites `react/compiler-runtime` → instrumented shim.
import "@rcd/runtime/bootstrap";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
