import { useCallback, useMemo } from "react";

interface Todo { id: number; text: string; done: boolean; }

// The compiler should auto-memoize this component AND the inline closures.
// The manual `useMemo`/`useCallback` calls below should show up in the panel's
// "Manual memo audit" view as redundant.
export function TodoList({ todos, onToggle }: { todos: Todo[]; onToggle: (id: number) => void }) {
  const sorted = useMemo(
    () => [...todos].sort((a, b) => Number(a.done) - Number(b.done)),
    [todos],
  );
  const handleClick = useCallback((id: number) => onToggle(id), [onToggle]);

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {sorted.map((t) => (
        <li key={t.id}>
          <label>
            <input type="checkbox" checked={t.done} onChange={() => handleClick(t.id)} />
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
