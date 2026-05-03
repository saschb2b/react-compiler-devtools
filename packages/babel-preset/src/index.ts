import { MetaCollector, type CompilerLogger, type CompilerLoggerEvent } from "@rcd/meta-plugin";
import companion from "@rcd/meta-plugin/babel";

export interface PresetOptions {
  collector: MetaCollector;
  /** Forwarded to `babel-plugin-react-compiler`. */
  compilerOptions?: Record<string, unknown>;
}

/**
 * Returns the Babel plugin list (compiler + our companion) configured to
 * stream events into the collector. Used by the Vite plugin and any user who
 * wires Babel directly (e.g. inside a Next custom babel config).
 */
export default function rcdPreset({ collector, compilerOptions = {} }: PresetOptions) {
  const logger: CompilerLogger = {
    logEvent(filename, event) {
      collector.recordEvent(filename, event as CompilerLoggerEvent);
    },
  };

  return {
    plugins: [
      [
        "babel-plugin-react-compiler",
        {
          // Surface every diagnostic so we can list bailouts in the panel — but never throw.
          panicThreshold: "none",
          ...compilerOptions,
          logger,
        },
      ],
      [companion, { collector }],
    ],
  };
}

export { MetaCollector } from "@rcd/meta-plugin";
