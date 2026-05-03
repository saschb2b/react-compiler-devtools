import { transformAsync } from "@babel/core";
import rcdPreset from "@rcd/babel-preset";
import { MetaCollector } from "@rcd/meta-plugin";
import { MANIFEST_ENDPOINT } from "@rcd/protocol";
import { standaloneDir } from "@rcd/ui/standalone";
import type { Plugin, ViteDevServer } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

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
  /**
   * Inject a togglable in-page panel served from the dev server.
   * Default: `true` in dev, `false` in build.
   */
  overlay?: boolean;
}

const RUNTIME_SPECIFIER = "react/compiler-runtime";
const RUNTIME_SHIM = "@rcd/runtime/shim";
const PANEL_BASE = "/__rcd/panel/";
const PANEL_ENTRY = "standalone.html";

/**
 * Vite plugin: configures `babel-plugin-react-compiler` with our logger,
 * serves the manifest at `MANIFEST_ENDPOINT`, rewrites `react/compiler-runtime`
 * to the instrumented shim, and (in dev) injects a togglable panel overlay so
 * users can see the compiler's findings without installing the Chrome
 * extension.
 *
 * Production builds drop the alias and overlay so there's zero overhead.
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
  let overlayEnabled = true;
  let server: ViteDevServer | null = null;

  return {
    name: "@rcd/vite-plugin",
    enforce: "pre",

    config(_config, env) {
      isDev = env.command === "serve";
      runtimeEnabled = isDev && options.runtime !== false;
      overlayEnabled = isDev && options.overlay !== false;
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

        if (overlayEnabled && req.url.startsWith(PANEL_BASE)) {
          servePanelAsset(req.url.slice(PANEL_BASE.length), res, next);
          return;
        }

        next();
      });
    },

    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!overlayEnabled) return html;
        return html.replace(/<\/body>/i, `${OVERLAY_SNIPPET}\n</body>`);
      },
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
        parserOpts: { plugins: ["typescript", "jsx"] },
        ...rcdPreset({ collector, compilerOptions: options.compilerOptions }),
      });

      if (!result || result.code == null) return null;
      return { code: result.code, map: result.map ?? undefined };
    },
  };
}

function servePanelAsset(
  pathInPanel: string,
  res: import("node:http").ServerResponse,
  next: () => void,
): void {
  const requested = pathInPanel === "" || pathInPanel === "/" ? PANEL_ENTRY : pathInPanel;
  const filePath = join(standaloneDir, requested);
  if (!filePath.startsWith(standaloneDir) || !existsSync(filePath)) {
    next();
    return;
  }
  res.setHeader("content-type", contentTypeFor(filePath));
  res.end(readFileSync(filePath));
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case ".html": return "text/html; charset=utf-8";
    case ".js":   return "text/javascript; charset=utf-8";
    case ".css":  return "text/css; charset=utf-8";
    case ".json": return "application/json";
    case ".svg":  return "image/svg+xml";
    default:      return "application/octet-stream";
  }
}

const OVERLAY_SNIPPET = /* html */ `
<!-- React Compiler DevTools overlay (dev only) -->
<div id="__rcd-overlay" style="position:fixed;bottom:12px;right:12px;z-index:2147483647;font:12px ui-sans-serif,system-ui;">
  <button id="__rcd-toggle" title="Open React Compiler DevTools"
    style="background:#0d0f12;color:#e6e8eb;border:1px solid #2a2f37;border-radius:8px;padding:6px 10px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
    <span style="color:#6ea8ff;">⚛</span> Compiler
  </button>
  <iframe id="__rcd-iframe" src="${PANEL_BASE}${PANEL_ENTRY}" hidden
    style="position:fixed;bottom:12px;right:12px;width:min(900px,calc(100vw - 24px));height:min(640px,calc(100vh - 24px));border:1px solid #2a2f37;border-radius:10px;background:#0d0f12;box-shadow:0 12px 40px rgba(0,0,0,0.5);"></iframe>
</div>
<script>
  (function(){
    var btn = document.getElementById("__rcd-toggle");
    var frame = document.getElementById("__rcd-iframe");
    btn.addEventListener("click", function(){
      var open = !frame.hidden;
      frame.hidden = open;
      btn.style.opacity = open ? "1" : "0.6";
    });
    // Forward parent → iframe. The opposite direction works natively because
    // the panel's transport already calls parent.postMessage when iframed.
    window.addEventListener("message", function(e){
      if (!e.data || e.data.source !== "rcd") return;
      if (e.source === frame.contentWindow) return; // came from iframe; runtime sees it
      if (frame.contentWindow) frame.contentWindow.postMessage(e.data, "*");
    });
  })();
</script>
`;

export default reactCompilerDevtools;
