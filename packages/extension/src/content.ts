/**
 * Content script: relays bridge messages between the page (where the runtime
 * shim posts to `window`) and the DevTools panel (which connects via
 * chrome.runtime.connect).
 *
 * Also injects bridge.js into the page's MAIN world so it can install a
 * postMessage shim if the user hasn't loaded the runtime via a framework
 * plugin (rare, but supported as a fallback).
 */

import type { BridgeMessage } from "@rcd/protocol";

const ports = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("rcd:")) return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener((msg: BridgeMessage) => {
    window.postMessage(msg, "*");
  });
});

window.addEventListener("message", (event) => {
  const msg = event.data as BridgeMessage | undefined;
  if (!msg || msg.source !== "rcd") return;
  for (const port of ports) {
    try {
      port.postMessage(msg);
    } catch {
      ports.delete(port);
    }
  }
});

// Inject the page-side helper.
const script = document.createElement("script");
script.src = chrome.runtime.getURL("bridge.js");
script.type = "module";
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();
