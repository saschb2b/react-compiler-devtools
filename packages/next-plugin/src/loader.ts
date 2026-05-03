import { transformAsync } from "@babel/core";
import rcdPreset from "@rcd/babel-preset";
import { lookupCollector } from "./index.js";

interface LoaderOptions {
  collectorKey: string;
  compilerOptions?: Record<string, unknown>;
}

interface LoaderContext {
  resourcePath: string;
  getOptions(): LoaderOptions;
  async(): (err: Error | null, code?: string, map?: object) => void;
}

/**
 * Webpack-compatible loader. Runs `babel-plugin-react-compiler` with our
 * logger so each transform feeds the manifest. Skipping `babelrc` and
 * `configFile` keeps us out of the user's babel pipeline (Next disables Babel
 * by default for SWC, so we only see files that hit this loader).
 *
 * Webpack expects loaders to be exported as `module.exports = fn` from a CJS
 * module. tsup emits a `.cjs` build for this entry; the `loader` export in
 * package.json points at it.
 */
function rcdLoader(this: LoaderContext, source: string): void {
  const callback = this.async();
  const { collectorKey, compilerOptions } = this.getOptions();
  const collector = lookupCollector(collectorKey);
  if (!collector) {
    callback(null, source);
    return;
  }
  collector.resetFile(this.resourcePath);

  transformAsync(source, {
    filename: this.resourcePath,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    parserOpts: { plugins: ["typescript", "jsx"] },
    ...rcdPreset({ collector, compilerOptions }),
  })
    .then((result) => {
      if (!result || result.code == null) {
        callback(null, source);
        return;
      }
      callback(null, result.code, result.map ?? undefined);
    })
    .catch((err) => callback(err instanceof Error ? err : new Error(String(err))));
}

export default rcdLoader;
export const raw = false;
