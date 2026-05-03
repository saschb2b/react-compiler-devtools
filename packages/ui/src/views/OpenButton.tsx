import { useOpenInEditor } from "../store";

interface Props {
  filename: string;
  line?: number;
  column?: number;
  /** Visual style: inline link or icon button. */
  variant?: "link" | "icon";
  label?: string;
}

/**
 * Asks the dev server to launch the user's editor at the given location.
 * Uses Vite's `/__open-in-editor` middleware (same one its error overlay
 * relies on). Silently no-ops on frameworks that don't expose it.
 */
export function OpenButton({ filename, line, column, variant = "link", label }: Props) {
  const open = useOpenInEditor();
  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open(filename, line, column);
  };
  if (variant === "icon") {
    return (
      <button
        type="button"
        className="rcd-open-icon"
        title={`Open ${filename}${line != null ? `:${line}` : ""} in editor`}
        onClick={handle}
      >
        ↗
      </button>
    );
  }
  return (
    <a href="#" className="rcd-open-link" onClick={handle}>
      {label ?? `open${line != null ? ` :${line}` : ""}`}
    </a>
  );
}
