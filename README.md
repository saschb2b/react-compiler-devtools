# react-compiler-devtools

DevTools for the React Compiler (1.0+). See, per component, what the compiler did, what it skipped, why — and watch cache hits and misses live as you interact with the app.

```
┌──────────────── React Compiler ────────────────┐
│ Overview · Files · Bailouts · Audit · Runtime  │
├────────────────────────────────────────────────┤
│  ▣ 142 functions  ✓ 128 compiled (90%)         │
│  ⚠ 11 skipped     ✗ 3 errored                  │
│  Top bailouts:                                  │
│   InvalidReact (5) · MutationDuringRender (3)   │
│   Todo (2) · UnsupportedFeature (1)             │
└────────────────────────────────────────────────┘
```

## What it shows

- **Overview** — % of components compiled, top bailout reasons, redundant manual memos.
- **Files** — per-file list of every top-level function with its status, cache slot count, and any bailout/diagnostic the compiler emitted.
- **Bailouts** — every skipped/errored function with reason, description, and (when available) the compiler's suggested fix.
- **Manual memo audit** — every `useMemo` / `useCallback` / `React.memo` that lives inside a successfully compiled component. The compiler is already memoizing those — they're noise.
- **Click-to-open in editor** — every row in Bailouts / Files / Audit has an open link that asks the dev server (Vite's `/__open-in-editor`) to launch your editor at the exact line. Set `EDITOR` / `LAUNCH_EDITOR` env if you want a non-default editor. Next.js wiring lands later.
- **Runtime cache** — for every live `_c(N)` cache, hit/miss per slot per render. Live updating.

## How it works

Two cooperating pieces:

1. **Build-time manifest.** A Babel preset wraps `babel-plugin-react-compiler` with a `logger` that streams every `CompileSuccess` / `CompileError` / `CompileSkip` / `CompileDiagnostic` / `Timing` event into a per-file manifest written to `node_modules/.rcd/manifest.json`. A companion AST pass also flags `useMemo`/`useCallback`/`memo` calls inside compiled functions for the audit view.
2. **Runtime shim.** The framework plugin aliases `react/compiler-runtime` to `@rcd/runtime/shim` in dev. The shim wraps `_c(size)` so every cache slot read records hit-vs-miss into a window-global ring buffer the panel reads via `postMessage`.

Production builds drop the alias and run unmodified `react/compiler-runtime` — zero runtime overhead.

## Quickstart

### Vite

```bash
pnpm add -D @rcd/vite-plugin babel-plugin-react-compiler
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reactCompilerDevtools } from "@rcd/vite-plugin";

export default defineConfig({
  plugins: [reactCompilerDevtools(), react()],
});
```

Open the app — a small **⚛ Compiler** toggle appears bottom-right. Click it to open the panel as an in-page overlay. Same panel, three ways to host it:

- **Vite overlay** (default) — togglable iframe injected by the plugin in dev. Disable with `reactCompilerDevtools({ overlay: false })`.
- **Chrome extension** — load `packages/extension/dist-extension` as an unpacked extension, then open DevTools → **React Compiler** tab. Useful when you want the panel docked inside DevTools.
- **Standalone** — open `http://localhost:5173/__rcd/manifest.json` to verify the manifest is being served, then run `pnpm --filter @rcd/ui dev` and point it at your app's origin.

### Next.js (15+, App Router)

```bash
pnpm add -D @rcd/next-plugin babel-plugin-react-compiler
pnpm add @rcd/runtime
```

```js
// next.config.mjs
import { withReactCompilerDevtools } from "@rcd/next-plugin";

export default withReactCompilerDevtools()({
  reactStrictMode: true,
});
```

```tsx
// app/layout.tsx
import "@rcd/runtime/bootstrap";
```

Add a route to expose the manifest:

```ts
// app/__rcd/manifest/route.ts
export { GET } from "@rcd/next-plugin/route";
```

(The `examples/next-app` directory has a working version.)

## Repository layout

| Package                | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `@rcd/protocol`        | Shared types + the wire protocol the runtime and panel speak.                 |
| `@rcd/meta-plugin`     | `MetaCollector` + Babel companion pass; turns logger events into a manifest.  |
| `@rcd/runtime`         | Dev-only shim for `react/compiler-runtime`; records hit/miss per slot.        |
| `@rcd/babel-preset`    | Wraps `babel-plugin-react-compiler` with our logger + companion.              |
| `@rcd/vite-plugin`     | Vite integration: runs the preset, aliases the runtime, serves the manifest. |
| `@rcd/next-plugin`     | `withReactCompilerDevtools(nextConfig)` — same job for Next 15.               |
| `@rcd/ui`              | The panel itself (React app). Embeddable + standalone.                        |
| `@rcd/extension`       | Chrome MV3 extension hosting the panel as a DevTools tab.                    |

## Development

```bash
pnpm install
pnpm build               # build every package
pnpm example:vite        # run the Vite dogfood app
pnpm example:next        # run the Next dogfood app
pnpm --filter @rcd/extension build   # build the unpacked extension
```

## Status

`0.1.0`. Built against React Compiler 1.0 — pinned via `babel-plugin-react-compiler@^1.0.0`. The `logger` event shape is treated as the public contract; we'll bump our own protocol version if the compiler's contract changes.

## License

MIT
