import type { PluginObj, PluginPass, NodePath } from "@babel/core";
import type * as BabelTypes from "@babel/types";
import type { SourceLoc } from "@rcd/protocol";
import type { MetaCollector } from "./index.js";

export interface BabelMetaPluginState extends PluginPass {
  opts: { collector: MetaCollector };
}

/**
 * Babel companion pass. MUST be registered BEFORE `babel-plugin-react-compiler`
 * so we walk the original source AST. The compiler rewrites `useMemo` /
 * `useCallback` calls into cache-slot lookups, which would erase our findings.
 *
 * For every top-level function we see, we record:
 *   • its name (so errored functions, which the compiler reports without a
 *     name in `event.fnName`, still show up as "Foo" in the panel)
 *   • any `useMemo` / `useCallback` / `memo` calls inside its body
 *
 * The collector merges these into the eventual manifest entry that the
 * compiler's logger creates a few visitors later.
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

        path.traverse({
          "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(fnPath: NodePath) {
            // Top-level only — skip nested closures (they aren't compile units).
            if (!isTopLevel(fnPath)) return;
            const node = fnPath.node as
              | BabelTypes.FunctionDeclaration
              | BabelTypes.FunctionExpression
              | BabelTypes.ArrowFunctionExpression;
            if (!node.loc) return;
            const loc = toLoc(node.loc);
            const name = extractName(t, fnPath, node);
            const manualMemos = findManualMemos(t, fnPath);
            collector.observeFunction(filename, { name, loc, manualMemos });
          },
        });
      },
    },
  };
}

function isTopLevel(fnPath: NodePath): boolean {
  let parent: NodePath | null = fnPath.parentPath;
  while (parent) {
    const t = parent.node.type;
    if (t === "Program") return true;
    if (
      t === "FunctionDeclaration" ||
      t === "FunctionExpression" ||
      t === "ArrowFunctionExpression" ||
      t === "ClassMethod" ||
      t === "ObjectMethod"
    ) {
      return false;
    }
    parent = parent.parentPath;
  }
  return false;
}

function toLoc(loc: NonNullable<BabelTypes.Node["loc"]>): SourceLoc {
  return {
    start: { line: loc.start.line, column: loc.start.column },
    end: { line: loc.end.line, column: loc.end.column },
  };
}

function extractName(
  t: typeof BabelTypes,
  fnPath: NodePath,
  node: BabelTypes.FunctionDeclaration | BabelTypes.FunctionExpression | BabelTypes.ArrowFunctionExpression,
): string | null {
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node))) {
    const parent = fnPath.parent;
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
    if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) return parent.left.name;
    if (t.isProperty(parent) && t.isIdentifier(parent.key)) return parent.key.name;
  }
  return null;
}

function findManualMemos(
  t: typeof BabelTypes,
  fnPath: NodePath,
): Array<{ kind: "useMemo" | "useCallback" | "memo"; loc: SourceLoc }> {
  const out: Array<{ kind: "useMemo" | "useCallback" | "memo"; loc: SourceLoc }> = [];
  fnPath.traverse({
    CallExpression(callPath) {
      const kind = identifyMemoCall(t, callPath.node.callee);
      if (!kind) return;
      const callLoc = callPath.node.loc;
      if (!callLoc) return;
      out.push({ kind, loc: toLoc(callLoc) });
    },
  });
  return out;
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
