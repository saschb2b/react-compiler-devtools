# @rcd/runtime

Dev-only instrumented replacement for `react/compiler-runtime`.

The framework plugins (`@rcd/vite-plugin`, `@rcd/next-plugin`) alias `react/compiler-runtime` to this package's `./shim` export in development. The shim:

1. Calls the real `_c(size)` to allocate the underlying cache array.
2. Wraps the array in a Proxy that records every read as `hit` (slot held a real value) or `miss` (slot held `Symbol.for("react.memo_cache_sentinel")`).
3. Pushes records into a global ring buffer at `window.__REACT_COMPILER_DEVTOOLS__.store`.
4. Posts a `BridgeMessage` for every render so the panel can update live.

## Exports

| Export                      | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `@rcd/runtime`              | Programmatic access to the store / bridge / shim — for custom integrations.       |
| `@rcd/runtime/shim`         | Drop-in `c` export. **Aliased automatically by the framework plugins.**            |
| `@rcd/runtime/bootstrap`    | Side-effect import that creates the global before any compiled code loads.         |
| `@rcd/runtime/bridge`       | `PanelBridge` — used by panels living outside the page (Chrome extension panel).   |

## Performance

The shim adds one Proxy access per cache slot read. Always dev-only. Production builds use `react/compiler-runtime` directly.
