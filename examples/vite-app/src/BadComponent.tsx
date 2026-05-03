// Intentionally violates the Rules of React so the compiler bails out.
// Should appear in the Bailouts view with a clear reason.
let mutableCounter = 0;

export function BadComponent({ count }: { count: number }) {
  mutableCounter += 1; // mutating module-scope state during render
  return (
    <p style={{ color: "tomato", fontSize: 12 }}>
      I bail out. Render #{mutableCounter}, current count {count}.
    </p>
  );
}
