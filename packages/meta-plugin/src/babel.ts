import type { PluginObj, PluginPass, NodePath } from "@babel/core";
import type * as BabelTypes from "@babel/types";
import { MetaCollector } from "./index.js";

export interface BabelMetaPluginState extends PluginPass {
  opts: {
    collector: MetaCollector;
  };
}

/**
 * Babel companion pass run AFTER `babel-plugin-react-compiler`. It walks the
 * source AST (not the compiler's output) to find `useMemo` / `useCallback` /
 * `React.memo` calls inside top-level functions that the compiler reports as
 * successfully compiled. These are likely redundant — the audit view in the
 * panel reads them.
 *
 * It also rewrites the function id space onto the canonical
 * `<filename>:<line>:<col>` form so the runtime can join.
 */
export default function rcdMetaCompanion(babel: { types: typeof BabelTypes }): PluginObj<BabelMetaPluginState> {
  const t = babel.types;

  return {
    name: "@rcd/meta-companion",
    visitor: {
      Program(path, state) {
        const filename = state.file.opts.filename ?? null;
        if (!filename) return;
        const collector = state.opts.collector;
        if (!collector) return;

        const findings: Array<{ functionId: string; memo: { kind: "useMemo" | "useCallback" | "memo"; loc: { start: { line: number; column: number }; end: { line: number; column: number } } } }> = [];

        path.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            const kind = identifyMemoCall(t, callee);
            if (!kind) return;
            const enclosing = enclosingTopLevelFunction(callPath);
            if (!enclosing) return;
            const fnLoc = enclosing.loc;
            if (!fnLoc) return;
            const callLoc = callPath.node.loc;
            if (!callLoc) return;
            const functionId = MetaCollector.functionId(filename, {
              start: { line: fnLoc.start.line, column: fnLoc.start.column },
              end: { line: fnLoc.end.line, column: fnLoc.end.column },
            });
            findings.push({
              functionId,
              memo: {
                kind,
                loc: {
                  start: { line: callLoc.start.line, column: callLoc.start.column },
                  end: { line: callLoc.end.line, column: callLoc.end.column },
                },
              },
            });
          },
        });

        if (findings.length > 0) {
          collector.attachManualMemos(filename, findings);
        }
      },
    },
  };
}

function identifyMemoCall(
  t: typeof BabelTypes,
  callee: BabelTypes.Expression | BabelTypes.V8IntrinsicIdentifier,
): "useMemo" | "useCallback" | "memo" | null {
  if (t.isIdentifier(callee)) {
    if (callee.name === "useMemo") return "useMemo";
    if (callee.name === "useCallback") return "useCallback";
    if (callee.name === "memo") return "memo";
    return null;
  }
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    if (callee.property.name === "useMemo") return "useMemo";
    if (callee.property.name === "useCallback") return "useCallback";
    if (callee.property.name === "memo") return "memo";
  }
  return null;
}

function enclosingTopLevelFunction(
  path: NodePath,
): BabelTypes.FunctionDeclaration | BabelTypes.FunctionExpression | BabelTypes.ArrowFunctionExpression | null {
  let current: NodePath | null = path.parentPath;
  let lastFn:
    | BabelTypes.FunctionDeclaration
    | BabelTypes.FunctionExpression
    | BabelTypes.ArrowFunctionExpression
    | null = null;
  while (current) {
    const n = current.node;
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) {
      lastFn = n;
    }
    current = current.parentPath;
  }
  return lastFn;
}
