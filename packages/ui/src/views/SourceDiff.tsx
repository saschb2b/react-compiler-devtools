import { useMemo } from "react";
import type { SourcePair } from "@rcd/protocol";

/**
 * Side-by-side view of original source vs. compiler output. We don't run a
 * real diff algorithm — line counts diverge wildly (compiled output is much
 * larger), so unified or LCS diff would be noisy. Instead we render both
 * panes line-numbered and highlight the cache-runtime artifacts on the
 * compiled side so they stand out.
 */
export function SourceDiff({ pair }: { pair: SourcePair }) {
  const original = useMemo(() => pair.original.split("\n"), [pair.original]);
  const compiled = useMemo(() => pair.compiled.split("\n"), [pair.compiled]);

  return (
    <div className="rcd-diff">
      <div className="rcd-diff-header">
        <div>
          <strong>Original</strong>
          <span className="rcd-muted"> · {original.length} lines</span>
        </div>
        <div>
          <strong>Compiled</strong>
          <span className="rcd-muted"> · {compiled.length} lines · cache slots highlighted</span>
        </div>
      </div>
      <div className="rcd-diff-body">
        <pre className="rcd-diff-pane"><code>{renderLines(original, false)}</code></pre>
        <pre className="rcd-diff-pane"><code>{renderLines(compiled, true)}</code></pre>
      </div>
    </div>
  );
}

function renderLines(lines: string[], highlightCache: boolean) {
  return lines.map((line, i) => (
    <div key={i} className="rcd-diff-line">
      <span className="rcd-diff-ln">{i + 1}</span>
      <span className="rcd-diff-code">{highlightCache ? highlight(line) : line || " "}</span>
    </div>
  ));
}

// Keep this regex deliberately narrow — only the patterns the React Compiler
// actually emits. The runtime import is the most useful tell.
const PATTERNS = [
  { re: /react\/compiler-runtime/g, cls: "rcd-tk-runtime" },
  { re: /react\.memo_cache_sentinel/g, cls: "rcd-tk-sentinel" },
  { re: /\b_c\(\d+\)/g, cls: "rcd-tk-c" },
  { re: /\$\[\d+\]/g, cls: "rcd-tk-slot" },
];

function highlight(line: string): React.ReactNode {
  if (line.length === 0) return " ";
  type Span = { start: number; end: number; cls: string };
  const spans: Span[] = [];
  for (const { re, cls } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, cls });
    }
  }
  if (spans.length === 0) return line;
  spans.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // skip overlaps
    if (span.start > cursor) out.push(line.slice(cursor, span.start));
    out.push(
      <span key={`${span.start}`} className={span.cls}>
        {line.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}
