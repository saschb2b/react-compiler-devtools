import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { mountInPage } from "./bridge";
import "./style.css";

const container = document.getElementById("root");
if (!container) throw new Error("rcd panel: missing #root");

const transport = mountInPage();

createRoot(container).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
