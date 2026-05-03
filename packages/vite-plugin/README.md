# @rcd/vite-plugin

Vite integration for [React Compiler DevTools](../../README.md).

```ts
import { reactCompilerDevtools } from "@rcd/vite-plugin";

export default defineConfig({
  plugins: [reactCompilerDevtools(), react()],
});
```

## Options

| Option            | Default                                | Description                                                            |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `compilerOptions` | `{}`                                   | Passed through to `babel-plugin-react-compiler`.                       |
| `manifestPath`    | `node_modules/.rcd/manifest.json`      | Where to write the manifest.                                           |
| `runtime`         | `true`                                 | Set `false` to disable the dev runtime alias (build manifest only).    |
| `overlay`         | `true`                                 | Set `false` to skip injecting the in-page panel toggle in dev.         |
| `include`/`exclude` | `/\.[jt]sx?$/` / `/node_modules/`    | Module-id matchers.                                                    |

The manifest is served live at `/__rcd/manifest.json` and the panel at `/__rcd/panel/standalone.html`. Production builds (`vite build`) skip the runtime alias and overlay entirely.
