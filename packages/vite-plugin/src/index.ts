import { transformAsync } from "@babel/core";
import rcdPreset from "@rcd/babel-preset";
import { MetaCollector } from "@rcd/meta-plugin";
import { MANIFEST_ENDPOINT } from "@rcd/protocol";
import type { Plugin, ViteDevServer } from "vite";
import { resolve } from "node:path";

export interface ReactCompilerDevtoolsOptions {
  /** Glob/regex matched against module ids; defaults to `.tsx?`/`.jsx?` files. */
  include?: RegExp;
  exclude?: RegExp;
  /** Where to write the manifest in dev. Defaults to `node_modules/.rcd/manifest.json`. */
  manifestPath?: string;
  /** Forwarded as-is to `babel-plugin-react-compiler`. */
  compilerOptions?: Record<string, unknown>;
  /** Disable the runtime instrumentation (still emits the build manifest). */
  runtime?: boolean;
}

const RUNTIME_SPECIFIER = "react/compiler-runtime";
const RUNTIME_SHIM = "@rcd/runtime/shim";

/**
 * Vite plugin: configures `babel-plugin-react-compiler` with our logger,
 * serves the manifest at `MANIFEST_ENDPOINT`, and rewrites imports of
 * `react/compiler-runtime` to the instrumented shim — except when the
 * importer is the shim itself, which needs the real module.
 *
 * Production builds (`command === 'build'`) run the compiler too but skip
 * the rewrite, so there's zero runtime overhead.
 *
 * Users must add `import "@rcd/runtime/bootstrap";` as the first import in
 * their entry so the runtime global exists before any compiled module loads.
 */
export function reactCompilerDevtools(options: ReactCompilerDevtoolsOptions = {}): Plugin {
  const include = options.include ?? /\.[jt]sx?$/;
  const exclude = options.exclude ?? /node_modules/;
  let collector: MetaCollector | null = null;
  let isDev = true;
  let runtimeEnabled = true;
  let server: ViteDevServer | null = null;

  return {
    name: "@rcd/vite-plugin",
    enforce: "pre",

    config(_config, env) {
      isDev = env.command === "serve";
      runtimeEnabled = isDev && options.runtime !== false;
      return {
        define: {
          __RCD_FRAMEWORK__: JSON.stringify("vite"),
        },
        optimizeDeps: {
          include: runtimeEnabled ? [RUNTIME_SHIM] : [],
        },
      };
    },

    configResolved(config) {
      const root = config.root;
      collector = new MetaCollector({
        rootDir: root,
        outFile: options.manifestPath ?? resolve(root, "node_modules/.rcd/manifest.json"),
        onUpdate: () => {
          if (server && collector) {
            server.ws.send({ type: "custom", event: "rcd:manifest", data: collector.getManifest() });
          }
        },
      });
    },

    async resolveId(source, importer) {
      if (!runtimeEnabled) return null;
      if (source !== RUNTIME_SPECIFIER) return null;
      // The shim itself must reach the real module — let it through.
      if (importer && importer.replaceAll("\\", "/").includes("/@rcd/runtime/")) return null;
      const resolved = await this.resolve(RUNTIME_SHIM, importer, { skipSelf: true });
      return resolved ?? null;
    },

    configureServer(devServer) {
      server = devServer;
      devServer.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url === MANIFEST_ENDPOINT) {
          res.setHeader("content-type", "application/json");
          res.setHeader("access-control-allow-origin", "*");
          res.end(JSON.stringify(collector?.getManifest() ?? null));
          return;
        }
        next();
      });
    },

    async transform(code, id) {
      if (!collector) return null;
      if (exclude.test(id) || !include.test(id)) return null;
      collector.resetFile(id);

      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        // Babel must parse TS/JSX syntax to feed the AST to the React Compiler. We don't
        // strip either — `@vitejs/plugin-react` (which runs after us) handles that via esbuild.
        parserOpts: { plugins: ["typescript", "jsx"] },
        ...rcdPreset({ collector, compilerOptions: options.compilerOptions }),
      });

      if (!result || result.code == null) return null;
      return { code: result.code, map: result.map ?? undefined };
    },
  };
}

export default reactCompilerDevtools;
