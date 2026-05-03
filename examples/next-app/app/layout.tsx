import type { ReactNode } from "react";
// Side-effect: bootstrap the runtime global before the first compiled component renders.
import "@rcd/runtime/bootstrap";

export const metadata = { title: "RCD Next example" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
