# @rcd/next-plugin

Next.js 15 integration for [React Compiler DevTools](../../README.md).

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

```ts
// app/__rcd/manifest/route.ts
import { NextResponse } from "next/server";
import { lookupCollector } from "@rcd/next-plugin";

export function GET() {
  const c = lookupCollector(process.cwd());
  return NextResponse.json(c?.getManifest() ?? null, {
    headers: { "access-control-allow-origin": "*" },
  });
}
```

## Notes

- Disables Next's built-in `experimental.reactCompiler` and runs the compiler ourselves through Babel so we can attach the `logger`. SWC stays in charge of everything else.
- In dev, aliases `react/compiler-runtime` to `@rcd/runtime/shim` for the client bundle. Server bundles are untouched.
- Production builds drop the alias.
