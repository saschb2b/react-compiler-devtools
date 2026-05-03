# @rcd/protocol

Shared types + the wire protocol every other package speaks. Bumping `PROTOCOL_VERSION` forces older readers (panels, extensions) to refuse the payload.

The two payload shapes you'll deal with:

- **`Manifest`** — built at compile time by `@rcd/meta-plugin`, served by the framework plugins at `MANIFEST_ENDPOINT` (`/__rcd/manifest.json`).
- **`RuntimeSnapshot` / `RenderRecord`** — pushed at runtime by `@rcd/runtime` over `postMessage`, namespaced under `source: "rcd"`.

See `src/index.ts` for the full type list.
