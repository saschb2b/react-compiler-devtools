import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import type { Transport } from "./bridge";

/**
 * Mount the panel into an arbitrary container with an arbitrary transport.
 * Used by the Chrome extension to attach the panel to a `devtools_page` and
 * by the Vite plugin overlay to mount inline.
 */
export function mountPanel(container: HTMLElement, transport: Transport): Root {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App transport={transport} />
    </StrictMode>,
  );
  return root;
}

export type { Transport } from "./bridge";
