# @rcd/meta-plugin

Build-time collector that turns `babel-plugin-react-compiler` logger events into a manifest the panel can read.

```ts
import { MetaCollector } from "@rcd/meta-plugin";

const collector = new MetaCollector({
  rootDir: process.cwd(),
  outFile: "node_modules/.rcd/manifest.json",
});

// In your Babel pipeline:
[
  "babel-plugin-react-compiler",
  {
    panicThreshold: "none",
    logger: { logEvent: (file, e) => collector.recordEvent(file, e) },
  },
];
```

The companion AST pass at `@rcd/meta-plugin/babel` walks each module to flag `useMemo`/`useCallback`/`memo` calls inside compiled functions for the audit view.

Most users won't import this package directly — they'll get it through `@rcd/babel-preset`, `@rcd/vite-plugin`, or `@rcd/next-plugin`.
