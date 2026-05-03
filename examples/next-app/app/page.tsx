"use client";

import { useState } from "react";

export default function Page() {
  const [count, setCount] = useState(0);
  const tripled = count * 3;
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>RCD Next example</h1>
      <button onClick={() => setCount((c) => c + 1)}>count {count}</button>
      <p>3× count = {tripled}</p>
    </main>
  );
}
