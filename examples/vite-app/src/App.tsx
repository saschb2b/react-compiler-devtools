import { useState } from "react";
import { TodoList } from "./TodoList";
import { BadComponent } from "./BadComponent";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let nextId = 1;
const initial: Todo[] = [
  { id: nextId++, text: "Try the React Compiler", done: true },
  { id: nextId++, text: "Open the DevTools panel", done: false },
];

// This component is a clean compile target — the compiler should auto-memoize.
export function App() {
  const [todos, setTodos] = useState<Todo[]>(initial);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [draft, setDraft] = useState("");

  const visible = todos.filter((t) =>
    filter === "all" ? true : filter === "open" ? !t.done : t.done,
  );
  const stats = {
    total: todos.length,
    done: todos.filter((t) => t.done).length,
  };

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 480, margin: "40px auto" }}>
      <h1>RCD example</h1>
      <p>
        {stats.done}/{stats.total} done
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          setTodos((ts) => [...ts, { id: nextId++, text: draft.trim(), done: false }]);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
      <div style={{ margin: "12px 0" }}>
        {(["all", "open", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontWeight: filter === f ? 700 : 400, marginRight: 4 }}
          >
            {f}
          </button>
        ))}
      </div>
      <TodoList
        todos={visible}
        onToggle={(id) =>
          setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
        }
      />
      <BadComponent count={stats.done} />
    </main>
  );
}
