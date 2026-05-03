# @rcd/ui

The React panel app. Two delivery modes:

| Mode             | Build              | How                                                                 |
| ---------------- | ------------------ | ------------------------------------------------------------------- |
| Embeddable lib   | `vite build`       | `mountPanel(container, transport)` — used by the Chrome extension.   |
| Standalone HTML  | `vite build` (sec) | `dist-standalone/standalone.html` — open with any web server.        |

```ts
import { mountPanel, mountInPage } from "@rcd/ui";

mountPanel(document.getElementById("root")!, mountInPage());
```

`mountInPage()` returns a `Transport` that fetches the manifest from `MANIFEST_ENDPOINT` and listens for runtime `postMessage` events on the same window. The Chrome extension supplies its own transport that proxies via `chrome.runtime`.
