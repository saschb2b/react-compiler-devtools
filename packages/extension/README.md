# @rcd/extension

Chrome MV3 extension that mounts the React Compiler DevTools panel as a tab inside Chrome DevTools.

## Build

```bash
pnpm --filter @rcd/extension build
```

This writes an unpacked extension to `packages/extension/dist-extension/`.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select `packages/extension/dist-extension`.
4. Open any page running an app instrumented with `@rcd/vite-plugin` or `@rcd/next-plugin` in dev mode.
5. Open DevTools → switch to the **React Compiler** tab.

## How the messaging works

```
┌─────────────────────┐    postMessage     ┌──────────────────┐    chrome.runtime    ┌────────────────────────┐
│ runtime in page     │ ─────────────────► │ content script   │ ───────────────────► │ DevTools panel (panel) │
│ (window global)     │ ◄───────────────── │ (relay)          │ ◄─────────────────── │                        │
└─────────────────────┘                    └──────────────────┘                      └────────────────────────┘
```

The manifest is pulled directly via `chrome.devtools.inspectedWindow.eval` so the panel can fetch `/__rcd/manifest.json` from inside the page's origin without needing CORS.
