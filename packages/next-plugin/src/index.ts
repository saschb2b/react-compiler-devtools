import { MetaCollector } from "@rcd/meta-plugin";
import { MANIFEST_ENDPOINT } from "@rcd/protocol";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";

const require = createRequire(import.meta.url);

export interface ReactCompilerDevtoolsNextOptions {
  /** Forwarded to `babel-plugin-react-compiler` (panicThreshold defaults to "none"). */
  compilerOptions?: Record<string, unknown>;
  /** Where the manifest is written. Defaults to `node_modules/.rcd/manifest.json`. */
  manifestPath?: string;
  /** Disable the runtime instrumentation (still emits the build manifest). */
  runtime?: boolean;
}

/**
 * Wraps a Next config to add React Compiler DevTools.
 *
 * - Disables Next's built-in `experimental.reactCompiler` (we run the compiler ourselves
 *   through Babel so we can attach our logger and companion pass).
 * - Adds a babel-loader rule that runs our preset on app/page/component sources.
 * - Rewrites `react/compiler-runtime` to the instrumented shim in dev — except when the
 *   importer is the shim itself (which needs the real module).
 *
 * Users must add `import "@rcd/runtime/bootstrap";` to their root layout so the
 * runtime global is created before any compiled component runs.
 */
export function withReactCompilerDevtools(
  options: ReactCompilerDevtoolsNextOptions = {},
): (nextConfig?: Record<string, unknown>) => Record<string, unknown> {
  return (nextConfig = {}) => {
    const userWebpack = nextConfig.webpack as
      | ((config: WebpackConfig, ctx: WebpackContext) => WebpackConfig)
      | undefined;
    const userExperimental = (nextConfig.experimental ?? {}) as Record<string, unknown>;

    return {
      ...nextConfig,
      experimental: {
        ...userExperimental,
        // We supply the compiler ourselves through Babel so we can hook the logger.
        reactCompiler: false,
      },
      webpack(config: WebpackConfig, ctx: WebpackContext) {
        config = applyDevtoolsToWebpack(config, ctx, options);
        return userWebpack ? userWebpack(config, ctx) : config;
      },
    };
  };
}

interface WebpackConfig {
  resolve?: { alias?: Record<string, string | string[]>; plugins?: unknown[] };
  module?: { rules?: unknown[] };
  plugins?: unknown[];
  name?: string;
}

interface WebpackContext {
  dev: boolean;
  isServer: boolean;
  buildId: string;
  dir: string;
}

interface BeforeResolveData {
  request: string;
  context: string;
}

interface NormalModuleFactoryHooks {
  beforeResolve: { tap: (name: string, fn: (data: BeforeResolveData) => void) => void };
}

interface CompilerHook<T> { tap: (name: string, fn: (arg: T) => void) => void }
interface WebpackCompiler {
  hooks: { normalModuleFactory: CompilerHook<NormalModuleFactoryHooks> };
}

class IssuerAwareRuntimeReplacement {
  apply(compiler: WebpackCompiler): void {
    const shimPath = require.resolve("@rcd/runtime/shim");
    compiler.hooks.normalModuleFactory.tap("RcdRuntimeReplacement", (nmf) => {
      nmf.beforeResolve.tap("RcdRuntimeReplacement", (data) => {
        if (data.request !== "react/compiler-runtime") return;
        const ctx = (data.context ?? "").replaceAll("\\", "/");
        if (ctx.includes("/@rcd/runtime/")) return; // shim must reach the real module
        data.request = shimPath;
      });
    });
  }
}

function applyDevtoolsToWebpack(
  config: WebpackConfig,
  ctx: WebpackContext,
  options: ReactCompilerDevtoolsNextOptions,
): WebpackConfig {
  // The collector is shared across the dev server's compilation lifetimes via a process-global
  // so HMR-driven re-transforms accumulate into one manifest the panel can poll.
  const collector = getOrCreateProcessCollector(ctx.dir, options);

  if (ctx.dev && options.runtime !== false && !ctx.isServer) {
    config.plugins = config.plugins ?? [];
    config.plugins.push(new IssuerAwareRuntimeReplacement());
  }

  config.module = config.module ?? {};
  config.module.rules = config.module.rules ?? [];
  config.module.rules.unshift({
    test: /\.[jt]sx?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: require.resolve("@rcd/next-plugin/loader"),
        options: {
          collectorKey: collectorKey(ctx.dir),
          compilerOptions: options.compilerOptions ?? {},
        },
      },
    ],
  });

  // Suppress unused-binding warning while keeping the collector alive on the process global.
  void collector;

  return config;
}

const PROCESS_COLLECTORS = "@@rcd/collectors" as const;

function collectorKey(dir: string): string {
  return resolve(dir);
}

function getOrCreateProcessCollector(
  dir: string,
  options: ReactCompilerDevtoolsNextOptions,
): MetaCollector {
  const reg = (globalThis as Record<string, unknown>)[PROCESS_COLLECTORS] as
    | Map<string, MetaCollector>
    | undefined;
  const map = reg ?? new Map<string, MetaCollector>();
  if (!reg) (globalThis as Record<string, unknown>)[PROCESS_COLLECTORS] = map;
  const key = collectorKey(dir);
  let collector = map.get(key);
  if (!collector) {
    collector = new MetaCollector({
      rootDir: key,
      outFile: options.manifestPath ?? resolve(key, "node_modules/.rcd/manifest.json"),
    });
    map.set(key, collector);
  }
  return collector;
}

/** Shared with the loader so it can find the right collector by key. */
export function lookupCollector(key: string): MetaCollector | undefined {
  const reg = (globalThis as Record<string, unknown>)[PROCESS_COLLECTORS] as
    | Map<string, MetaCollector>
    | undefined;
  return reg?.get(resolve(key));
}

/**
 * Drop-in route handler users can re-export from `app/__rcd/manifest/route.ts`
 * to expose the manifest at {@link MANIFEST_ENDPOINT}.
 */
export function createManifestHandler(): (req: IncomingMessage, res: ServerResponse) => void {
  return (_req, res) => {
    const reg = (globalThis as Record<string, unknown>)[PROCESS_COLLECTORS] as
      | Map<string, MetaCollector>
      | undefined;
    const collector = reg ? [...reg.values()][0] : undefined;
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    res.end(JSON.stringify(collector?.getManifest() ?? null));
  };
}

export { MANIFEST_ENDPOINT };
